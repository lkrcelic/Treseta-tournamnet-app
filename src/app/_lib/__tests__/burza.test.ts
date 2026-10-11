import assert from "node:assert/strict";
import {test} from "node:test";
import type {BurzaPost} from "../../_interfaces/burza";
import {BurzaCreateRequestValidation} from "../../_interfaces/burza";
import {generateNights, MAX_NIGHTS, nextNightIndex, nightLabel, nightLabelLong, nightsCountLabel, nightsLeftLabel, nightStatus, sortNights} from "../nights";
import {isValidPhone, normalizePhone, phoneInput, savesToProfile, telHref, whatsappHref} from "../phone";
import {
  adCount,
  availableAs,
  busyLine,
  namesAndMore,
  postBody,
  postDetails,
  postHeadline,
  postSub,
  ratingInTens,
  substituteNights,
  teamsLooking,
  timeAgo,
} from "../ui/burza";

test("league nights are every play day from the start to the end date", () => {
  // 2026-09-01 is a Tuesday; play day 1 = Tuesday (0 = Monday)
  assert.deepEqual(generateNights("2026-09-01", "2026-09-29", 1), ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"]);
  // a Thursday league starting on a Tuesday begins on that week's Thursday; the end date is included
  assert.deepEqual(generateNights("2026-09-01", "2026-09-17", 3), ["2026-09-03", "2026-09-10", "2026-09-17"]);
  // Sunday is 6
  assert.deepEqual(generateNights("2026-10-01", "2026-10-12", 6), ["2026-10-04", "2026-10-11"]);
  // across the end of March (summer time doesn't shift the dates)
  assert.deepEqual(generateNights("2027-03-23", "2027-04-06", 1), ["2027-03-23", "2027-03-30", "2027-04-06"]);
});

test("no nights without all three fields, with the end before the start, and never more than the cap", () => {
  assert.deepEqual(generateNights("2026-09-01", null, 1), []);
  assert.deepEqual(generateNights(null, "2026-09-29", 1), []);
  assert.deepEqual(generateNights("2026-09-01", "2026-09-29", null), []);
  assert.deepEqual(generateNights("2026-09-29", "2026-09-01", 1), []);
  assert.deepEqual(generateNights("2026-09-01", "2026-09-06", 0), []);
  assert.equal(generateNights("2026-01-01", "2062-01-01", 2).length, MAX_NIGHTS);
});

test("nights are labelled the Croatian way", () => {
  assert.equal(nightLabel("2026-10-13"), "uto 13. 10.");
  assert.equal(nightLabel("2026-10-15"), "čet 15. 10.");
  assert.equal(nightLabel("2026-09-06"), "ned 6. 9.");
  assert.equal(nightLabelLong("2026-10-13"), "uto 13. 10. 2026.");
  assert.deepEqual(sortNights(["2026-10-20", "2026-10-13", "2026-10-20"]), ["2026-10-13", "2026-10-20"]);
});

test("the next night counts tonight, and a past night was played only with rounds", () => {
  const nights = ["2026-10-06", "2026-10-13", "2026-10-20"];
  assert.equal(nextNightIndex(nights, "2026-10-10"), 1);
  assert.equal(nextNightIndex(nights, "2026-10-13"), 1);
  assert.equal(nextNightIndex(nights, "2026-10-21"), -1);
  assert.equal(nightStatus("2026-10-06", false, "2026-10-10", true), "played");
  assert.equal(nightStatus("2026-10-06", false, "2026-10-10", false), "notPlayed");
  assert.equal(nightStatus("2026-10-13", true, "2026-10-13", true), "next");
  assert.equal(nightStatus("2026-10-20", false, "2026-10-10", false), "upcoming");
  assert.equal(nightsLeftLabel(10), "još 10 večeri do kraja sezone");
  assert.equal(nightsLeftLabel(1), "još 1 večer do kraja sezone");
  assert.equal(nightsCountLabel(16, 6), "16 večeri · 6 odigrano");
});

test("phone numbers are stored with the country code", () => {
  assert.equal(normalizePhone("091 234 5678"), "+385 91 234 5678");
  assert.equal(normalizePhone("0912345678"), "+385 91 234 5678");
  assert.equal(normalizePhone("+385912345678"), "+385 91 234 5678");
  assert.equal(normalizePhone("00385 91 234 5678"), "+385 91 234 5678");
  assert.equal(normalizePhone("385 98 765 4321"), "+385 98 765 4321");
  assert.equal(normalizePhone("01 234 5678"), "+385 1 234 5678");
  assert.equal(normalizePhone("021 345 678"), "+385 21 345 678");
  assert.equal(normalizePhone("+49 151 2345 6789"), "+49 151 2345 6789");
  assert.equal(normalizePhone("0049 151 23456789"), "+49 151 23456789");
});

test("a phone number needs at least 9 digits", () => {
  assert.ok(isValidPhone("091 234 5678"));
  assert.ok(isValidPhone("91 234 5678"));
  assert.equal(normalizePhone("91 234 5678"), "+385 91 234 5678");
  assert.ok(!isValidPhone("91 234 567"));
  assert.ok(!isValidPhone("091 23"));
  assert.ok(!isValidPhone(""));
  assert.ok(!isValidPhone(null));
  assert.ok(!isValidPhone("+1 234 567 890 123 456"));
  assert.equal(normalizePhone("091 23"), null);
  assert.equal(phoneInput("091-234 (5678) a"), "091234 5678 ");
});

test("an ad's number goes on an empty profile, and replaces the profile's only when asked", () => {
  assert.ok(savesToProfile("091 234 5678", null, false));
  assert.ok(savesToProfile("098 765 4321", "+385 91 234 5678", true));
  assert.ok(!savesToProfile("098 765 4321", "+385 91 234 5678", false));
  // the profile's own number, typed another way
  assert.ok(!savesToProfile("0912345678", "+385 91 234 5678", true));
  assert.ok(!savesToProfile("091 23", null, true));
});

test("call and WhatsApp links use the international number", () => {
  assert.equal(telHref("+385 91 555 1234"), "tel:+385915551234");
  assert.equal(whatsappHref("+385 91 555 1234"), "https://wa.me/385915551234");
});

test("Burza counts and names read as Croatian", () => {
  assert.equal(teamsLooking(1), "1 ekipa traži igrača");
  assert.equal(teamsLooking(4), "4 ekipe traže igrača");
  assert.equal(teamsLooking(5), "5 ekipa traži igrača");
  assert.equal(teamsLooking(22), "22 ekipe traže igrača");
  assert.equal(adCount(1), "1 oglas");
  assert.equal(adCount(8), "8 oglasa");
  assert.equal(namesAndMore(["Slavonci", "Kvarnerci", "Istrani", "Boduli"]), "Slavonci, Kvarnerci i još 2");
  assert.equal(namesAndMore(["Slavonci", "Kvarnerci"]), "Slavonci i Kvarnerci");
  assert.equal(namesAndMore(["Slavonci"]), "Slavonci");
  assert.equal(availableAs(true, true), "zamjenu i novog partnera");
  assert.equal(availableAs(false, true), "novog partnera");
  assert.equal(ratingInTens([1531, 1542]), 1540);
  assert.equal(ratingInTens([1500, 1612]), 1560);
  assert.equal(ratingInTens([]), null);
  assert.equal(busyLine("Dalmatinci"), "Taj dan igraš za ekipu Dalmatinci");
});

test("time since an ad was published", () => {
  const now = new Date("2026-10-11T18:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const H = 3_600_000;
  assert.equal(timeAgo(ago(20_000), now), "upravo");
  assert.equal(timeAgo(ago(5 * 60_000), now), "prije 5 min");
  assert.equal(timeAgo(ago(2 * H), now), "prije 2 h");
  assert.equal(timeAgo(ago(30 * H), now), "jučer");
  assert.equal(timeAgo(ago(3 * 24 * H), now), "prije 3 dana");
  assert.equal(timeAgo(ago(8 * 24 * H), now), "prije tjedan dana");
  assert.equal(timeAgo(ago(15 * 24 * H), now), "prije 2 tjedna");
  assert.equal(timeAgo(ago(35 * 24 * H), now), "prije mjesec dana");
  assert.equal(timeAgo(ago(70 * 24 * H), now), "prije 2 mjeseca");
  // a clock a little ahead of the server's doesn't say "prije -1 min"
  assert.equal(timeAgo(ago(-60_000), now), "upravo");
});

const base: BurzaPost = {
  id: 1,
  kind: "SUBSTITUTE",
  created_at: "2026-10-11T16:00:00Z",
  closed: false,
  author: {id: 7, name: "Hrvoje Lovrić"},
  team: {id: 3, name: "Slavonci"},
  league: {id: 2, name: "Liga Četvrtak"},
  night: "2026-10-15",
  out_player: "Ante Kovač",
  team_rating: 1550,
  rating: null,
  as_substitute: false,
  as_partner: false,
  note: "",
  phone: "+385 91 555 1234",
  mine: false,
  can_close: false,
  busy_team: null,
};

test("ad cards and pages say what each kind needs", () => {
  assert.equal(postSub(base), "Liga Četvrtak · rejting 1550");
  assert.equal(postBody(base), "Umjesto: Ante Kovač · rejting ekipe oko 1550");
  assert.equal(postHeadline(base), "Ekipa Slavonci traži zamjenu");
  assert.deepEqual(
    postDetails(base).map((d) => `${d.label}: ${d.value}`),
    ["Liga: Liga Četvrtak", "Večer: čet 15. 10.", "Umjesto: Ante Kovač", "Rejting ekipe: oko 1550"]
  );

  const partner: BurzaPost = {...base, kind: "PARTNER", team: null, night: null, out_player: null, team_rating: null, author: {id: 8, name: "Antonio Jurić"}};
  assert.equal(postSub(partner), "Liga Četvrtak");
  assert.equal(postBody(partner), "Javi se ako i ti tražiš partnera.");
  assert.equal(postHeadline(partner), "Antonio Jurić");
  assert.deepEqual(postDetails(partner).map((d) => d.value), ["Liga Četvrtak", "Još nema"]);

  const available: BurzaPost = {...partner, kind: "AVAILABLE", league: null, rating: 1524, as_substitute: true, note: "Mogu uskočiti bilo koji dan."};
  assert.equal(postSub(available), "Za zamjenu");
  assert.equal(postBody(available), "Mogu uskočiti bilo koji dan. · rejting 1524");
  assert.deepEqual(postDetails(available).map((d) => d.value), ["zamjenu", "1524"]);

  assert.deepEqual(substituteNights([base, {...base, night: "2026-10-13"}, partner, {...base, night: "2026-10-15"}]), ["2026-10-13", "2026-10-15"]);
});

test("a new ad is checked before it's sent", () => {
  const ok = BurzaCreateRequestValidation.safeParse({kind: "PARTNER", league_id: 2, phone: "091 234 5678", note: " Tražim partnera "});
  assert.ok(ok.success);
  assert.equal(ok.success && ok.data.note, "Tražim partnera");
  assert.equal(ok.success && ok.data.save_phone, false);
  assert.ok(!BurzaCreateRequestValidation.safeParse({kind: "PARTNER", league_id: 2, phone: "091 23"}).success);
  assert.ok(!BurzaCreateRequestValidation.safeParse({kind: "AVAILABLE", as_substitute: false, as_partner: false, phone: "091 234 5678"}).success);
  assert.ok(BurzaCreateRequestValidation.safeParse({kind: "AVAILABLE", as_substitute: false, as_partner: true, phone: "091 234 5678"}).success);
  assert.ok(!BurzaCreateRequestValidation.safeParse({kind: "SUBSTITUTE", league_id: 2, team_id: 3, night: "15.10.2026", out_player_id: 4, phone: "091 234 5678"}).success);
});
