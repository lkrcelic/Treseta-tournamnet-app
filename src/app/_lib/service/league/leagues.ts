import {END_DATE_ERROR, endsAfterStart, LEAGUE_NAME_TAKEN, LeagueCreateRequest, LeagueSummary, LeagueTeamDetails, LeagueUpdateRequest} from "@/app/_interfaces/league";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {conferencesError} from "@/app/_lib/conferences";
import {anyCase} from "@/app/_lib/helpers/query/anyCase";
import {pickActiveLeague} from "@/app/_lib/league";
import {generateNights, sortNights} from "@/app/_lib/nights";
import {nightValue} from "@/app/_lib/service/league/nights";
import {prisma} from "@/app/_lib/prisma";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Prisma} from "@prisma/client";
import {recalcTeamScores} from "@/app/_lib/service/admin/recalc";

const dateString = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dateValue = (d?: string | null) => (d ? new Date(`${d}T00:00:00.000Z`) : null);

// Every league, newest first, with its number of teams (the bye team is not counted), its latest round night, its
// last scheduled night and which one is being played now
export async function listLeagues(): Promise<LeagueSummary[]> {
  const [leagues, played] = await Promise.all([
    prisma.league.findMany({
      orderBy: {league_id: "desc"},
      include: {
        _count: {select: {leagueTeams: {where: {team_id: {not: BYE_TEAM_ID}}}}},
        nights: {select: {night: true}, orderBy: {night: "desc"}, take: 1},
      },
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
    smoking_tables: l.smoking_tables,
    team_count: l._count.leagueTeams,
    last_played: lastPlayed.get(l.league_id) ?? null,
    last_night: dateString(l.nights[0]?.night ?? null),
  }));
  const activeId = pickActiveLeague(rows);
  return rows.map((l) => ({...l, active: l.league_id === activeId}));
}

// The league being played now, or null when there are no leagues
export async function activeLeagueId(): Promise<number | null> {
  return (await listLeagues()).find((l) => l.active)?.league_id ?? null;
}

// Throws when another league already has this name (any case); `exceptId` is the league being renamed
async function checkLeagueNameFree(name: string, exceptId?: number): Promise<void> {
  const taken = await prisma.league.count({
    where: {league_id: exceptId != null ? {not: exceptId} : undefined, league_name: anyCase(name)},
  });
  if (taken) throw new InvalidResultError(LEAGUE_NAME_TAKEN);
}

// Creates a league with its nights and, optionally, adds existing teams to it and gives it conferences (the teams are
// put in them in Upravljanje ligom). The nights the admin left in Nova liga are kept; without a list they are every
// play day from the start to the end date. The name can't be another league's (any case), as when renaming.
export async function createLeague(req: LeagueCreateRequest): Promise<LeagueSummary> {
  await checkLeagueNameFree(req.league_name);
  const teamIds = Array.from(new Set(req.team_ids.filter((id) => id !== BYE_TEAM_ID)));
  if (teamIds.length) {
    const found = await prisma.team.count({where: {team_id: {in: teamIds}}});
    if (found !== teamIds.length) throw new InvalidResultError("Neke od ekipa ne postoje.");
  }
  const conferencesInvalid = conferencesError(req.conferences);
  if (conferencesInvalid) throw new InvalidResultError(conferencesInvalid);
  const nights = sortNights(req.nights ?? generateNights(req.start_date, req.end_date, req.play_day));

  const league = await prisma.league.create({
    data: {
      league_name: req.league_name,
      season: req.season || null,
      start_date: dateValue(req.start_date),
      end_date: dateValue(req.end_date),
      play_day: req.play_day ?? null,
      rounds_per_night: req.rounds_per_night,
      leagueTeams: {create: teamIds.map((team_id) => ({team_id}))},
      conferences: {create: req.conferences.map((c, position) => ({name: c.name.trim(), color: c.color.toUpperCase(), position}))},
      nights: {create: nights.map((night) => ({night: nightValue(night)}))},
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
    smoking_tables: league.smoking_tables,
    team_count: teamIds.length,
    last_played: null,
    last_night: nights.length ? nights[nights.length - 1] : null,
    active: false,
  };
}

export async function leagueExists(leagueId: number): Promise<boolean> {
  return (await prisma.league.count({where: {league_id: leagueId}})) > 0;
}

// Teams of a league with their players (and how many of them smoke), sorted by name
export async function listLeagueTeams(leagueId: number): Promise<LeagueTeamDetails[]> {
  const rows = await prisma.leagueTeam.findMany({
    where: {league_id: leagueId, team_id: {not: BYE_TEAM_ID}},
    include: {team: {include: {teamPlayers: {include: {player: {select: {id: true, username: true, smoker: true}}}}}}},
  });
  return rows
    .map((r) => ({
      team_id: r.team_id,
      team_name: r.team.team_name,
      active: r.active,
      conference_id: r.conference_id,
      players: r.team.teamPlayers.map((tp) => ({id: tp.player.id, username: tp.player.username})),
      smokers: r.team.teamPlayers.filter((tp) => tp.player.smoker).length,
    }))
    .sort((a, b) => a.team_name.localeCompare(b.team_name, "hr"));
}

// Changes a league's details (Upravljanje ligom · Podaci); fields left out stay as they are. The name is shown on
// standings and the league pickers, so two leagues can't share it (any case). Returns false when the league doesn't exist.
export async function updateLeague(leagueId: number, req: LeagueUpdateRequest): Promise<boolean> {
  const league = await prisma.league.findUnique({where: {league_id: leagueId}, select: {start_date: true, end_date: true}});
  if (!league) return false;
  const leagueName = req.league_name?.trim();
  if (leagueName) await checkLeagueNameFree(leagueName, leagueId);
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
  if (teamId === BYE_TEAM_ID) throw new InvalidResultError("Slobodna runda se ne može dodati u ligu.");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.leagueTeam.create({data: {league_id: leagueId, team_id: teamId}});
      await recalcTeamScores(tx, leagueId, [teamId]);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new InvalidResultError("Ekipa je već u ovoj ligi.");
      if (error.code === "P2003") throw new InvalidResultError("Ekipa ne postoji.");
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
    if (open) throw new InvalidResultError("Ekipa ima nezavršeno kolo u ovoj ligi. Prvo ga završi ili obriši.");
    await tx.leagueTeam.delete({where: {league_id_team_id: {league_id: leagueId, team_id: teamId}}});
    await tx.teamScore.deleteMany({where: {league_id: leagueId, team_id: teamId}});
    return true;
  });
}
