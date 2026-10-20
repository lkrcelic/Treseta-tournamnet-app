import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {z} from "zod";
import {defaultLineup, lineupPool, PLAYERS_PER_TEAM} from "@/app/_lib/lineup";
import {displayName, fullName} from "@/app/_lib/players/names";
import {lineupVisible, Viewer} from "@/app/_lib/players/privacy";
import {ROUND_NOT_PUBLISHED} from "@/app/_lib/roundStatus";
import {PLAYER_PHOTO, photoContext} from "@/app/_lib/service/players/photos";
import {isRatedRound, replayRatings} from "@/app/_lib/service/admin/recalc";

// Who plays a round: two players from each team, picked on Start Game before the scoreboard opens. Ratings of the
// round go to these players (rounds without a lineup rate the whole roster). A deactivated player isn't offered or
// picked: when a lineup saved before the deactivation names them, the open round's screen puts an active teammate in
// their place, so it can be confirmed again. An admin confirms it again every time they open a table's scorepad, a
// finished one too: there the saved players stay on offer (deactivated or off the team since), and a change replays
// the ratings. The members' usernames go to the players of the round while it is open (design 7c shows them under the
// names); a finished round's lineup only to admins (lineupVisible).

export const ROUND_FINISHED = "Ova runda je već završena.";

// photo_url: the avatar (null = the initials)
export type LineupMember = {id: number; name: string; username: string; photo_url: string | null};

export type LineupTeam = {
  id: number;
  name: string;
  // the viewer plays for this team
  mine: boolean;
  members: LineupMember[];
  selected: number[];
  // the players saved for this team now (none before the lineup is confirmed)
  saved: number[];
  // how many players must be picked: two, or the whole roster when it is smaller
  needed: number;
};

export type Lineup = {
  roundId: number;
  table: number | null;
  roundNumber: number | null;
  // a lineup was confirmed for this round already
  saved: boolean;
  // the round is over: a change goes into its ratings
  finished: boolean;
  teams: [LineupTeam, LineupTeam];
};

export const LineupSaveValidation = z.object({
  teams: z
    .array(z.object({team_id: z.number().int(), player_ids: z.array(z.number().int()).max(PLAYERS_PER_TEAM)}))
    .length(2),
});
export type LineupSave = z.infer<typeof LineupSaveValidation>;

const lineupPlayerSelect = {id: true, first_name: true, last_name: true, username: true, active: true, ...PLAYER_PHOTO} as const;

const teamSelect = {
  team_id: true,
  team_name: true,
  founder_id1: true,
  founder_id2: true,
  teamPlayers: {select: {player: {select: lineupPlayerSelect}}},
} as const;

// "finished": a player asking for a round that is over (the route answers 403 with ROUND_FINISHED)
export async function getLineup(roundId: number, viewer: Viewer): Promise<Lineup | "finished"> {
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
      roundPlayers: {select: {player_id: true, team_id: true, player: {select: lineupPlayerSelect}}},
    },
  });
  if (!round) throw new NotFoundError("Runda ne postoji.");
  if (!lineupVisible(viewer, round)) return "finished";

  const saved = round.roundPlayers.length > 0;
  const photos = await photoContext(viewer);
  const leagueId = round.leagueRounds[0]?.league_id ?? null;

  const team = async (t: typeof round.team1): Promise<LineupTeam> => {
    const savedRows = round.roundPlayers.filter((p) => p.team_id === t.team_id);
    const savedIds = savedRows.map((p) => p.player_id);
    const roster = activeRoster(t.teamPlayers.map((tp) => tp.player));
    const pool = lineupPool(roster, savedIds, round.open);
    // a finished round also offers who played it: deactivated since, or no longer on the team
    const players = [...t.teamPlayers.map((tp) => tp.player), ...savedRows.map((p) => p.player)];
    const members = players
      .filter((p, i) => pool.includes(p.id) && players.findIndex((q) => q.id === p.id) === i)
      .map((p) => ({id: p.id, name: fullName(p), username: p.username, photo_url: photos.player(p)}))
      .sort((a, b) => a.name.localeCompare(b.name, "hr"));
    const founders = [t.founder_id1, t.founder_id2];
    // a saved lineup keeps its players (an open round's only the active ones) and is topped up from the roster
    // (saveLineup accepts as many as `needed`); a finished round without one starts from the founders, as its whole
    // roster (the old rating freeze) does
    const selected = saved || !round.open
      ? defaultLineup(pool, savedIds, founders)
      : defaultLineup(roster, await lastLineup(t.team_id, leagueId, roundId), founders);
    return {
      id: t.team_id,
      name: t.team_name,
      mine: t.teamPlayers.some((tp) => tp.player.id === viewer.id),
      members,
      selected,
      saved: savedIds,
      needed: Math.min(PLAYERS_PER_TEAM, pool.length),
    };
  };

  return {
    roundId: round.id,
    table: round.table_number,
    roundNumber: round.round_number,
    saved,
    finished: !round.open,
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
// whole (active) roster. An admin can also correct a finished round's, where the players saved for it count as on the
// roster; its ratings are replayed with the new lineup.
export async function saveLineup(roundId: number, lineup: LineupSave, {admin = false}: {admin?: boolean} = {}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({
      where: {id: roundId},
      select: {
        open: true,
        status: true,
        team1_id: true,
        team2_id: true,
        team1: {select: {teamPlayers: {select: {player: {select: savePlayerSelect}}}}},
        team2: {select: {teamPlayers: {select: {player: {select: savePlayerSelect}}}}},
        roundPlayers: {select: {player_id: true, team_id: true}},
      },
    });
    if (!round) throw new NotFoundError("Runda ne postoji.");
    if (!round.open && !admin) throw new InvalidResultError(ROUND_FINISHED);
    // the lineup is confirmed when the round is played, which waits for it to be published
    if (round.status !== "PUBLISHED") throw new InvalidResultError(ROUND_NOT_PUBLISHED);

    const savedFor = (teamId: number) => round.roundPlayers.filter((p) => p.team_id === teamId).map((p) => p.player_id);
    // a player deactivated while the screen was open: say who, instead of the count below (a finished round's saved
    // players can stay)
    const inactive = [round.team1, round.team2]
      .flatMap((t, i) => t.teamPlayers.map((tp) => ({player: tp.player, teamId: i === 0 ? round.team1_id : round.team2_id})))
      .find(({player: p, teamId}) => !p.active && lineup.teams.some((t) => t.team_id === teamId && t.player_ids.includes(p.id)) && (round.open || !savedFor(teamId).includes(p.id)))
      ?.player;
    if (inactive) {
      throw new InvalidResultError(`${displayName(inactive)} ima deaktiviran račun. Odaberi drugog igrača.`);
    }

    const rosters = new Map([
      [round.team1_id, lineupPool(activeRoster(round.team1.teamPlayers.map((tp) => tp.player)), savedFor(round.team1_id), round.open)],
      [round.team2_id, lineupPool(activeRoster(round.team2.teamPlayers.map((tp) => tp.player)), savedFor(round.team2_id), round.open)],
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
    // a finished round's ratings go to its players
    if (isRatedRound(round)) await replayRatings(tx);
  }, {timeout: 60000});
}
