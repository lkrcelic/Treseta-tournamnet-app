import {inDraftWarning, NightSplit, SPLIT_NOT_IN_LEAGUE, SPLIT_ONE_PLACE, SPLIT_PAST_NIGHT, SplitMove, SplitResult} from "@/app/_interfaces/split";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {leagueNightString} from "@/app/_lib/dates";
import {byTeamName, isSlot, Slot} from "@/app/_lib/locations";
import {effectiveLocation, LOCATION_SELECT, secondLocationOf} from "@/app/_lib/nights";
import {prisma} from "@/app/_lib/prisma";
import {lockLeague} from "@/app/_lib/service/admin/tables";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Prisma} from "@prisma/client";

// Podjela (LOCATIONS_PLAN.md, decisions 8–11): on a night played at two places, the admin puts each team at one of
// them. A team without a row is Neraspoređena. A move counts from the next Kolo: a published table stays where it is,
// and a team's Tu smo stays confirmed. A team still in a Skica of the place it left isn't taken out of it; the admin
// is told.

type Db = Prisma.TransactionClient | typeof prisma;

const nightValue = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// A night's two places, or null for a night that has one (or none)
async function nightPlaces(db: Db, leagueId: number, night: Date) {
  const row = await db.leagueNight.findUnique({
    where: {league_id_night: {league_id: leagueId, night}},
    select: {location: LOCATION_SELECT, secondLocation: LOCATION_SELECT, league: {select: {location: LOCATION_SELECT}}},
  });
  if (!row) return undefined;
  const first = effectiveLocation(row, row.league);
  const second = secondLocationOf(row);
  return first && second ? ([first, second] as [typeof first, typeof second]) : null;
}

// The night's Podjela as Upravljanje ligom shows it; null when the league doesn't have that night
export async function nightSplit(leagueId: number, date: string, db: Db = prisma): Promise<NightSplit | null> {
  const night = nightValue(date);
  const places = await nightPlaces(db, leagueId, night);
  if (places === undefined) return null;
  const [teams, rows, conferences] = await Promise.all([
    db.leagueTeam.findMany({
      where: {league_id: leagueId, team_id: {not: BYE_TEAM_ID}},
      select: {team_id: true, active: true, conference_id: true, team: {select: {team_name: true}}},
    }),
    db.leagueNightTeam.findMany({where: {league_id: leagueId, night}, select: {team_id: true, slot: true}}),
    db.conference.findMany({where: {league_id: leagueId}, select: {conference_id: true, name: true, color: true, position: true}, orderBy: [{position: "asc"}, {conference_id: "asc"}]}),
  ]);
  // a one-place night has no Podjela, whatever rows are left
  const slotOf = new Map(places ? rows.filter((r) => isSlot(r.slot)).map((r) => [r.team_id, r.slot as Slot]) : []);
  return {
    date,
    places,
    teams: teams
      .map((t) => ({team_id: t.team_id, name: t.team.team_name, active: t.active, conference_id: t.conference_id, slot: slotOf.get(t.team_id) ?? null}))
      .sort(byTeamName),
    conferences,
  };
}

// Moves teams on a night's Podjela (slot null: back to Neraspoređene). Only a two-place night that isn't over (tonight
// until 06:00 counts). Returns the Podjela as saved and a warning for every team that left a place where it is in a
// Skica; null when the league doesn't have that night.
export async function setNightSplit(leagueId: number, date: string, moves: SplitMove[]): Promise<SplitResult | null> {
  const night = nightValue(date);
  return prisma.$transaction(async (tx) => {
    // Novo kolo and publishing hold the same lock, so a team doesn't move while its place's tables are made
    await lockLeague(tx, leagueId);
    const places = await nightPlaces(tx, leagueId, night);
    if (places === undefined) return null;
    if (places === null) throw new InvalidResultError(SPLIT_ONE_PLACE);
    if (date < leagueNightString()) throw new InvalidResultError(SPLIT_PAST_NIGHT);

    // the last move of a team counts
    const wanted = new Map(moves.map((m) => [m.team_id, m.slot]));
    const ids = Array.from(wanted.keys());
    const inLeague = await tx.leagueTeam.findMany({where: {league_id: leagueId, team_id: {in: ids}}, select: {team_id: true, team: {select: {team_name: true}}}});
    if (inLeague.length !== ids.length || ids.includes(BYE_TEAM_ID)) throw new InvalidResultError(SPLIT_NOT_IN_LEAGUE);
    const names = new Map(inLeague.map((t) => [t.team_id, t.team.team_name]));

    const before = new Map(
      (await tx.leagueNightTeam.findMany({where: {league_id: leagueId, night, team_id: {in: ids}}, select: {team_id: true, slot: true}})).map((r) => [r.team_id, r.slot])
    );
    // the place each moved team left
    const left: {teamId: number; slot: number}[] = [];
    for (const [teamId, slot] of Array.from(wanted)) {
      const was = before.get(teamId);
      if (was === (slot ?? undefined)) continue;
      if (was != null) left.push({teamId, slot: was});
      if (slot == null) await tx.leagueNightTeam.delete({where: {league_id_night_team_id: {league_id: leagueId, night, team_id: teamId}}});
      else
        await tx.leagueNightTeam.upsert({
          where: {league_id_night_team_id: {league_id: leagueId, night, team_id: teamId}},
          create: {league_id: leagueId, night, team_id: teamId, slot},
          update: {slot, moved_at: new Date()},
        });
    }

    // a Skica of the place left still has the team: it stays there until the admin discards that Skica
    const warnings: string[] = [];
    for (const {teamId, slot} of left) {
      const inDraft = await tx.round.count({
        where: {
          round_date: night,
          status: {not: "PUBLISHED"},
          location_slot: slot,
          leagueRounds: {some: {league_id: leagueId}},
          OR: [{team1_id: teamId}, {team2_id: teamId}],
        },
      });
      if (inDraft) warnings.push(inDraftWarning(names.get(teamId) ?? "", places[slot - 1].name));
    }

    const split = await nightSplit(leagueId, date, tx);
    return {split: split!, warnings};
  });
}
