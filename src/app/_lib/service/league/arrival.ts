import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {leagueClock, leagueNightString} from "@/app/_lib/dates";
import {effectiveTime} from "@/app/_lib/nights";
import {arrivalEffect, asksAdmin, isHere, LeagueArrivalAction, lastRoundOut, leagueArrivalPhase, leagueArrivalWindow, LeagueArrivalWindow} from "@/app/_lib/leagueArrival";
import {isSlot, Slot} from "@/app/_lib/locations";
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
    select: {start_time: true, gathering_time: true, league: {select: {start_time: true, gathering_time: true}}},
  });
  if (!row) return null;
  return {night, window: leagueArrivalWindow(night, effectiveTime(row.start_time, row.league.start_time), effectiveTime(row.gathering_time, row.league.gathering_time))};
}

const teamKey = (leagueId: number, teamId: number) => `${leagueId}|${teamId}`;
const placeKey = (leagueId: number, slot: Slot | null) => `${leagueId}|${slot ?? 0}`;

// Liga na dvije lokacije: the leagues whose night is played at two places, and each team's place there ("league_id|
// team_id" → 1 or 2; a team without one isn't assigned yet). A one-place night has no places of teams.
async function tonightPlaces(entries: {league_id: number; team_id: number}[], night: string, db: Db): Promise<{two: Set<number>; slots: Map<string, Slot>}> {
  const leagueIds = Array.from(new Set(entries.map((e) => e.league_id)));
  if (leagueIds.length === 0) return {two: new Set(), slots: new Map()};
  const twoPlace = await db.leagueNight.findMany({
    where: {league_id: {in: leagueIds}, night: nightValue(night), second_location_id: {not: null}},
    select: {league_id: true},
  });
  const two = new Set(twoPlace.map((n) => n.league_id));
  const asked = entries.filter((e) => two.has(e.league_id));
  const rows = asked.length
    ? await db.leagueNightTeam.findMany({where: {night: nightValue(night), OR: asked.map((e) => ({league_id: e.league_id, team_id: e.team_id}))}, select: {league_id: true, team_id: true, slot: true}})
    : [];
  return {two, slots: new Map(rows.flatMap((r) => (isSlot(r.slot) ? [[teamKey(r.league_id, r.team_id), r.slot] as [string, Slot]] : [])))};
}

// The places whose last round of the night (Kola po večeri) is published, as "league_id|slot" (0: a one-place night,
// counting every round of the league that night): Tu smo can't bring a team in there any more. Each place of a
// two-place night counts its own rounds.
async function lastRoundPlaces(places: {league_id: number; slot: Slot | null}[], night: string, db: Db): Promise<Set<string>> {
  const ids = Array.from(new Set(places.map((p) => p.league_id)));
  if (ids.length === 0) return new Set();
  const [leagues, rounds] = await Promise.all([
    db.league.findMany({where: {league_id: {in: ids}}, select: {league_id: true, rounds_per_night: true}}),
    db.leagueRound.findMany({
      where: {league_id: {in: ids}, round: {round_date: nightValue(night), status: "PUBLISHED"}},
      select: {league_id: true, round: {select: {round_number: true, location_slot: true}}},
    }),
  ]);
  const perNight = new Map(leagues.map((l) => [l.league_id, l.rounds_per_night]));
  const out = new Set<string>();
  for (const p of places) {
    const numbers = new Set(rounds.filter((r) => r.league_id === p.league_id && (p.slot == null || r.round.location_slot === p.slot)).map((r) => r.round.round_number));
    if (lastRoundOut(numbers.size, perNight.get(p.league_id) ?? Number.MAX_SAFE_INTEGER)) out.add(placeKey(p.league_id, p.slot));
  }
  return out;
}

// Tu smo refused: the night has two places and the team isn't at either yet
export const NO_PLACE_ERROR = "Večeras se igra na dvije lokacije, a vaša ekipa još nije raspoređena. Javi se adminu.";

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

// Početna · Večeras for the player's teams whose league plays tonight with Potvrda dolaska (start and gathering: the
// night's Početak and Okupljanje, "HH:MM"): the window and the team's arrival. Keyed "league_id|team_id"; a night that
// is over isn't in it.
export async function myTonight(
  entries: {league_id: number; team_id: number; start: string | null; gathering?: string | null}[],
  now = new Date(),
  db: Db = prisma
): Promise<Map<string, MyLeagueArrival>> {
  const night = leagueNightString(now);
  const open = entries
    .map((e) => ({...e, window: leagueArrivalWindow(night, e.start, e.gathering)}))
    .filter((e): e is typeof e & {window: LeagueArrivalWindow} => e.window != null && leagueArrivalPhase(e.window, now) !== "over");
  if (open.length === 0) return new Map();
  const [rows, places] = await Promise.all([
    db.leagueArrival.findMany({
      where: {night: nightValue(night), OR: open.map((e) => ({league_id: e.league_id, team_id: e.team_id}))},
      select: arrivalSelect,
    }),
    tonightPlaces(open, night, db),
  ]);
  const slotOf = (e: {league_id: number; team_id: number}) => places.slots.get(teamKey(e.league_id, e.team_id)) ?? null;
  const last = await lastRoundPlaces(open.map((e) => ({league_id: e.league_id, slot: slotOf(e)})), night, db);
  const arrivals = new Map(rows.map((r) => [teamKey(r.league_id, r.team_id), r]));
  return new Map(
    open.map((e) => {
      const row = arrivals.get(teamKey(e.league_id, e.team_id));
      const slot = slotOf(e);
      const card: MyLeagueArrival = {
        night,
        ...timesOf(e.window),
        arrival: row ? view(row) : null,
        last_round: last.has(placeKey(e.league_id, slot)),
        two_places: places.two.has(e.league_id),
        slot,
      };
      return [teamKey(e.league_id, e.team_id), card];
    })
  );
}

// A player's button for one of their teams tonight: Tu smo (confirm), or Ipak otkazujemo before the start and Odlazimo
// after it (leave). Any of the team's players presses it for the whole team. On a night with two places only a team
// that Podjela put at one of them can press Tu smo. Answers with the team's card.
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
    const places = await tonightPlaces([{league_id: leagueId, team_id: teamId}], tonight.night, tx);
    const slot = places.slots.get(teamKey(leagueId, teamId)) ?? null;
    const lastRound = action === "confirm" && (await lastRoundPlaces([{league_id: leagueId, slot}], tonight.night, tx)).has(placeKey(leagueId, slot));
    const effect = arrivalEffect(leagueArrivalPhase(tonight.window, now), action, isHere(row), lastRound, asksAdmin(places.two.has(leagueId), slot));
    if (effect === "no_place") throw new InvalidResultError(NO_PLACE_ERROR);
    if (effect === "not_open") throw new InvalidResultError(`Potvrda dolaska otvara se u ${leagueClock(tonight.window.opens)}.`);
    if (effect === "over") throw new InvalidResultError("Večer je završila.");
    if (effect === "last_round") throw new InvalidResultError("Zadnje kolo večeri je već počelo: više se ne može uskočiti.");
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
  const [row, places] = await Promise.all([
    tx.leagueArrival.findUnique({where: {league_id_night_team_id: {league_id: leagueId, night: nightValue(night), team_id: teamId}}, select: arrivalSelect}),
    tonightPlaces([{league_id: leagueId, team_id: teamId}], night, tx),
  ]);
  const slot = places.slots.get(teamKey(leagueId, teamId)) ?? null;
  const last = await lastRoundPlaces([{league_id: leagueId, slot}], night, tx);
  return {night, ...timesOf(window), arrival: row ? view(row) : null, last_round: last.has(placeKey(leagueId, slot)), two_places: places.two.has(leagueId), slot};
}

// The admin's Novo kolo: tonight's window (null: the league doesn't play tonight, or the night has no start time) and
// the arrival of every team that came. slot: on a night with two places, only the teams Podjela put at that place (a
// team that moved counts where it is now); on a one-place night it changes nothing.
export async function leagueArrivals(leagueId: number, now = new Date(), db: Db = prisma, slot?: Slot): Promise<LeagueArrivals> {
  const tonight = await tonightOf(leagueId, now, db);
  const night = tonight?.night ?? leagueNightString(now);
  if (!tonight?.window) return {night, window: null, teams: {}};
  const rows = await db.leagueArrival.findMany({where: {league_id: leagueId, night: nightValue(night)}, select: arrivalSelect});
  let shown = rows;
  if (slot != null) {
    const places = await tonightPlaces(rows, night, db);
    if (places.two.has(leagueId)) shown = rows.filter((r) => places.slots.get(teamKey(leagueId, r.team_id)) === slot);
  }
  return {night, window: timesOf(tonight.window), teams: Object.fromEntries(shown.map((r) => [r.team_id, view(r)]))};
}

// The admin's switches in Novo kolo (a team's own, or Označi sve) on a night with Potvrda dolaska, at any time of that
// night: here marks the teams arrived (a team already here keeps its own Tu smo), not here takes them out of the next
// Novo kolo as if they had left. Answers with the night's arrivals (slot: at that place, as leagueArrivals).
export async function setArrivals(leagueId: number, teamIds: number[], here: boolean, now = new Date(), slot?: Slot): Promise<LeagueArrivals> {
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
  return leagueArrivals(leagueId, now, prisma, slot);
}
