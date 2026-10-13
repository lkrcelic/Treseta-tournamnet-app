import {LeagueConferences, LeagueConferencesRequest, LeagueTeamConferencesRequest} from "@/app/_interfaces/league";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {conferenceLookup, conferencesError} from "@/app/_lib/conferences";
import {prisma} from "@/app/_lib/prisma";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Prisma} from "@prisma/client";

type ConferenceRow = LeagueConferences["conferences"][number];

// A league's conferences in order, and the teams that have one (never the bye)
export async function getLeagueConferences(leagueId: number): Promise<LeagueConferences> {
  const [conferences, teams] = await Promise.all([
    prisma.conference.findMany({
      where: {league_id: leagueId},
      orderBy: [{position: "asc"}, {conference_id: "asc"}],
      select: {conference_id: true, name: true, color: true},
    }),
    prisma.leagueTeam.findMany({
      where: {league_id: leagueId, team_id: {not: BYE_TEAM_ID}, conference_id: {not: null}},
      select: {team_id: true, conference_id: true},
    }),
  ]);
  return {conferences, teams: teams.map((t) => ({team_id: t.team_id, conference_id: t.conference_id!}))};
}

// Replaces a league's conferences with the list (Manage League · Details): a conference with an id is renamed or
// recolored, one without is created, and the league's conferences left out are deleted, so their teams have none.
// Returns false when the league doesn't exist.
export async function setLeagueConferences(leagueId: number, list: LeagueConferencesRequest["conferences"]): Promise<boolean> {
  const error = conferencesError(list);
  if (error) throw new InvalidResultError(error);
  const keep = list.flatMap((c) => (c.conference_id == null ? [] : [c.conference_id]));
  if (new Set(keep).size !== keep.length) throw new InvalidResultError("Konferencija je navedena dvaput.");

  return prisma.$transaction(async (tx) => {
    if (!(await tx.league.count({where: {league_id: leagueId}}))) return false;
    const own = new Set((await tx.conference.findMany({where: {league_id: leagueId}, select: {conference_id: true}})).map((c) => c.conference_id));
    if (keep.some((id) => !own.has(id))) throw new InvalidResultError("Konferencija nije u ovoj ligi.");

    await tx.conference.deleteMany({where: {league_id: leagueId, conference_id: {notIn: keep}}});
    for (let position = 0; position < list.length; position++) {
      const c = list[position];
      const data = {name: c.name.trim(), color: c.color.toUpperCase(), position};
      if (c.conference_id == null) await tx.conference.create({data: {...data, league_id: leagueId}});
      else await tx.conference.update({where: {conference_id: c.conference_id}, data});
    }
    return true;
  });
}

// Refuses conference ids that aren't the league's
async function checkConferences(tx: Prisma.TransactionClient, leagueId: number, ids: number[]) {
  const wanted = Array.from(new Set(ids));
  if (!wanted.length) return;
  const found = await tx.conference.count({where: {league_id: leagueId, conference_id: {in: wanted}}});
  if (found !== wanted.length) throw new InvalidResultError("Konferencija nije u ovoj ligi.");
}

// Puts a team of a league in one of the league's conferences, or in none (null). Returns false when the team is not
// in the league.
export async function setLeagueTeamConference(leagueId: number, teamId: number, conferenceId: number | null): Promise<boolean> {
  if (teamId === BYE_TEAM_ID) throw new InvalidResultError("Slobodna runda ne može biti u konferenciji.");
  return prisma.$transaction(async (tx) => {
    await checkConferences(tx, leagueId, conferenceId == null ? [] : [conferenceId]);
    const {count} = await tx.leagueTeam.updateMany({where: {league_id: leagueId, team_id: teamId}, data: {conference_id: conferenceId}});
    return count > 0;
  });
}

// Several teams' conferences at once (Manage League · "Distribute evenly"); every team must be in the league
export async function setLeagueTeamConferences(leagueId: number, teams: LeagueTeamConferencesRequest["teams"]): Promise<void> {
  if (teams.some((t) => t.team_id === BYE_TEAM_ID)) throw new InvalidResultError("Slobodna runda ne može biti u konferenciji.");
  const teamIds = Array.from(new Set(teams.map((t) => t.team_id)));
  if (teamIds.length !== teams.length) throw new InvalidResultError("Ekipa je navedena dvaput.");

  await prisma.$transaction(async (tx) => {
    await checkConferences(tx, leagueId, teams.flatMap((t) => (t.conference_id == null ? [] : [t.conference_id])));
    const inLeague = await tx.leagueTeam.count({where: {league_id: leagueId, team_id: {in: teamIds}}});
    if (inLeague !== teamIds.length) throw new InvalidResultError("Ekipa nije u ovoj ligi.");
    // one update per conference
    const byConference = new Map<number | null, number[]>();
    for (const t of teams) byConference.set(t.conference_id, [...(byConference.get(t.conference_id) ?? []), t.team_id]);
    for (const [conference_id, ids] of Array.from(byConference)) {
      await tx.leagueTeam.updateMany({where: {league_id: leagueId, team_id: {in: ids}}, data: {conference_id}});
    }
  });
}

// The conferences of a round's two teams in the round's league, team1 first (Start Game), or null when the league
// has no conferences
export async function getRoundConferences(
  roundId: number,
  team1Id: number,
  team2Id: number
): Promise<[ConferenceRow | null, ConferenceRow | null] | null> {
  const leagueRound = await prisma.leagueRound.findFirst({where: {round_id: roundId}, select: {league_id: true}});
  if (!leagueRound) return null;
  const lookup = conferenceLookup(await getLeagueConferences(leagueRound.league_id));
  if (!lookup.conferences.length) return null;
  const row = (teamId: number): ConferenceRow | null => {
    const c = lookup.of(teamId);
    return c ? {conference_id: c.id, name: c.name, color: c.color} : null;
  };
  return [row(team1Id), row(team2Id)];
}
