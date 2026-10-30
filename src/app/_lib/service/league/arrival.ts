import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {leagueClock, leagueNightString} from "@/app/_lib/dates";
import {effectiveTime} from "@/app/_lib/nights";
import {arrivalEffect, isHere, LeagueArrivalAction, leagueArrivalPhase, leagueArrivalWindow, LeagueArrivalWindow} from "@/app/_lib/leagueArrival";
import {LeagueArrivals, LeagueArrivalTimes, LeagueArrivalView, MyLeagueArrival} from "@/app/_interfaces/leagueArrival";
import {displayName} from "@/app/_lib/players/names";
import {Viewer} from "@/app/_lib/players/privacy";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";

// Potvrda dolaska in the league (DECISIONS #73): Tu smo on a night of the league that has a start time, from half an
// hour before it until 06:00; Ipak otkazujemo before the start and Odlazimo after it; and the admin's switches in Novo
// kolo, which mark a team here or not.

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

// pg_advisory_xact_lock(ARRIVAL_LOCK, leagueId): one arrival change of a league at a time. The two-number form never
// meets the league's one-number lock, which round creation holds while it pairs.
const ARRIVAL_LOCK = 7301;
const lockArrivals = (tx: Tx, leagueId: number) => tx.$executeRaw`SELECT pg_advisory_xact_lock(${ARRIVAL_LOCK}::int, ${leagueId}::int)`;

const nightValue = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const timesOf = (w: LeagueArrivalWindow): LeagueArrivalTimes => ({opens: w.opens.toISOString(), start: w.start.toISOString(), closes: w.closes.toISOString()});

// Tonight's night of the league (YYYY-MM-DD) and its window; window null when the night has no start time; null when
// the league doesn't play tonight
export async function tonightOf(leagueId: number, now = new Date(), db: Db = prisma): Promise<{night: string; window: LeagueArrivalWindow | null} | null> {
  const night = leagueNightString(now);
  const row = await db.leagueNight.findUnique({
    where: {league_id_night: {league_id: leagueId, night: nightValue(night)}},
    select: {start_time: true, league: {select: {start_time: true}}},
  });
  if (!row) return null;
  return {night, window: leagueArrivalWindow(night, effectiveTime(row.start_time, row.league.start_time))};
}

const arrivalSelect = {
  league_id: true,
  team_id: true,
  arrived_at: true,
  by_admin: true,
  left_at: true,
  left_by_admin: true,
  arriver: {select: {first_name: true, last_name: true}},
} as const;
type ArrivalRow = Prisma.LeagueArrivalGetPayload<{select: typeof arrivalSelect}>;

function view(r: ArrivalRow): LeagueArrivalView {
  return {
    here: isHere(r),
    arrived_at: r.arrived_at.toISOString(),
    by: r.arriver ? displayName(r.arriver) : null,
    by_admin: r.by_admin,
    left_at: r.left_at?.toISOString() ?? null,
    left_by_admin: r.left_by_admin,
  };
}

// Početna · Večeras for the player's teams whose league plays tonight with Potvrda dolaska (start: the night's start
// time, "HH:MM"): the window and the team's arrival. Keyed "league_id|team_id"; a night that is over isn't in it.
export async function myTonight(entries: {league_id: number; team_id: number; start: string | null}[], now = new Date(), db: Db = prisma): Promise<Map<string, MyLeagueArrival>> {
  const night = leagueNightString(now);
  const open = entries
    .map((e) => ({...e, window: leagueArrivalWindow(night, e.start)}))
    .filter((e): e is typeof e & {window: LeagueArrivalWindow} => e.window != null && leagueArrivalPhase(e.window, now) !== "over");
  if (open.length === 0) return new Map();
  const rows = await db.leagueArrival.findMany({
    where: {night: nightValue(night), OR: open.map((e) => ({league_id: e.league_id, team_id: e.team_id}))},
    select: arrivalSelect,
  });
  const key = (leagueId: number, teamId: number) => `${leagueId}|${teamId}`;
  const arrivals = new Map(rows.map((r) => [key(r.league_id, r.team_id), r]));
  return new Map(
    open.map((e) => {
      const row = arrivals.get(key(e.league_id, e.team_id));
      return [key(e.league_id, e.team_id), {night, ...timesOf(e.window), arrival: row ? view(row) : null}];
    })
  );
}

// A player's button for one of their teams tonight: Tu smo (confirm), or Ipak otkazujemo before the start and Odlazimo
// after it (leave). Any of the team's players presses it for the whole team. Answers with the team's card.
export async function teamArrivalAction(leagueId: number, teamId: number, viewer: Viewer, action: LeagueArrivalAction): Promise<MyLeagueArrival> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await lockArrivals(tx, leagueId);
    const member = await tx.leagueTeam.count({where: {league_id: leagueId, team_id: teamId, team: {teamPlayers: {some: {player_id: viewer.id}}}}});
    if (member === 0) throw new NotFoundError("Tvoja ekipa nije u ovoj ligi.");
    const tonight = await tonightOf(leagueId, now, tx);
    if (!tonight) throw new InvalidResultError("Večeras se ova liga ne igra.");
    if (!tonight.window) throw new InvalidResultError("Večer nema vrijeme početka, pa nema ni potvrde dolaska.");
    const night = nightValue(tonight.night);
    const key = {league_id_night_team_id: {league_id: leagueId, night, team_id: teamId}};
    const row = await tx.leagueArrival.findUnique({where: key, select: {left_at: true}});
    const effect = arrivalEffect(leagueArrivalPhase(tonight.window, now), action, isHere(row));
    if (effect === "not_open") throw new InvalidResultError(`Potvrda dolaska otvara se u ${leagueClock(tonight.window.opens)}.`);
    if (effect === "over") throw new InvalidResultError("Večer je završila.");
    if (effect === "arrive") {
      const data = {arrived_at: now, arrived_by: viewer.id, by_admin: false, left_at: null, left_by_admin: false};
      await tx.leagueArrival.upsert({where: key, create: {league_id: leagueId, night, team_id: teamId, ...data}, update: data});
    } else if (effect === "withdraw") {
      await tx.leagueArrival.delete({where: key});
    } else if (effect === "leave") {
      await tx.leagueArrival.update({where: key, data: {left_at: now, left_by_admin: false}});
    }
    return myTonightFor(tx, leagueId, teamId, tonight.night, tonight.window);
  });
}

// The card of one team (after its button), read inside the button's transaction
async function myTonightFor(tx: Tx, leagueId: number, teamId: number, night: string, window: LeagueArrivalWindow): Promise<MyLeagueArrival> {
  const row = await tx.leagueArrival.findUnique({where: {league_id_night_team_id: {league_id: leagueId, night: nightValue(night), team_id: teamId}}, select: arrivalSelect});
  return {night, ...timesOf(window), arrival: row ? view(row) : null};
}

// The admin's Novo kolo: tonight's window (null: the league doesn't play tonight, or the night has no start time) and
// the arrival of every team that came
export async function leagueArrivals(leagueId: number, now = new Date(), db: Db = prisma): Promise<LeagueArrivals> {
  const tonight = await tonightOf(leagueId, now, db);
  const night = tonight?.night ?? leagueNightString(now);
  if (!tonight?.window) return {night, window: null, teams: {}};
  const rows = await db.leagueArrival.findMany({where: {league_id: leagueId, night: nightValue(night)}, select: arrivalSelect});
  return {night, window: timesOf(tonight.window), teams: Object.fromEntries(rows.map((r) => [r.team_id, view(r)]))};
}

// The admin's switches in Novo kolo (a team's own, or Označi sve) on a night with Potvrda dolaska, at any time of that
// night: here marks the teams arrived (a team already here keeps its own Tu smo), not here takes them out of the next
// Novo kolo as if they had left. Answers with the night's arrivals.
export async function setArrivals(leagueId: number, teamIds: number[], here: boolean, now = new Date()): Promise<LeagueArrivals> {
  const ids = Array.from(new Set(teamIds));
  await prisma.$transaction(async (tx) => {
    await lockArrivals(tx, leagueId);
    const tonight = await tonightOf(leagueId, now, tx);
    if (!tonight?.window) throw new InvalidResultError("Večeras u ovoj ligi nema potvrde dolaska.");
    const inLeague = await tx.leagueTeam.count({where: {league_id: leagueId, team_id: {in: ids}}});
    if (inLeague !== ids.length) throw new InvalidResultError("Sve ekipe moraju biti iz ove lige.");
    const night = nightValue(tonight.night);
    const rows = await tx.leagueArrival.findMany({where: {league_id: leagueId, night, team_id: {in: ids}}, select: {team_id: true, left_at: true}});
    const byTeam = new Map(rows.map((r) => [r.team_id, r]));
    for (const teamId of ids) {
      const row = byTeam.get(teamId);
      const key = {league_id_night_team_id: {league_id: leagueId, night, team_id: teamId}};
      if (here) {
        if (isHere(row)) continue;
        const data = {arrived_at: now, arrived_by: null, by_admin: true, left_at: null, left_by_admin: false};
        await tx.leagueArrival.upsert({where: key, create: {league_id: leagueId, night, team_id: teamId, ...data}, update: data});
      } else if (isHere(row)) {
        await tx.leagueArrival.update({where: key, data: {left_at: now, left_by_admin: true}});
      }
    }
  });
  return leagueArrivals(leagueId, now);
}
