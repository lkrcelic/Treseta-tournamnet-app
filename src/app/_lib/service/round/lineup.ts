import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {z} from "zod";
import {defaultLineup, PLAYERS_PER_TEAM} from "@/app/_lib/lineup";

// Who plays a round: two players from each team, picked on Start Game before the scoreboard opens. Ratings of the
// round go to these players (rounds without a lineup rate the whole roster).

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
  teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, username: true}}}},
} as const;

export async function getLineup(roundId: number, viewerId: number): Promise<Lineup> {
  const round = await prisma.round.findUnique({
    where: {id: roundId},
    select: {
      id: true,
      table_number: true,
      round_number: true,
      team1: {select: teamSelect},
      team2: {select: teamSelect},
      leagueRounds: {select: {league_id: true}},
      roundPlayers: {select: {player_id: true, team_id: true}},
    },
  });
  if (!round) throw new NotFoundError("Round not found.");

  const saved = round.roundPlayers.length > 0;
  const leagueId = round.leagueRounds[0]?.league_id ?? null;

  const team = async (t: typeof round.team1): Promise<LineupTeam> => {
    const members = t.teamPlayers
      .map(({player: p}) => ({id: p.id, name: `${p.first_name} ${p.last_name}`.trim(), username: p.username}))
      .sort((a, b) => a.name.localeCompare(b.name, "hr"));
    const roster = members.map((m) => m.id);
    const selected = saved
      ? round.roundPlayers.filter((p) => p.team_id === t.team_id).map((p) => p.player_id)
      : defaultLineup(roster, await lastLineup(t.team_id, leagueId, roundId), [t.founder_id1, t.founder_id2]);
    return {
      id: t.team_id,
      name: t.team_name,
      mine: roster.includes(viewerId),
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

// Saves (or replaces) the round's lineup: each team's players must be on its roster, two of them or the whole roster
export async function saveLineup(roundId: number, lineup: LineupSave): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({
      where: {id: roundId},
      select: {
        open: true,
        team1_id: true,
        team2_id: true,
        team1: {select: {teamPlayers: {select: {player_id: true}}}},
        team2: {select: {teamPlayers: {select: {player_id: true}}}},
      },
    });
    if (!round) throw new NotFoundError("Round not found.");
    if (!round.open) throw new InvalidResultError("This round is already finished.");

    const rosters = new Map([
      [round.team1_id, round.team1.teamPlayers.map((p) => p.player_id)],
      [round.team2_id, round.team2.teamPlayers.map((p) => p.player_id)],
    ]);
    const teamIds = lineup.teams.map((t) => t.team_id);
    if (new Set(teamIds).size !== 2 || !teamIds.every((id) => rosters.has(id))) {
      throw new InvalidResultError("The lineup has to be for this round's two teams.");
    }

    const rows: {round_id: number; player_id: number; team_id: number}[] = [];
    for (const {team_id, player_ids} of lineup.teams) {
      const roster = rosters.get(team_id)!;
      const ids = Array.from(new Set(player_ids));
      if (ids.length !== Math.min(PLAYERS_PER_TEAM, roster.length) || !ids.every((id) => roster.includes(id))) {
        throw new InvalidResultError(`Pick ${Math.min(PLAYERS_PER_TEAM, roster.length)} players of each team.`);
      }
      ids.forEach((player_id) => rows.push({round_id: roundId, player_id, team_id}));
    }
    if (new Set(rows.map((r) => r.player_id)).size !== rows.length) {
      throw new InvalidResultError("A player can't play for both teams.");
    }

    await tx.roundPlayer.deleteMany({where: {round_id: roundId}});
    await tx.roundPlayer.createMany({data: rows});
  });
}
