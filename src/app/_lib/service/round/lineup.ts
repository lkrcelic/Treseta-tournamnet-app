import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {z} from "zod";
import {defaultLineup, PLAYERS_PER_TEAM} from "@/app/_lib/lineup";
import {displayName, fullName} from "@/app/_lib/players/names";

// Who plays a round: two players from each team, picked on Start Game before the scoreboard opens. Ratings of the
// round go to these players (rounds without a lineup rate the whole roster). A deactivated player isn't offered or
// picked: when a lineup saved before the deactivation names them, the open round's screen puts an active teammate in
// their place, so it can be confirmed again (a finished round keeps what was saved). The members' usernames go to the
// players of the round (design 7c shows them under the names).

export type LineupMember = {id: number; name: string; username: string};

export type LineupTeam = {
  id: number;
  name: string;
  // the viewer plays for this team
  mine: boolean;
  members: LineupMember[];
  selected: number[];
  // how many players must be picked: two, or the whole roster when it is smaller
  needed: number;
};

export type Lineup = {
  roundId: number;
  table: number | null;
  roundNumber: number | null;
  // a lineup was confirmed for this round already
  saved: boolean;
  teams: [LineupTeam, LineupTeam];
};

export const LineupSaveValidation = z.object({
  teams: z
    .array(z.object({team_id: z.number().int(), player_ids: z.array(z.number().int()).max(PLAYERS_PER_TEAM)}))
    .length(2),
});
export type LineupSave = z.infer<typeof LineupSaveValidation>;

const teamSelect = {
  team_id: true,
  team_name: true,
  founder_id1: true,
  founder_id2: true,
  teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, username: true, active: true}}}},
} as const;

export async function getLineup(roundId: number, viewerId: number): Promise<Lineup> {
  const round = await prisma.round.findUnique({
    where: {id: roundId},
    select: {
      id: true,
      open: true,
      table_number: true,
      round_number: true,
      team1: {select: teamSelect},
      team2: {select: teamSelect},
      leagueRounds: {select: {league_id: true}},
      roundPlayers: {select: {player_id: true, team_id: true}},
    },
  });
  if (!round) throw new NotFoundError("Runda ne postoji.");

  const saved = round.roundPlayers.length > 0;
  const leagueId = round.leagueRounds[0]?.league_id ?? null;

  const team = async (t: typeof round.team1): Promise<LineupTeam> => {
    const savedIds = round.roundPlayers.filter((p) => p.team_id === t.team_id).map((p) => p.player_id);
    const roster = activeRoster(t.teamPlayers.map((tp) => tp.player));
    // a finished round can't be changed: it shows who played, deactivated or not
    const shown = (p: {id: number; active: boolean}) => p.active || (!round.open && savedIds.includes(p.id));
    const members = t.teamPlayers
      .map(({player: p}) => p)
      .filter(shown)
      .map((p) => ({id: p.id, name: fullName(p), username: p.username}))
      .sort((a, b) => a.name.localeCompare(b.name, "hr"));
    const founders = [t.founder_id1, t.founder_id2];
    // an open round's saved lineup keeps its active players and is topped up from the roster (saveLineup accepts
    // only active players, as many as `needed`)
    const selected = !saved
      ? defaultLineup(roster, await lastLineup(t.team_id, leagueId, roundId), founders)
      : round.open
        ? defaultLineup(roster, savedIds, founders)
        : savedIds;
    return {
      id: t.team_id,
      name: t.team_name,
      mine: t.teamPlayers.some((tp) => tp.player.id === viewerId),
      members,
      selected,
      needed: Math.min(PLAYERS_PER_TEAM, roster.length),
    };
  };

  return {
    roundId: round.id,
    table: round.table_number,
    roundNumber: round.round_number,
    saved,
    teams: [await team(round.team1), await team(round.team2)],
  };
}

// The roster a lineup is picked from: the players an admin hasn't deactivated
function activeRoster(players: {id: number; active: boolean}[]): number[] {
  return players.filter((p) => p.active).map((p) => p.id);
}

// The players of the team's most recent round in the league that has a lineup
async function lastLineup(teamId: number, leagueId: number | null, roundId: number): Promise<number[] | null> {
  const last = await prisma.round.findFirst({
    where: {
      id: {not: roundId},
      roundPlayers: {some: {team_id: teamId}},
      ...(leagueId != null && {leagueRounds: {some: {league_id: leagueId}}}),
    },
    orderBy: [{round_date: "desc"}, {round_number: "desc"}, {id: "desc"}],
    select: {roundPlayers: {where: {team_id: teamId}, select: {player_id: true}}},
  });
  return last ? last.roundPlayers.map((p) => p.player_id) : null;
}

export async function hasLineup(roundId: number): Promise<boolean> {
  return (await prisma.roundPlayer.count({where: {round_id: roundId}})) > 0;
}

const savePlayerSelect = {id: true, active: true, first_name: true, last_name: true} as const;

// Saves (or replaces) the round's lineup: each team's players must be on its roster and active, two of them or the
// whole (active) roster
export async function saveLineup(roundId: number, lineup: LineupSave): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({
      where: {id: roundId},
      select: {
        open: true,
        team1_id: true,
        team2_id: true,
        team1: {select: {teamPlayers: {select: {player: {select: savePlayerSelect}}}}},
        team2: {select: {teamPlayers: {select: {player: {select: savePlayerSelect}}}}},
      },
    });
    if (!round) throw new NotFoundError("Runda ne postoji.");
    if (!round.open) throw new InvalidResultError("Ova runda je već završena.");

    // a player deactivated while the screen was open: say who, instead of the count below
    const inactive = [...round.team1.teamPlayers, ...round.team2.teamPlayers]
      .map((tp) => tp.player)
      .find((p) => !p.active && lineup.teams.some((t) => t.player_ids.includes(p.id)));
    if (inactive) {
      throw new InvalidResultError(`${displayName(inactive)} ima deaktiviran račun. Odaberi drugog igrača.`);
    }

    const rosters = new Map([
      [round.team1_id, activeRoster(round.team1.teamPlayers.map((tp) => tp.player))],
      [round.team2_id, activeRoster(round.team2.teamPlayers.map((tp) => tp.player))],
    ]);
    const teamIds = lineup.teams.map((t) => t.team_id);
    if (new Set(teamIds).size !== 2 || !teamIds.every((id) => rosters.has(id))) {
      throw new InvalidResultError("Postava mora biti za dvije ekipe ove runde.");
    }

    const rows: {round_id: number; player_id: number; team_id: number}[] = [];
    for (const {team_id, player_ids} of lineup.teams) {
      const roster = rosters.get(team_id)!;
      const ids = Array.from(new Set(player_ids));
      if (ids.length !== Math.min(PLAYERS_PER_TEAM, roster.length) || !ids.every((id) => roster.includes(id))) {
        throw new InvalidResultError(`Odaberi ${Math.min(PLAYERS_PER_TEAM, roster.length)} igrača iz svake ekipe.`);
      }
      ids.forEach((player_id) => rows.push({round_id: roundId, player_id, team_id}));
    }
    if (new Set(rows.map((r) => r.player_id)).size !== rows.length) {
      throw new InvalidResultError("Igrač ne može igrati za obje ekipe.");
    }

    await tx.roundPlayer.deleteMany({where: {round_id: roundId}});
    await tx.roundPlayer.createMany({data: rows});
  });
}
