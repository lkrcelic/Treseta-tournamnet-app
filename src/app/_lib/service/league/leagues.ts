import {END_DATE_ERROR, endsAfterStart, LeagueCreateRequest, LeagueSummary, LeagueTeamDetails, LeagueUpdateRequest} from "@/app/_interfaces/league";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {pickActiveLeague} from "@/app/_lib/league";
import {prisma} from "@/app/_lib/prisma";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Prisma} from "@prisma/client";
import {recalcTeamScores} from "@/app/_lib/service/admin/recalc";

const dateString = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dateValue = (d?: string | null) => (d ? new Date(`${d}T00:00:00.000Z`) : null);

// Every league, newest first, with its number of teams (the bye team is not counted), its latest round night
// and which one is being played now
export async function listLeagues(): Promise<LeagueSummary[]> {
  const [leagues, played] = await Promise.all([
    prisma.league.findMany({
      orderBy: {league_id: "desc"},
      include: {_count: {select: {leagueTeams: {where: {team_id: {not: BYE_TEAM_ID}}}}}},
    }),
    prisma.$queryRaw<{league_id: number; last_played: Date | null}[]>`
        SELECT lr.league_id, MAX(r.round_date) AS last_played
        FROM "LeagueRound" lr
                 JOIN "Round" r ON r.id = lr.round_id
        GROUP BY lr.league_id
    `,
  ]);
  const lastPlayed = new Map(played.map((p) => [p.league_id, dateString(p.last_played)]));
  const rows = leagues.map((l) => ({
    league_id: l.league_id,
    league_name: l.league_name,
    season: l.season,
    start_date: dateString(l.start_date),
    end_date: dateString(l.end_date),
    play_day: l.play_day,
    rounds_per_night: l.rounds_per_night,
    team_count: l._count.leagueTeams,
    last_played: lastPlayed.get(l.league_id) ?? null,
  }));
  const activeId = pickActiveLeague(rows);
  return rows.map((l) => ({...l, active: l.league_id === activeId}));
}

// The league being played now, or null when there are no leagues
export async function activeLeagueId(): Promise<number | null> {
  return (await listLeagues()).find((l) => l.active)?.league_id ?? null;
}

// Creates a league and, optionally, adds existing teams to it
export async function createLeague(req: LeagueCreateRequest): Promise<LeagueSummary> {
  const teamIds = Array.from(new Set(req.team_ids.filter((id) => id !== BYE_TEAM_ID)));
  if (teamIds.length) {
    const found = await prisma.team.count({where: {team_id: {in: teamIds}}});
    if (found !== teamIds.length) throw new InvalidResultError("Some of the teams don't exist.");
  }

  const league = await prisma.league.create({
    data: {
      league_name: req.league_name,
      season: req.season || null,
      start_date: dateValue(req.start_date),
      end_date: dateValue(req.end_date),
      play_day: req.play_day ?? null,
      rounds_per_night: req.rounds_per_night,
      leagueTeams: {create: teamIds.map((team_id) => ({team_id}))},
    },
  });

  return {
    league_id: league.league_id,
    league_name: league.league_name,
    season: league.season,
    start_date: dateString(league.start_date),
    end_date: dateString(league.end_date),
    play_day: league.play_day,
    rounds_per_night: league.rounds_per_night,
    team_count: teamIds.length,
    last_played: null,
    active: false,
  };
}

export async function leagueExists(leagueId: number): Promise<boolean> {
  return (await prisma.league.count({where: {league_id: leagueId}})) > 0;
}

// Teams of a league with their players, sorted by name
export async function listLeagueTeams(leagueId: number): Promise<LeagueTeamDetails[]> {
  const rows = await prisma.leagueTeam.findMany({
    where: {league_id: leagueId, team_id: {not: BYE_TEAM_ID}},
    include: {team: {include: {teamPlayers: {include: {player: {select: {id: true, username: true}}}}}}},
  });
  return rows
    .map((r) => ({
      team_id: r.team_id,
      team_name: r.team.team_name,
      active: r.active,
      players: r.team.teamPlayers.map((tp) => tp.player),
    }))
    .sort((a, b) => a.team_name.localeCompare(b.team_name, "hr"));
}

// Changes a league's details (Manage League · Details); fields left out stay as they are. The name is shown on
// standings and the league pickers, so two leagues can't share it (any case). Returns false when the league doesn't exist.
export async function updateLeague(leagueId: number, req: LeagueUpdateRequest): Promise<boolean> {
  const league = await prisma.league.findUnique({where: {league_id: leagueId}, select: {start_date: true, end_date: true}});
  if (!league) return false;
  const leagueName = req.league_name?.trim();
  if (leagueName) {
    const taken = await prisma.league.count({
      where: {league_id: {not: leagueId}, league_name: {equals: leagueName, mode: "insensitive"}},
    });
    if (taken) throw new InvalidResultError("Another league already has this name.");
  }
  const start = req.start_date !== undefined ? req.start_date : dateString(league.start_date);
  const end = req.end_date !== undefined ? req.end_date : dateString(league.end_date);
  if (!endsAfterStart(start, end)) throw new InvalidResultError(END_DATE_ERROR);

  await prisma.league.update({
    where: {league_id: leagueId},
    data: {
      league_name: leagueName,
      season: req.season === undefined ? undefined : req.season || null,
      start_date: req.start_date === undefined ? undefined : dateValue(req.start_date),
      end_date: req.end_date === undefined ? undefined : dateValue(req.end_date),
      play_day: req.play_day,
      rounds_per_night: req.rounds_per_night,
    },
  });
  return true;
}

// The admins' notes of a league, or null when the league doesn't exist
export async function getLeagueNotes(leagueId: number): Promise<string | null> {
  const league = await prisma.league.findUnique({where: {league_id: leagueId}, select: {notes: true}});
  return league?.notes ?? null;
}

// Returns false when the league doesn't exist
export async function setLeagueNotes(leagueId: number, notes: string): Promise<boolean> {
  const {count} = await prisma.league.updateMany({where: {league_id: leagueId}, data: {notes}});
  return count > 0;
}

// Adds an existing team to a league (active). Adding a team that is already there is refused. A team that was in the
// league before gets its season row back from its closed rounds.
export async function addTeamToLeague(leagueId: number, teamId: number): Promise<void> {
  if (teamId === BYE_TEAM_ID) throw new InvalidResultError("The bye team can't be added.");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.leagueTeam.create({data: {league_id: leagueId, team_id: teamId}});
      await recalcTeamScores(tx, leagueId, [teamId]);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new InvalidResultError("The team is already in this league.");
      if (error.code === "P2003") throw new InvalidResultError("The team doesn't exist.");
    }
    throw error;
  }
}

// Marks a team of a league active or inactive. Returns false when the team is not in the league.
export async function setLeagueTeamActive(leagueId: number, teamId: number, active: boolean): Promise<boolean> {
  const {count} = await prisma.leagueTeam.updateMany({where: {league_id: leagueId, team_id: teamId}, data: {active}});
  return count > 0;
}

// Takes a team out of a league: it leaves the league's standings and team lists. Its rounds stay, so its opponents keep
// their results; the team itself and its players stay in the app. A team with an unfinished round in the league can't
// be removed. Returns false when the team is not in the league.
export async function removeTeamFromLeague(leagueId: number, teamId: number): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const inLeague = await tx.leagueTeam.count({where: {league_id: leagueId, team_id: teamId}});
    if (!inLeague) return false;
    const open = await tx.round.count({
      where: {open: true, OR: [{team1_id: teamId}, {team2_id: teamId}], leagueRounds: {some: {league_id: leagueId}}},
    });
    if (open) throw new InvalidResultError("The team has an unfinished round in this league. Finish or delete it first.");
    await tx.leagueTeam.delete({where: {league_id_team_id: {league_id: leagueId, team_id: teamId}}});
    await tx.teamScore.deleteMany({where: {league_id: leagueId, team_id: teamId}});
    return true;
  });
}
