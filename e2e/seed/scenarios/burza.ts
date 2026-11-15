// Burza igrača: every kind of ad, open, closed by its author and expired (a substitute ad whose night has passed, a
// partner ad of a finished league). Authors are generated players, never the accounts the tests log in as, so a test
// can still post the one open AVAILABLE ad a player may have.
import type {Player} from "@prisma/client";
import {addDays, type Ctx} from "../context";
import type {BuiltLeague} from "./leagues";
import type {People} from "./people";

const SUBSTITUTE_NOTES = ["", "Igramo od 19:30, javi se.", "Treba nam netko tko zna brojati do 41 🙂", "Hitno!"];
const PARTNER_NOTES = [
  "Tražim partnera za cijelu sezonu, igram srijedom.",
  "Iskusan igrač, tražim ozbiljnu ekipu. Zvanja znam napamet.",
  "Početnik, ali brzo učim. Nazovi poslije 17 h.",
];

export async function seedBurza(ctx: Ctx, people: People, current: BuiltLeague, past: BuiltLeague) {
  const {prisma} = ctx;
  const rng = ctx.rng.fork("burza");
  const phone = () => `+385 9${rng.int(1, 9)} ${rng.int(100, 999)} ${rng.int(1000, 9999)}`;
  const rosterOf = (teamId: number) => people.rosters.get(teamId)!;
  const byId = new Map(people.players.map((p) => [p.id, p]));
  const authors = rng.shuffle(people.players.filter((p) => p.active && p.phone));
  let next = 0;
  const author = (): Player => authors[next++ % authors.length];

  const nextNight = addDays(ctx.tonight, 7);
  const lastNight = addDays(ctx.tonight, -7);
  const teams = rng.shuffle(current.teams.filter((t) => t.team_id !== people.playerTeam.team_id));

  // Treba zamjena: tonight, next week (open), last week (expired by its night), one closed by its author
  const substitute = async (key: string, night: Date, closed: boolean) => {
    const team = teams.pop()!;
    const [asker, mate] = rosterOf(team.team_id);
    const ad = await prisma.marketPost.create({
      data: {
        kind: "SUBSTITUTE",
        player_id: asker,
        league_id: current.league.league_id,
        team_id: team.team_id,
        night,
        with_player_id: mate,
        note: rng.pick(SUBSTITUTE_NOTES),
        phone: byId.get(asker)?.phone ?? phone(),
        created_at: addDays(night, -3),
        closed_at: closed ? addDays(night, -1) : null,
      },
    });
    ctx.catalog.ads[key] = {id: ad.id, kind: ad.kind, open: !closed && night >= ctx.tonight};
  };
  await substitute("substituteTonight", ctx.tonight, false);
  await substitute("substituteNextWeek", nextNight, false);
  await substitute("substituteNextWeek2", nextNight, false);
  await substitute("substituteExpired", lastNight, false);
  await substitute("substituteClosed", nextNight, true);

  // Traži partnera: on the current league (open), one closed, one on a finished league (expired)
  const partner = async (key: string, league: BuiltLeague, closed: boolean, open: boolean) => {
    const p = author();
    const ad = await prisma.marketPost.create({
      data: {
        kind: "PARTNER",
        player_id: p.id,
        league_id: league.league.league_id,
        note: rng.pick(PARTNER_NOTES),
        phone: p.phone ?? phone(),
        created_at: addDays(ctx.now, -rng.int(1, 20)),
        closed_at: closed ? addDays(ctx.now, -1) : null,
      },
    });
    ctx.catalog.ads[key] = {id: ad.id, kind: ad.kind, open};
  };
  await partner("partnerOpen", current, false, true);
  await partner("partnerOpen2", current, false, true);
  await partner("partnerClosed", current, true, false);
  await partner("partnerExpired", past, false, false);

  // Dostupan: as a substitute, as a partner, as both; the profile's phone (null) or its own
  const available = async (key: string, asSubstitute: boolean, asPartner: boolean, ownPhone: boolean, closed = false) => {
    const p = author();
    const ad = await prisma.marketPost.create({
      data: {
        kind: "AVAILABLE",
        player_id: p.id,
        as_substitute: asSubstitute,
        as_partner: asPartner,
        note: asPartner ? "Mogu i kao stalni partner." : "",
        phone: ownPhone ? phone() : null,
        created_at: addDays(ctx.now, -rng.int(1, 30)),
        closed_at: closed ? addDays(ctx.now, -1) : null,
      },
    });
    ctx.catalog.ads[key] = {id: ad.id, kind: ad.kind, open: !closed};
  };
  await available("availableSubstitute", true, false, false);
  await available("availablePartner", false, true, true);
  await available("availableBoth", true, true, false);
  await available("availableClosed", true, false, false, true);

  ctx.log(`burza: ${Object.keys(ctx.catalog.ads).length} ads`);
}
