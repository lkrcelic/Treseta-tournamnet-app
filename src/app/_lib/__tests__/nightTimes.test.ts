import assert from "node:assert/strict";
import {test} from "node:test";
import {
  LeagueCreateRequestValidation,
  LeagueNightAddRequestValidation,
  LeagueNightUpdateRequestValidation,
  LeagueUpdateRequestValidation,
  LOCATION_NAME_REQUIRED,
  LOCATION_URL_ERROR,
  PAST_NIGHT_ERROR,
  START_TIME_ERROR,
} from "../../_interfaces/league";
import {leagueDateString} from "../dates";
import {effectiveLocation, effectiveTime, exceptionLabel, gatheringLabel, isSafeUrl, isStartTime, nightTimeLabel, ownTimeOf, sameLocation, timeLabel} from "../nights";
import {zodMessage} from "../validation/zodMessage";

// When a league night starts (Raspored, Početna, Upravljanje ligom · Podaci and Datumi)

test("a start time is a wall-clock HH:MM from 00:00 to 23:59", () => {
  for (const t of ["00:00", "07:05", "19:30", "20:00", "23:59"]) assert.equal(isStartTime(t), true, t);
  for (const t of ["24:00", "23:60", "7:30", "19:3", "19.30", "1930", "19:30:00", " 19:30", "", "ab:cd"]) assert.equal(isStartTime(t), false, t);
});

test("a night starts at its own time, else the league's, else at none", () => {
  assert.equal(effectiveTime("19:30", "20:00"), "19:30");
  assert.equal(effectiveTime(null, "20:00"), "20:00");
  assert.equal(effectiveTime(undefined, "20:00"), "20:00");
  assert.equal(effectiveTime("19:30", null), "19:30");
  assert.equal(effectiveTime(null, null), null);
});

test("a night's label gives its time after the date, or only the date", () => {
  assert.equal(nightTimeLabel("2026-10-14", "19:00"), "sri 14. 10. · 19:00");
  assert.equal(nightTimeLabel("2026-10-14", null), "sri 14. 10.");
  assert.equal(nightTimeLabel("2026-10-14", undefined), "sri 14. 10.");
  assert.equal(timeLabel("20:00"), "20:00");
  assert.equal(timeLabel(null), "—");
});

const message = (result: {success: boolean; error?: Parameters<typeof zodMessage>[0]}) => (result.error ? zodMessage(result.error, "fallback") : null);

test("the server takes an optional HH:MM start time for the league and its nights, in Croatian when it's wrong", () => {
  assert.equal(LeagueCreateRequestValidation.safeParse({league_name: "Jesen"}).success, true);
  assert.equal(LeagueCreateRequestValidation.parse({league_name: "Jesen", start_time: "20:00"}).start_time, "20:00");
  assert.equal(LeagueCreateRequestValidation.parse({league_name: "Jesen", start_time: null}).start_time, null);
  assert.equal(message(LeagueCreateRequestValidation.safeParse({league_name: "Jesen", start_time: "25:00"})), START_TIME_ERROR);
  assert.equal(message(LeagueCreateRequestValidation.safeParse({league_name: "Jesen", start_time: 2000})), START_TIME_ERROR);

  assert.equal(LeagueUpdateRequestValidation.parse({start_time: null}).start_time, null);
  assert.equal(LeagueUpdateRequestValidation.parse({}).start_time, undefined);
  assert.equal(message(LeagueUpdateRequestValidation.safeParse({start_time: ""})), START_TIME_ERROR);

  assert.equal(LeagueNightAddRequestValidation.parse({date: "2026-10-14"}).start_time, undefined);
  assert.equal(LeagueNightAddRequestValidation.parse({date: "2026-10-14", start_time: "19:30"}).start_time, "19:30");
  assert.equal(message(LeagueNightAddRequestValidation.safeParse({date: "2026-10-14", start_time: "19:30:00"})), START_TIME_ERROR);

  // null takes the night back to the league's time; a body with neither a time nor a place changes nothing
  assert.equal(LeagueNightUpdateRequestValidation.parse({start_time: null}).start_time, null);
  assert.equal(LeagueNightUpdateRequestValidation.safeParse({}).success, false);
  assert.equal(message(LeagueNightUpdateRequestValidation.safeParse({})), "Nema promjene.");
  assert.equal(message(LeagueNightUpdateRequestValidation.safeParse({start_time: "8:00"})), START_TIME_ERROR);
});

// Where a league night is played (Okupljanje: Nova liga, Podaci, Datumi, Raspored, Početna)

const NO_PLACE = {location_name: null, location_address: null, location_url: null};
const KARTAS = {location_name: "Caffe bar Kartaš", location_address: "Ilica 128, Zagreb", location_url: "https://maps.app.goo.gl/abc"};

test("a night is played at its own place, else the league's, else nowhere", () => {
  const own = {location_name: "Klub Adut", location_address: null, location_url: null};
  // its own place takes all three fields from the night, even without an address or a link
  assert.deepEqual(effectiveLocation(own, KARTAS), {name: "Klub Adut", address: null, url: null});
  assert.deepEqual(effectiveLocation(NO_PLACE, KARTAS), {name: "Caffe bar Kartaš", address: "Ilica 128, Zagreb", url: "https://maps.app.goo.gl/abc"});
  // a night's address without a name isn't a place of its own
  assert.deepEqual(effectiveLocation({...NO_PLACE, location_address: "Negdje 1"}, KARTAS)?.address, "Ilica 128, Zagreb");
  assert.equal(effectiveLocation(NO_PLACE, NO_PLACE), null);
  assert.equal(effectiveLocation(NO_PLACE, {...NO_PLACE, location_address: "Ilica 128"}), null);
});

test("the gathering label gives the time and the place, either one, or nothing", () => {
  const place = {name: "Caffe bar Kartaš", address: null, url: null};
  assert.equal(gatheringLabel("19:30", place), "19:30 · Caffe bar Kartaš");
  assert.equal(gatheringLabel("19:30", null), "19:30");
  assert.equal(gatheringLabel(null, place), "Caffe bar Kartaš");
  assert.equal(gatheringLabel(null, null), null);
});

test("only http(s) links are shown as links", () => {
  assert.equal(isSafeUrl("https://maps.app.goo.gl/abc"), true);
  assert.equal(isSafeUrl("http://maps.google.com/?q=Ilica"), true);
  assert.equal(isSafeUrl("HTTPS://x.hr"), true);
  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("maps.app.goo.gl/abc"), false);
  assert.equal(isSafeUrl(""), false);
  assert.equal(isSafeUrl(null), false);
});

test("the server takes an optional league location; the link has to be http(s)", () => {
  const created = LeagueCreateRequestValidation.parse({league_name: "Jesen", ...KARTAS});
  assert.equal(created.location_name, "Caffe bar Kartaš");
  assert.equal(created.location_url, "https://maps.app.goo.gl/abc");
  assert.equal(LeagueCreateRequestValidation.parse({league_name: "Jesen"}).location_name, undefined);
  // trimmed; the service saves an empty one as null
  assert.equal(LeagueCreateRequestValidation.parse({league_name: "Jesen", location_name: "  ", location_url: ""}).location_name, "");
  assert.equal(message(LeagueCreateRequestValidation.safeParse({league_name: "Jesen", location_url: "javascript:alert(1)"})), LOCATION_URL_ERROR);
  assert.equal(message(LeagueCreateRequestValidation.safeParse({league_name: "Jesen", location_name: "x".repeat(101)})), "Ime mjesta može imati najviše 100 znakova.");

  assert.deepEqual(LeagueUpdateRequestValidation.parse({location_name: null, location_address: null, location_url: null}), {
    location_name: null,
    location_address: null,
    location_url: null,
  });
  assert.equal(LeagueUpdateRequestValidation.parse({location_address: " Ilica 128 "}).location_address, "Ilica 128");
  assert.equal(message(LeagueUpdateRequestValidation.safeParse({location_url: "javascript:alert(1)"})), LOCATION_URL_ERROR);
});

test("a night's own place: with a time, alone, or null for the league's; it needs a name", () => {
  const place = {name: "Klub Adut", address: "Vlaška 5", url: "https://maps.app.goo.gl/x"};
  assert.deepEqual(LeagueNightUpdateRequestValidation.parse({location: place}), {location: place});
  assert.deepEqual(LeagueNightUpdateRequestValidation.parse({start_time: "20:00"}), {start_time: "20:00"});
  assert.deepEqual(LeagueNightUpdateRequestValidation.parse({start_time: null, location: null}), {start_time: null, location: null});
  assert.deepEqual(LeagueNightUpdateRequestValidation.parse({location: {name: "Klub Adut"}}).location, {name: "Klub Adut"});
  assert.equal(message(LeagueNightUpdateRequestValidation.safeParse({location: {name: ""}})), LOCATION_NAME_REQUIRED);
  assert.equal(message(LeagueNightUpdateRequestValidation.safeParse({location: {name: "  "}})), LOCATION_NAME_REQUIRED);
  assert.equal(message(LeagueNightUpdateRequestValidation.safeParse({location: {name: "Adut", url: "javascript:alert(1)"}})), LOCATION_URL_ERROR);
});

// updateLeagueNight against a stand-in for the database: prisma.ts takes the client from global.prisma
type Update = {where: unknown; data: Record<string, unknown>};
function fakeDb(rounds: number) {
  const updates: Update[] = [];
  const league = {start_time: "19:30", ...KARTAS};
  const db = {
    leagueNight: {
      count: async () => 1,
      update: async (args: Update) => {
        updates.push(args);
        const row = {start_time: null, ...NO_PLACE, ...args.data};
        return {...row, league};
      },
    },
    round: {count: async () => rounds},
  };
  return {db, updates};
}

// The service module reads global.prisma once, on its first import, so every test goes through this one stand-in
type Db = ReturnType<typeof fakeDb>["db"];
let current: Db = fakeDb(0).db;
const shared = {
  leagueNight: {count: () => current.leagueNight.count(), update: (args: Update) => current.leagueNight.update(args)},
  round: {count: () => current.round.count()},
};

async function withDb<T>(db: Db, run: () => Promise<T>): Promise<T> {
  const global_ = global as unknown as {prisma: unknown};
  const before = global_.prisma;
  global_.prisma = shared;
  current = db;
  try {
    return await run();
  } finally {
    global_.prisma = before;
  }
}

const FUTURE = "2099-01-06";

test("a night that has passed or has rounds keeps its time and place", async () => {
  const {db: played, updates} = fakeDb(2);
  await withDb(played, async () => {
    const {updateLeagueNight} = await import("../service/league/nights");
    await assert.rejects(updateLeagueNight(1, FUTURE, {location: null}), {message: PAST_NIGHT_ERROR});
    assert.equal(updates.length, 0);
  });
  const {db: past} = fakeDb(0);
  const yesterday = new Date(Date.parse(`${leagueDateString()}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  await withDb(past, async () => {
    const {updateLeagueNight} = await import("../service/league/nights");
    await assert.rejects(updateLeagueNight(1, yesterday, {start_time: "20:00"}), {message: PAST_NIGHT_ERROR});
  });
});

test("a null location clears all three fields of the night; a left-out one isn't touched", async () => {
  const {db, updates} = fakeDb(0);
  await withDb(db, async () => {
    const {updateLeagueNight} = await import("../service/league/nights");
    const back = await updateLeagueNight(1, FUTURE, {location: null});
    assert.deepEqual(updates[0].data, {start_time: undefined, location_name: null, location_address: null, location_url: null});
    assert.equal(back?.location, null);
    assert.deepEqual(back?.place, {name: "Caffe bar Kartaš", address: "Ilica 128, Zagreb", url: "https://maps.app.goo.gl/abc"});
    assert.equal(back?.time, "19:30");

    const own = await updateLeagueNight(1, FUTURE, {start_time: "20:00", location: {name: " Klub Adut ", address: "", url: null}});
    assert.deepEqual(updates[1].data, {start_time: "20:00", location_name: "Klub Adut", location_address: null, location_url: null});
    assert.deepEqual(own?.place, {name: "Klub Adut", address: null, url: null});
    assert.equal(own?.time, "20:00");

    await updateLeagueNight(1, FUTURE, {start_time: null});
    assert.deepEqual(updates[2].data, {start_time: null});
  });
});

test("a night with its own time or place is marked, and says which", () => {
  assert.equal(exceptionLabel(true, true), "Drugo vrijeme i mjesto");
  assert.equal(exceptionLabel(true, false), "Drugo vrijeme");
  assert.equal(exceptionLabel(false, true), "Drugo mjesto");
  assert.equal(exceptionLabel(false, false), null);
});

test("a night's own time equal to the league's isn't kept; places compare by all three fields", () => {
  assert.equal(ownTimeOf("20:00", "19:30"), "20:00");
  assert.equal(ownTimeOf("19:30", "19:30"), null);
  assert.equal(ownTimeOf("", "19:30"), null);
  assert.equal(ownTimeOf("20:00", null), "20:00");
  const a = {name: "Adut", address: null, url: null};
  assert.equal(sameLocation(a, {...a}), true);
  assert.equal(sameLocation(a, {...a, address: "Vlaška 5"}), false);
  assert.equal(sameLocation(null, null), true);
  assert.equal(sameLocation(a, null), false);
});
