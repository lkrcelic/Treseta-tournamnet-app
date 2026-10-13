import assert from "node:assert/strict";
import {test} from "node:test";
import type {BurzaPost, MyBurzaPost} from "../../_interfaces/burza";
import {BurzaCreateRequestValidation, BurzaRepostRequestValidation} from "../../_interfaces/burza";
import {
  endsOn,
  nightGone,
  partnerError,
  postStatus,
  RepostFacts,
  repostError,
  StatusPost,
  stillUpIds,
  SubstituteFacts,
  substituteError,
  twinFields,
} from "../burzaStatus";
import {
  generateNights,
  isIsoDate,
  MAX_NIGHTS,
  nextNightIndex,
  NIGHT_STATUS_LABEL,
  nightLabel,
  nightLabelLong,
  nightsCountLabel,
  nightsLeftLabel,
  nightsSummaryLabel,
  nightStatus,
  RASPORED_PILL,
  rasporedPill,
  sortNights,
} from "../nights";
import {isValidPhone, normalizePhone, phoneInput, savesToProfile, telHref, whatsappHref} from "../phone";
import {
  adCount,
  availableAs,
  busyLine,
  dayMonth,
  expiryLine,
  myPostSub,
  myPostTitle,
  myTabLabel,
  namesAndMore,
  postBody,
  postDetails,
  postHeadline,
  postSub,
  ratingInTens,
  repostBlocked,
  repostFormHref,
  repostOpensForm,
  STATUS_PILL,
  substituteNights,
  substituteRoster,
  teamsAsking,
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
  assert.equal(nightsCountLabel(1, 0), "1 večer · 0 odigrano");
  // the participle agrees with the number (večer)
  assert.equal(nightsCountLabel(17, 1), "17 večeri · 1 odigrana");
  assert.equal(nightsCountLabel(17, 2), "17 večeri · 2 odigrane");
  assert.equal(nightsSummaryLabel(6, 10), "6 odigrano · još 10");
  assert.equal(nightsSummaryLabel(1, 16), "1 odigrana · još 16");
  // after the season there is nothing to go
  assert.equal(nightsSummaryLabel(6, 0), "6 odigrano");
});

test("Datumi labels every night: Odigrano, Nije odigrano, Sljedeća, Nadolazi", () => {
  const label = (night: string, isNext: boolean, hasRounds: boolean) => NIGHT_STATUS_LABEL[nightStatus(night, isNext, "2026-10-10", hasRounds)];
  assert.equal(label("2026-10-06", false, true), "Odigrano");
  assert.equal(label("2026-10-06", false, false), "Nije odigrano");
  assert.equal(label("2026-10-13", true, false), "Sljedeća");
  assert.equal(label("2026-10-20", false, false), "Nadolazi");
});

test("Raspored marks past nights, the next one and the season's last one", () => {
  const nights = ["2026-09-29", "2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"];
  const today = "2026-10-10";
  // as Raspored calls it: the next night from nextNightIndex, the last one by its index
  const at = (i: number, day: string, hasRounds: boolean) =>
    rasporedPill(nights[i], i === nextNightIndex(nights, day), i === nights.length - 1, day, hasRounds);
  const pill = (i: number, hasRounds = false) => {
    const p = at(i, today, hasRounds);
    return p && RASPORED_PILL[p];
  };
  assert.equal(pill(0, true), "Odigrano");
  // a past night without rounds (DECISIONS #28)
  assert.equal(pill(1, false), "Nije odigrano");
  assert.equal(pill(2), "Sljedeća");
  // a future night between the next and the last has no pill
  assert.equal(pill(3), null);
  assert.equal(pill(4), "Zadnja");
  // on the night itself the next night is tonight
  assert.equal(RASPORED_PILL[at(2, "2026-10-13", true)!], "Večeras");
  // the last night that is also the next one is the next one
  assert.equal(at(4, "2026-10-21", false), "next");
  // after the season every night is past
  assert.equal(at(4, "2026-11-01", true), "played");
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
  with_player: "Ante Kovač",
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
  assert.equal(postBody(base), "Igra s: Ante Kovač · rejting ekipe oko 1550");
  assert.equal(postHeadline(base), "Ekipa Slavonci traži zamjenu");
  assert.deepEqual(
    postDetails(base).map((d) => `${d.label}: ${d.value}`),
    ["Liga: Liga Četvrtak", "Večer: čet 15. 10.", "Igra s: Ante Kovač", "Rejting ekipe: oko 1550"]
  );

  const partner: BurzaPost = {...base, kind: "PARTNER", team: null, night: null, with_player: null, team_rating: null, author: {id: 8, name: "Antonio Jurić"}};
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

test("Burza counts the other teams looking for a player, each once, as Početna does", () => {
  const partner: BurzaPost = {...base, id: 2, kind: "PARTNER", team: null, night: null};
  const posts: BurzaPost[] = [
    base,
    // the same team on another night
    {...base, id: 3, night: "2026-10-22"},
    {...base, id: 4, team: {id: 5, name: "Kvarnerci"}, night: "2026-10-22"},
    // the viewer's own team
    {...base, id: 5, team: {id: 9, name: "Puleni"}, mine: true},
    // teams are told apart by id, not by name
    {...base, id: 6, team: {id: 6, name: "Slavonci"}, night: "2026-10-22"},
    partner,
  ];
  assert.deepEqual(teamsAsking(posts), [
    {id: 3, name: "Slavonci"},
    {id: 5, name: "Kvarnerci"},
    {id: 6, name: "Slavonci"},
  ]);
  assert.equal(teamsLooking(teamsAsking(posts).length), "3 ekipe traže igrača");
  assert.deepEqual(teamsAsking(posts, "2026-10-15").map((t) => t.id), [3]);
  assert.deepEqual(teamsAsking(posts, "2026-10-22").map((t) => t.id), [3, 5, 6]);
  // only the viewer's own ad on a night: nobody else asks
  assert.deepEqual(teamsAsking([{...base, mine: true}], "2026-10-15"), []);
  assert.deepEqual(teamsAsking([]), []);
});

test("a new ad is checked before it's sent", () => {
  const ok = BurzaCreateRequestValidation.safeParse({kind: "PARTNER", league_id: 2, phone: "091 234 5678", note: " Tražim partnera "});
  assert.ok(ok.success);
  assert.equal(ok.success && ok.data.note, "Tražim partnera");
  assert.equal(ok.success && ok.data.save_phone, false);
  assert.ok(!BurzaCreateRequestValidation.safeParse({kind: "PARTNER", league_id: 2, phone: "091 23"}).success);
  assert.ok(!BurzaCreateRequestValidation.safeParse({kind: "AVAILABLE", as_substitute: false, as_partner: false, phone: "091 234 5678"}).success);
  assert.ok(BurzaCreateRequestValidation.safeParse({kind: "AVAILABLE", as_substitute: false, as_partner: true, phone: "091 234 5678"}).success);
  assert.ok(!BurzaCreateRequestValidation.safeParse({kind: "SUBSTITUTE", league_id: 2, team_id: 3, night: "15.10.2026", with_player_id: 4, phone: "091 234 5678"}).success);
});

// Moji oglasi

const ctx = {today: "2026-10-13", nights: new Set(["2|2026-10-13", "2|2026-10-20"])};
const substitute: StatusPost = {kind: "SUBSTITUTE", closed: false, league_id: 2, night: "2026-10-20", league_end: null};

test("an ad is up until it is closed, its night has passed or been removed, or its league has ended", () => {
  assert.equal(postStatus(substitute, ctx), "ACTIVE");
  // on the night itself it is still up
  assert.equal(postStatus({...substitute, night: "2026-10-13"}, ctx), "ACTIVE");
  assert.equal(postStatus({...substitute, night: "2026-10-06"}, ctx), "EXPIRED");
  // a night taken off the league's nights
  assert.equal(postStatus({...substitute, night: "2026-10-27"}, ctx), "EXPIRED");
  // closed by hand beats expired
  assert.equal(postStatus({...substitute, night: "2026-10-06", closed: true}, ctx), "CLOSED");

  const partner: StatusPost = {kind: "PARTNER", closed: false, league_id: 2, night: null, league_end: "2026-12-15"};
  assert.equal(postStatus(partner, ctx), "ACTIVE");
  assert.equal(postStatus({...partner, league_end: "2026-10-13"}, ctx), "ACTIVE");
  assert.equal(postStatus({...partner, league_end: "2026-10-12"}, ctx), "EXPIRED");
  assert.equal(postStatus({...partner, league_end: null}, ctx), "ACTIVE");

  // an availability ad never expires
  const available: StatusPost = {kind: "AVAILABLE", closed: false, league_id: null, night: null, league_end: null};
  assert.equal(postStatus(available, {today: "2030-01-01", nights: new Set()}), "ACTIVE");
  assert.equal(postStatus({...available, closed: true}, ctx), "CLOSED");
});

test("deactivating a player closes only their ads that are still up, not the ones already expired", () => {
  const ads: (StatusPost & {id: number})[] = [
    {...substitute, id: 1},
    // its night has passed, or was taken off the league's nights: expired, never closed by hand
    {...substitute, id: 2, night: "2026-10-06"},
    {...substitute, id: 3, night: "2026-10-27"},
    {kind: "PARTNER", closed: false, league_id: 2, night: null, league_end: "2026-12-15", id: 4},
    {kind: "PARTNER", closed: false, league_id: 2, night: null, league_end: "2026-10-12", id: 5},
    {kind: "AVAILABLE", closed: false, league_id: null, night: null, league_end: null, id: 6},
  ];
  assert.deepEqual(stillUpIds(ads, ctx), [1, 4, 6]);
});

test("an ad closes by itself on its night or its league's end, and only a substitute ad's night can be gone", () => {
  assert.equal(endsOn(substitute), "2026-10-20");
  assert.equal(endsOn({kind: "PARTNER", closed: false, league_id: 2, night: null, league_end: "2026-12-15"}), "2026-12-15");
  assert.equal(endsOn({kind: "AVAILABLE", closed: false, league_id: null, night: null, league_end: null}), null);
  assert.ok(!nightGone(substitute, ctx));
  // closed by hand and its night passed since: publishing it again needs a new night
  assert.ok(nightGone({...substitute, closed: true, night: "2026-10-06"}, ctx));
  assert.ok(nightGone({...substitute, night: "2026-10-27"}, ctx));
  assert.ok(!nightGone({kind: "PARTNER", closed: false, league_id: 2, night: null, league_end: "2026-10-01"}, ctx));
});

const team: SubstituteFacts = {admin: false, onTeam: true, teamInLeague: true, withOnTeam: true, night: "2026-10-20", leagueNight: true, today: "2026-10-13"};

test("a substitute ad, new or published again, is for the author's team, its player and a league night still ahead", () => {
  assert.equal(substituteError(team, "create"), null);
  assert.equal(substituteError(team, "repost"), null);
  // tonight is still ahead
  assert.equal(substituteError({...team, night: "2026-10-13"}, "create"), null);
  const cases: [Partial<SubstituteFacts>, string, string][] = [
    [{onTeam: false}, "Zamjenu možeš tražiti samo za svoju ekipu.", "Više nisi u toj ekipi."],
    [{teamInLeague: false}, "Ekipa ne igra u ovoj ligi.", "Ekipa više ne igra u toj ligi."],
    [{withOnTeam: false}, "Igrač s kojim zamjena igra mora biti u ekipi.", "Igrač s kojim zamjena igra više nije u ekipi."],
    [{night: "2026-10-06"}, "Ta večer je već prošla.", "Odaberi novu večer."],
    [{leagueNight: false}, "Liga te večeri ne igra.", "Odaberi novu večer."],
  ];
  for (const [change, create, repost] of cases) {
    assert.equal(substituteError({...team, ...change}, "create"), create);
    assert.equal(substituteError({...team, ...change}, "repost"), repost);
  }
  assert.equal(substituteError({...team, night: null}, "repost"), "Odaberi novu večer.");
  // an admin may post for any team
  assert.equal(substituteError({...team, onTeam: false, admin: true}, "create"), null);
  assert.equal(partnerError("2026-10-13", "2026-10-13"), null);
  assert.equal(partnerError(null, "2026-10-13"), null);
  assert.equal(partnerError("2026-10-12", "2026-10-13"), "Ova liga je završila.");
});

const facts: RepostFacts = {post: {...substitute, closed: true, player_id: 7}, userId: 7, today: "2026-10-13", substitute: team, phone: true};

test("only the author publishes an ad again, and it has to be able to go up", () => {
  assert.equal(repostError(facts), null);
  assert.deepEqual(repostError({...facts, userId: 8}), {status: 403, message: "Možeš ponovno objaviti samo svoj oglas."});
  // an admin can't publish someone else's ad again either
  assert.equal(repostError({...facts, userId: 8, substitute: {...team, admin: true}})?.status, 403);
  assert.deepEqual(repostError({...facts, substitute: {...team, night: "2026-10-06"}}), {status: 400, message: "Odaberi novu večer."});
  // its team is gone
  assert.equal(repostError({...facts, substitute: null})?.message, "Više nisi u toj ekipi.");

  const partner: RepostFacts = {...facts, post: {kind: "PARTNER", closed: true, league_id: 2, night: null, league_end: "2026-12-15", player_id: 7}, substitute: null};
  assert.equal(repostError(partner), null);
  assert.deepEqual(repostError({...partner, post: {...partner.post, league_end: "2026-10-12"}}), {status: 400, message: "Ova liga je završila."});

  // an availability ad goes up only with a phone number, its own or the profile's (Burza lists no other)
  const available: RepostFacts = {...partner, post: {kind: "AVAILABLE", closed: true, league_id: null, night: null, league_end: null, player_id: 7}};
  assert.equal(repostError(available), null);
  assert.equal(repostError({...available, phone: false})?.message, "Oglas nema broja mobitela. Upiši ga na Moj profil.");
});

test("a new or published-again ad that copies an open one is matched on what makes it the same", () => {
  const ad = {team_id: 3, league_id: 2, night: "2026-10-20", with_player_id: 4};
  assert.deepEqual(twinFields({kind: "SUBSTITUTE", ...ad}), {kind: "SUBSTITUTE", team_id: 3, night: "2026-10-20", with_player_id: 4});
  assert.deepEqual(twinFields({kind: "PARTNER", ...ad}), {kind: "PARTNER", league_id: 2});
  // a player has one open availability ad
  assert.deepEqual(twinFields({kind: "AVAILABLE", ...ad}), {kind: "AVAILABLE"});
  assert.ok(BurzaRepostRequestValidation.safeParse({}).success);
  assert.ok(BurzaRepostRequestValidation.safeParse({night: "2026-10-20"}).success);
  assert.ok(!BurzaRepostRequestValidation.safeParse({night: "20.10.2026"}).success);
  // a day that doesn't exist
  assert.ok(!BurzaRepostRequestValidation.safeParse({night: "2026-13-45"}).success);
  assert.ok(!isIsoDate("2026-02-31"));
  assert.ok(isIsoDate("2028-02-29"));
});

const mine: MyBurzaPost = {
  ...base,
  author: {id: 7, name: "Marko Marković"},
  team: {id: 3, name: "Dalmatinci"},
  league: {id: 2, name: "Liga Utorak"},
  night: "2026-10-13",
  with_player: "Ivan Perić",
  mine: true,
  can_close: true,
  status: "ACTIVE",
  ends_on: "2026-10-13",
  closed_at: null,
  night_gone: false,
  with_player_id: 4,
};
const minePartner: MyBurzaPost = {...mine, kind: "PARTNER", team: null, night: null, with_player: null, with_player_id: null, ends_on: "2026-12-15", league: {id: 4, name: "Liga Četvrtak"}};
const mineAvailable: MyBurzaPost = {...minePartner, kind: "AVAILABLE", league: null, ends_on: null, as_substitute: true, as_partner: true};

test("Moji oglasi says what each ad is and when it closes", () => {
  assert.equal(myPostTitle(mine), "Ekipa Dalmatinci traži zamjenu");
  assert.equal(myPostSub(mine), "Liga Utorak · uto 13. 10. · igra s: Ivan Perić");
  assert.equal(myPostTitle(minePartner), "Tražim partnera");
  assert.equal(myPostSub(minePartner), "Liga Četvrtak");
  assert.equal(myPostTitle(mineAvailable), "Dostupan sam");
  assert.equal(myPostSub(mineAvailable), "Za zamjenu i novog partnera");

  const today = "2026-10-12";
  assert.equal(expiryLine(mine, today), "Zatvara se sam nakon večeri, uto 13. 10.");
  assert.equal(expiryLine(minePartner, today), "Zatvara se sam kad liga završi, 15. 12.");
  assert.equal(expiryLine({...minePartner, ends_on: null}, today), "Aktivan dok ga ne zatvoriš");
  assert.equal(expiryLine(mineAvailable, today), "Aktivan dok ga ne zatvoriš");

  const expired = {...mine, status: "EXPIRED" as const, night: "2026-09-29", ends_on: "2026-09-29", night_gone: true};
  assert.equal(expiryLine(expired, today), "Istekao nakon večeri 29. 9.");
  assert.equal(expiryLine({...expired, night: "2026-10-20"}, today), "Istekao: večer je uklonjena iz rasporeda");
  assert.equal(expiryLine({...minePartner, status: "EXPIRED", ends_on: "2026-10-01"}, today), "Istekao kad je liga završila 1. 10.");

  // closed by hand, on its day in league time: 22:30 UTC on the 2nd is already the 3rd in Zagreb
  assert.equal(expiryLine({...mine, status: "CLOSED", closed_at: "2026-10-02T12:00:00.000Z"}, today), "Zatvoren 2. 10.");
  assert.equal(expiryLine({...mineAvailable, status: "CLOSED", closed_at: "2026-10-02T22:30:00.000Z"}, today), "Zatvoren 3. 10.");
  assert.equal(expiryLine({...expired, status: "CLOSED", closed_at: "2026-09-20T10:00:00.000Z"}, today), "Zatvoren 20. 9.");

  // right after a change on the page, while the ad's status agrees with it
  assert.equal(expiryLine({...mine, status: "CLOSED", closed_at: "2026-10-12T10:00:00.000Z"}, today, "closed"), "Zatvoren upravo");
  assert.equal(expiryLine(mine, today, "reposted"), "Objavljeno ponovno");
  assert.equal(expiryLine(mine, today, "already"), "Već imaš ovakav oglas");
  assert.equal(expiryLine(mine, today, "closed"), "Zatvara se sam nakon večeri, uto 13. 10.");
  assert.equal(expiryLine({...mine, status: "CLOSED", closed_at: "2026-10-02T12:00:00.000Z"}, today, "reposted"), "Zatvoren 2. 10.");

  assert.equal(dayMonth("2026-09-29"), "29. 9.");
  assert.equal(dayMonth("2026-12-05"), "5. 12.");
  assert.deepEqual(
    (["ACTIVE", "EXPIRED", "CLOSED"] as const).map((s) => STATUS_PILL[s].label),
    ["Aktivan", "Istekao", "Zatvoren"]
  );
  assert.equal(myTabLabel("active", 2), "Aktivni · 2");
  assert.equal(myTabLabel("past", 0), "Prošli · 0");
});

test("Tko traži zamjenu? lists the player first, then the active teammates", () => {
  const p = (id: number, me = false, active = true) => ({id, name: `Igrač ${id}`, rating: 1500, me, active});
  assert.deepEqual(substituteRoster([p(1), p(2, false, false), p(3, true), p(4)]).map((x) => x.id), [3, 1, 4]);
  assert.deepEqual(substituteRoster([]), []);
});

test("Objavi ponovno opens the form for a substitute ad whose night is gone or an availability ad without a number", () => {
  assert.ok(!repostOpensForm({...mine, status: "CLOSED"}));
  assert.ok(repostOpensForm({...mine, status: "EXPIRED", night_gone: true}));
  assert.ok(!repostOpensForm({...mineAvailable, status: "CLOSED", phone: "+385911234567"}));
  assert.ok(repostOpensForm({...mineAvailable, status: "CLOSED", phone: null}));
  // filled in from the ad; the phone number comes from the ad (repost=), not the address
  assert.equal(repostFormHref({...mine, id: 9, note: "Počinjemo u 19 h"}), "/burza/novi/zamjena?repost=9&league=2&team=3&with=4&note=Po%C4%8Dinjemo+u+19+h");
  assert.equal(repostFormHref({...mine, id: 9}), "/burza/novi/zamjena?repost=9&league=2&team=3&with=4");
  assert.equal(repostFormHref({...mineAvailable, id: 12, phone: null}), "/burza/novi/dostupan?repost=12");
});

test("a partner ad whose league has ended can't go up again", () => {
  const today = "2026-10-12";
  assert.equal(repostBlocked({...minePartner, status: "EXPIRED", ends_on: "2026-10-01"}, today), "Liga je završila");
  assert.equal(repostBlocked({...minePartner, status: "CLOSED", ends_on: "2026-10-01"}, today), "Liga je završila");
  assert.equal(repostBlocked({...minePartner, status: "CLOSED", ends_on: "2026-12-15"}, today), null);
  assert.equal(repostBlocked({...minePartner, status: "CLOSED", ends_on: null}, today), null);
  assert.equal(repostBlocked({...mine, status: "EXPIRED", ends_on: "2026-09-29"}, today), null);
});
