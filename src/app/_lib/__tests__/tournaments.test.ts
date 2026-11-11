import assert from "node:assert/strict";
import {test} from "node:test";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {firstKoloPairs, KoloPair, SwissTeam, swissPairs} from "@/app/_lib/matching/tournamentPairing";
import {Entry, playersInOtherEntries, rebalance, signUpStatus, waitingList} from "@/app/_lib/tournamentEntries";
import {
  capacityLabel,
  completedKolos,
  daysUntilLabel,
  draftIsStale,
  isComingUp,
  feeLabel,
  formatLabel,
  koloSteps,
  liveKolo,
  opponentsOf,
  prizeSummary,
  rankTeams,
  rulesLabel,
  typicalGameMinutes,
  gameLengthNote,
  standingsOrderLabel,
  TableResult,
  tournamentPhase,
  koloRemovalOf,
  koloRemovalWarns,
  joinsAsPresent,
  signUpsCloseWithSwitch,
  signUpsOpenNow,
  removesResults,
  tableWasPlayed,
  tournamentStatus,
  tournamentTotals,
} from "@/app/_lib/tournaments";
import {dateTile} from "@/app/_lib/nights";
import {TournamentRequestValidation} from "@/app/_interfaces/tournament";

// Turniri: pairing the Kolos, the waiting list, the standings and the words of the screens

// a repeatable random number generator for the draws
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const teamsIn = (pairs: KoloPair[]) => pairs.flat().filter((id) => id !== BYE_TEAM_ID).sort((a, b) => a - b);

test("Kolo 1 is a draw: every team plays once, and with an odd number of teams the last one drawn has the bye", () => {
  const ids = [1, 2, 3, 4, 5, 6, 7];
  const pairs = firstKoloPairs(ids, seeded(7));
  assert.deepEqual(teamsIn(pairs), ids);
  assert.equal(pairs.length, 4);
  assert.equal(pairs[3][1], BYE_TEAM_ID);
  assert.equal(pairs.filter((p) => p.includes(BYE_TEAM_ID)).length, 1);
  // the same draw for the same random numbers, another one for others
  assert.deepEqual(firstKoloPairs(ids, seeded(7)), pairs);
  assert.notDeepEqual(firstKoloPairs(ids, seeded(8)), pairs);
  assert.deepEqual(firstKoloPairs([4, 9], () => 0.5).flat().sort(), [4, 9]);
  assert.deepEqual(firstKoloPairs([]), []);
});

const swiss = (id: number, points: number, difference: number, opponents: number[] = []): SwissTeam => ({id, points, difference, opponents});

test("Swiss: neighbours in the standings meet, the better team first, table 1 at the top", () => {
  const plan = swissPairs([swiss(1, 4, 50), swiss(2, 4, 20), swiss(3, 2, 10), swiss(4, 2, -5), swiss(5, 0, -30), swiss(6, 0, -45)]);
  assert.deepEqual(plan.pairs, [[1, 2], [3, 4], [5, 6]]);
  assert.deepEqual(plan.repeats, []);
});

test("Swiss: teams that met already are kept apart when another pairing works", () => {
  const plan = swissPairs([swiss(1, 4, 50, [2]), swiss(2, 4, 20, [1]), swiss(3, 2, 10), swiss(4, 2, -5)]);
  assert.deepEqual(plan.repeats, []);
  assert.ok(!plan.pairs.some(([a, b]) => (a === 1 && b === 2) || (a === 2 && b === 1)));
  assert.deepEqual(teamsIn(plan.pairs), [1, 2, 3, 4]);
});

test("Swiss: the lowest team without a bye gets the bye, never a second one while another team can take it", () => {
  const plan = swissPairs([swiss(1, 4, 10), swiss(2, 2, 0), swiss(3, 2, -2), swiss(4, 0, -5), swiss(5, 2, 300, [BYE_TEAM_ID])]);
  const bye = plan.pairs.find((p) => p[1] === BYE_TEAM_ID)!;
  assert.equal(bye[0], 4);
  assert.deepEqual(plan.pairs[plan.pairs.length - 1], bye);
  // the last team already had one: the one above it takes it
  const again = swissPairs([swiss(1, 4, 10), swiss(2, 2, 0), swiss(3, 0, -5, [BYE_TEAM_ID])]);
  assert.deepEqual(again.pairs.find((p) => p[1] === BYE_TEAM_ID), [2, BYE_TEAM_ID]);
  assert.deepEqual(again.repeats, []);
});

test("Swiss: the bye goes to the lowest team even when that keeps the leaders apart", () => {
  // after Kolo 1 of the click-through of 26.10.: the two teams on 2 points met, so with the bye on the last team the
  // leaders can't meet each other; the bye still goes to the last team, not to the one on 2 points
  const plan = swissPairs([swiss(1, 4, 602, [BYE_TEAM_ID]), swiss(2, 4, 532, [5]), swiss(3, 2, 20, [4]), swiss(4, 2, -20, [3]), swiss(5, 0, -532, [2])]);
  assert.deepEqual(plan.pairs, [[1, 3], [2, 4], [5, BYE_TEAM_ID]]);
  assert.deepEqual(plan.repeats, []);
});

test("Swiss: a meeting nobody can avoid is made and reported", () => {
  // three teams that all met: someone meets again (or takes a second bye)
  const plan = swissPairs([swiss(1, 2, 0, [2, 3]), swiss(2, 2, 0, [1, 3]), swiss(3, 2, 0, [1, 2, BYE_TEAM_ID])]);
  assert.deepEqual(teamsIn(plan.pairs), [1, 2, 3]);
  assert.equal(plan.repeats.length, 1);
  assert.deepEqual(swissPairs([swiss(9, 0, 0)]).pairs, [[9, BYE_TEAM_ID]]);
  assert.deepEqual(swissPairs([]).pairs, []);
});

test("someone sat down at this table: the same question the server asks before it deletes a Kolo", () => {
  const t = (o: Partial<{team1Id: number; team2Id: number; open: boolean; matches: number; ongoing: number}> = {}) => ({
    team1Id: 1,
    team2Id: 2,
    open: true,
    matches: 0,
    ongoing: 0,
    ...o,
  });
  // a table nobody has touched: out, open, nothing played
  assert.equal(tableWasPlayed(t()), false);
  // closed: played, or closed by Nedolazak, Preskočen or the clock — all of them count
  assert.equal(tableWasPlayed(t({open: false})), true);
  // a game is running at it
  assert.equal(tableWasPlayed(t({ongoing: 1})), true);
  // a match was played and the table is still open for the second: the wins can be 0 (a match an admin finished
  // without a winner), so the match itself is what counts, not the score
  assert.equal(tableWasPlayed(t({matches: 1})), true);
  // the bye's table is nobody's play, however it looks
  assert.equal(tableWasPlayed(t({team1Id: BYE_TEAM_ID, open: false, matches: 2})), false);
  assert.equal(tableWasPlayed(t({team2Id: BYE_TEAM_ID, open: false, matches: 2})), false);
});

test("Obriši kolo: any Kolo in any state goes, the tournament is one shorter, and made Kolos after it go with it", () => {
  const kolo = (number: number, published: boolean, played: boolean, done: boolean) => ({number, published, played, done});
  const played1 = kolo(1, true, true, true);
  const live1 = kolo(1, true, true, false);

  // a tournament of one Kolo keeps it, and a number outside the plan is nothing to delete
  assert.equal(koloRemovalOf(1, 1, []), null);
  assert.equal(koloRemovalOf(1, 1, [live1]), null);
  assert.equal(koloRemovalOf(3, 4, []), null);
  assert.equal(koloRemovalOf(3, 0, []), null);

  // --- nothing made: deleting any of them only shortens the plan ------------------------------------------------
  assert.deepEqual(koloRemovalOf(4, 2, []), {number: 2, step: "waiting", alsoGo: [], rounds: 3, ends: false, resultsGo: false});
  assert.deepEqual(koloRemovalOf(4, 1, []), {number: 1, step: "waiting", alsoGo: [], rounds: 3, ends: false, resultsGo: false});
  // the last one of the plan, with everything before it played: what stays is all played, so the tournament is over
  assert.deepEqual(koloRemovalOf(2, 2, [played1]), {number: 2, step: "waiting", alsoGo: [], rounds: 1, ends: true, resultsGo: false});
  // the same Kolo while Kolos are still to come after it: not the end
  assert.deepEqual(koloRemovalOf(3, 2, [played1]), {number: 2, step: "waiting", alsoGo: [], rounds: 2, ends: false, resultsGo: false});

  // --- a made Kolo: its tables go, and so do those of every made Kolo after it -----------------------------------
  const draft = koloRemovalOf(2, 2, [played1, kolo(2, false, false, false)])!;
  assert.deepEqual(draft, {number: 2, step: "draft", alsoGo: [], rounds: 1, ends: true, resultsGo: false});
  assert.deepEqual(koloRemovalOf(2, 2, [played1, kolo(2, true, false, false)]), {number: 2, step: "out", alsoGo: [], rounds: 1, ends: true, resultsGo: false});

  // someone plays at it, or it is played: its results go too, so it is asked with a warning
  const live = koloRemovalOf(2, 2, [played1, kolo(2, true, true, false)])!;
  assert.deepEqual(live, {number: 2, step: "live", alsoGo: [], rounds: 1, ends: true, resultsGo: true});
  assert.equal(removesResults(live), true);
  assert.equal(removesResults(draft), false);
  assert.equal(removesResults(koloRemovalOf(3, 3, [])!), false);

  // Kolo 2 of four, with Kolos 3 and 4 made from its results: all three go, and the plan is left with three Kolos
  const middle = koloRemovalOf(4, 2, [played1, kolo(2, true, true, true), kolo(3, true, true, true), kolo(4, false, false, false)])!;
  assert.deepEqual(middle, {number: 2, step: "played", alsoGo: [3, 4], rounds: 3, ends: false, resultsGo: true});
  assert.equal(removesResults(middle), true);
  // only a draft follows it: nothing played goes, so no warning about results — but the draft still goes
  const withDraft = koloRemovalOf(3, 2, [played1, kolo(2, true, false, false), kolo(3, false, false, false)])!;
  assert.deepEqual(withDraft, {number: 2, step: "out", alsoGo: [3], rounds: 2, ends: false, resultsGo: false});
  assert.equal(removesResults(withDraft), false);

  // --- Kolo 1 goes too, whatever state it is in (your screenshot: Kolo 1 Uživo, Kola 2-5 Čeka) -------------------
  const first = koloRemovalOf(5, 1, [live1])!;
  assert.deepEqual(first, {number: 1, step: "live", alsoGo: [], rounds: 4, ends: false, resultsGo: true});
  assert.equal(removesResults(first), true);
  // a played Kolo 1 with two more played after it: all three go and the plan has four Kolos left, none played
  const restart = koloRemovalOf(5, 1, [played1, kolo(2, true, true, true), kolo(3, true, true, true)])!;
  assert.deepEqual(restart, {number: 1, step: "played", alsoGo: [2, 3], rounds: 4, ends: false, resultsGo: true});

  // --- the warning sign: anything but a Kolo nobody has made yet -------------------------------------------------
  assert.equal(koloRemovalWarns(koloRemovalOf(4, 2, [])!), false);
  assert.equal(koloRemovalWarns(draft), true);
  assert.equal(koloRemovalWarns(first), true);
  // a waiting Kolo that still drags a made one along is a warning too
  assert.equal(koloRemovalWarns({number: 2, step: "waiting", alsoGo: [3], rounds: 3, ends: false, resultsGo: false}), true);
});

test("a whole tournament: 23 teams over 9 Kolos, nobody meets twice and no team has two byes", () => {
  const ids = Array.from({length: 23}, (_, i) => i + 1);
  const random = seeded(42);
  const tables: TableResult[] = [];
  const play = (pairs: KoloPair[], kolo: number) => {
    for (const [a, b] of pairs) {
      const bye = b === BYE_TEAM_ID;
      const wins1 = bye ? 2 : Math.floor(random() * 3);
      tables.push({kolo, team1Id: a, team2Id: b, team1Wins: wins1, team2Wins: 2 - wins1, open: false, started: true, diff: bye ? 602 : Math.round((random() - 0.5) * 400), scored: true, matches: 2});
    }
  };
  play(firstKoloPairs(ids, random), 1);
  for (let kolo = 2; kolo <= 9; kolo++) {
    const totals = tournamentTotals(ids, tables);
    const opponents = opponentsOf(tables);
    const standings = rankTeams(ids.map((id) => ({id, name: `Ekipa ${id}`, totals: totals.get(id)!})));
    const plan = swissPairs(standings.map((t) => swiss(t.id, t.totals.points, t.totals.difference, opponents.get(t.id) ?? [])));
    assert.deepEqual(plan.repeats, [], `Kolo ${kolo}`);
    assert.deepEqual(teamsIn(plan.pairs), ids);
    play(plan.pairs, kolo);
  }
  const met = new Set<string>();
  for (const t of tables) {
    if (t.team2Id === BYE_TEAM_ID) continue;
    const key = [t.team1Id, t.team2Id].sort((a, b) => a - b).join("-");
    assert.ok(!met.has(key), `${key} met twice`);
    met.add(key);
  }
  const byes = tables.filter((t) => t.team2Id === BYE_TEAM_ID).map((t) => t.team1Id);
  assert.equal(new Set(byes).size, byes.length);
});

const entry = (teamId: number, status: Entry["status"], minute: number): Entry => ({teamId, status, registeredAt: new Date(Date.UTC(2026, 9, 20, 10, minute))});

test("signing up: in while there is room, then the waiting list; no limit is always in", () => {
  assert.equal(signUpStatus(3, 4), "REGISTERED");
  assert.equal(signUpStatus(4, 4), "WAITING");
  assert.equal(signUpStatus(40, null), "REGISTERED");
});

test("the waiting list goes in sign-up order; a free place takes the team waiting longest", () => {
  const entries = [entry(1, "REGISTERED", 1), entry(2, "REGISTERED", 2), entry(5, "WAITING", 9), entry(4, "WAITING", 5)];
  assert.deepEqual(waitingList(entries).map((e) => e.teamId), [4, 5]);
  // team 2 leaves: one place for the first team waiting
  assert.deepEqual(rebalance(entries.filter((e) => e.teamId !== 2), 2), [{teamId: 4, status: "REGISTERED"}]);
  // a higher limit takes in as many as fit, no limit takes them all
  assert.deepEqual(rebalance(entries, 3), [{teamId: 4, status: "REGISTERED"}]);
  assert.deepEqual(rebalance(entries, null).map((c) => c.teamId), [4, 5]);
  assert.deepEqual(rebalance(entries, 2), []);
});

test("a lower limit sends the last teams to sign up to the waiting list", () => {
  const entries = [entry(1, "REGISTERED", 1), entry(2, "REGISTERED", 3), entry(3, "REGISTERED", 2), entry(9, "WAITING", 30)];
  assert.deepEqual(rebalance(entries, 2), [{teamId: 2, status: "WAITING"}]);
  assert.deepEqual(rebalance(entries, 1).map((c) => c.teamId), [3, 2]);
});

test("a player signs up with one team only", () => {
  assert.deepEqual(playersInOtherEntries([1, 2, 3], [{teamId: 7, playerIds: [3, 4]}, {teamId: 8, playerIds: [9]}]), [3]);
  assert.deepEqual(playersInOtherEntries([1, 2], []), []);
});

const table = (kolo: number, a: number, b: number, w1: number, w2: number, diff: number, open = false, started = true, scored = true, matches = 2): TableResult => ({
  kolo,
  team1Id: a,
  team2Id: b,
  team1Wins: w1,
  team2Wins: w2,
  open,
  started,
  diff,
  scored,
  matches,
});

test("the standings count tables played to the end: a win 2, a draw 1, the difference of every match, the bye too", () => {
  const tables = [table(1, 1, 2, 2, 0, 300), table(1, 3, BYE_TEAM_ID, 2, 0, 602), table(2, 1, 3, 1, 1, -20), table(2, 2, 4, 0, 0, 0, true), table(2, 5, 6, 0, 0, 0, true, false)];
  const totals = tournamentTotals([1, 2, 3, 4, 5, 6], tables);
  assert.deepEqual(totals.get(1), {teamId: 1, played: 2, wins: 1, draws: 1, losses: 0, points: 3, difference: 280, live: false});
  assert.deepEqual(totals.get(3), {teamId: 3, played: 2, wins: 1, draws: 1, losses: 0, points: 3, difference: 622, live: false});
  assert.equal(totals.get(2)!.losses, 1);
  assert.equal(totals.get(2)!.live, true);
  assert.equal(totals.get(4)!.played, 0);
  // a table not started yet isn't live
  assert.equal(totals.get(5)!.live, false);
  assert.ok(!totals.has(BYE_TEAM_ID));

  const ranked = rankTeams([1, 2, 3, 4].map((id) => ({id, name: `T${id}`, totals: totals.get(id)!})));
  assert.deepEqual(ranked.map((t) => t.id), [3, 1, 4, 2]);
  assert.deepEqual(opponentsOf(tables).get(3), [BYE_TEAM_ID, 1]);
});

test("with one match a table (1 partija po kolu) a win is worth 1, the bye's and a no-show's too", () => {
  const one = (kolo: number, a: number, b: number, w1: number, w2: number, diff: number) => table(kolo, a, b, w1, w2, diff, false, true, true, 1);
  const tables = [one(1, 1, 2, 1, 0, 300), one(1, 3, BYE_TEAM_ID, 1, 0, 301), one(2, 1, 3, 0, 1, -150), one(2, 2, 4, 1, 0, 301)];
  const totals = tournamentTotals([1, 2, 3, 4], tables);
  assert.deepEqual(totals.get(1), {teamId: 1, played: 2, wins: 1, draws: 0, losses: 1, points: 1, difference: 150, live: false});
  assert.deepEqual(totals.get(3), {teamId: 3, played: 2, wins: 2, draws: 0, losses: 0, points: 2, difference: 451, live: false});
  assert.equal(totals.get(2)!.points, 1);
  assert.equal(totals.get(4)!.points, 0);
});

test("a tournament that went to one match a table: each table counts by its own matches", () => {
  // Kolo 1 at two matches a table (2:0, a win 2), Kolo 2 after Partija po kolu went to 1 (a win 1)
  const tables = [table(1, 1, 2, 2, 0, 400), table(1, 3, 4, 1, 1, 20), table(2, 1, 3, 1, 0, 100, false, true, true, 1), table(2, 2, 4, 0, 1, -100, false, true, true, 1)];
  const totals = tournamentTotals([1, 2, 3, 4], tables);
  assert.deepEqual([1, 2, 3, 4].map((id) => totals.get(id)!.points), [3, 0, 1, 2]);
});

test("Poredak's order line says what a win is worth", () => {
  assert.equal(standingsOrderLabel(2), "Redoslijed: bodovi (pobjeda 2, neriješeno 1), pa razlika bodova, pa međusobni omjer na turniru.");
  assert.equal(standingsOrderLabel(1), "Redoslijed: bodovi (pobjeda 1), pa razlika bodova, pa međusobni omjer na turniru.");
});

test("equal points and difference go by name, in Croatian order", () => {
  const zero = {played: 0, wins: 0, draws: 0, losses: 0, points: 0, difference: 0, live: false};
  const ranked = rankTeams([{name: "Zagorci", totals: {teamId: 1, ...zero}}, {name: "Čakovčani", totals: {teamId: 2, ...zero}}, {name: "Dalmatinci", totals: {teamId: 3, ...zero}}]);
  assert.deepEqual(ranked.map((t) => t.name), ["Čakovčani", "Dalmatinci", "Zagorci"]);
});

test("a tournament is upcoming until Kolo 1 is out, active while Kolos are played, finished after the last one", () => {
  const t = {startedAt: null, cancelledAt: null, rounds: 2};
  assert.equal(tournamentPhase(t, []), "upcoming");
  assert.equal(tournamentPhase(t, [{number: 1, published: false, tables: 3, done: 0, live: 0}]), "upcoming");
  const started = {...t, startedAt: "2026-10-31T09:00:00Z"};
  const one = {number: 1, published: true, tables: 3, done: 3, live: 0};
  assert.equal(tournamentPhase(started, [one]), "active");
  assert.equal(tournamentPhase(started, [one, {number: 2, published: true, tables: 3, done: 2, live: 1}]), "active");
  assert.equal(tournamentPhase(started, [one, {number: 2, published: true, tables: 3, done: 3, live: 0}]), "finished");
  // the admin lowered Broj kola to the Kolos played: over
  assert.equal(tournamentPhase({...started, rounds: 1}, [one]), "finished");
  assert.equal(tournamentPhase({...t, cancelledAt: "2026-10-20T09:00:00Z"}, []), "cancelled");
});

test("the Kolos played, the one being played and every Kolo's step", () => {
  const kolos = [
    {number: 1, published: true, tables: 3, done: 3, live: 0},
    {number: 2, published: true, tables: 3, done: 1, live: 2},
  ];
  assert.equal(completedKolos(kolos), 1);
  assert.equal(liveKolo(kolos), 2);
  assert.equal(liveKolo([kolos[0]]), null);
  assert.deepEqual(
    koloSteps(4, [...kolos, {number: 3, published: false, tables: 3, done: 0, live: 0}]).map((k) => k.step),
    ["played", "live", "draft", "waiting"]
  );
});

test("the words of the tournament screens", () => {
  assert.equal(daysUntilLabel("2026-10-31", "2026-10-25"), "Za 6 dana");
  assert.equal(daysUntilLabel("2026-10-26", "2026-10-25"), "Sutra");
  assert.equal(daysUntilLabel("2026-10-25", "2026-10-25"), "Danas");
  assert.equal(daysUntilLabel("2026-11-15", "2026-10-25"), "Za 21 dan");
  assert.equal(daysUntilLabel("2026-10-20", "2026-10-25"), "");
  assert.equal(rulesLabel(true), "41 · zvanja · s ovim dosta");
  assert.equal(rulesLabel(false), "41 · bez zvanja · s ovim dosta");
  assert.equal(rulesLabel(true, 51), "51 · zvanja · s ovim dosta");
  assert.equal(formatLabel(9, 2), "9 kola");
  assert.equal(formatLabel(7, 1), "7 kola · 1 partija po kolu");
  assert.deepEqual(feeLabel(20), {title: "Kotizacija 20 € po igraču", sub: "Plaća se na dan turnira", free: false});
  assert.equal(feeLabel(0).title, "Bez stresa, bez obveza");
  assert.equal(capacityLabel(22, 24), "22 / 24");
  assert.equal(capacityLabel(9, null), "9");
  assert.deepEqual(dateTile("2026-10-31"), {weekday: "SUB", day: "31", month: "LIS"});
  assert.deepEqual(dateTile("2027-03-13"), {weekday: "SUB", day: "13", month: "OŽU"});
  assert.equal(dateTile("2026-02-31"), null);
});

test("the prizes' summary: the total of amounts in euros, else the prizes", () => {
  const p = (place: number, prize: string) => ({place, prize, description: ""});
  assert.equal(prizeSummary([p(1, "300 €"), p(2, "200 €"), p(3, "100 €")]), "Ukupno 600 € · prva tri mjesta");
  assert.equal(prizeSummary([p(1, "150€")]), "Ukupno 150 € · prvo mjesto");
  assert.equal(prizeSummary([p(1, "Pehar"), p(2, "Medalje"), p(3, "Medalje")]), "Pehar, Medalje · prva tri mjesta");
  assert.equal(prizeSummary([]), null);
});

test("a tournament's status in the admin's list", () => {
  assert.equal(tournamentStatus("upcoming", true, 3).label, "Lista čekanja · 3");
  assert.equal(tournamentStatus("upcoming", true, 0).label, "Prijave otvorene");
  assert.equal(tournamentStatus("upcoming", false, 0).label, "Prijave zatvorene");
  assert.equal(tournamentStatus("active", false, 2).label, "Uživo");
  assert.equal(tournamentStatus("finished", false, 0).label, "Završeno");
  assert.equal(tournamentStatus("cancelled", false, 0).label, "Otkazan");
});

test("a tournament's table of one match shows only Meč 1", async () => {
  const {matchSlots, currentMatchNumber} = await import("@/app/_lib/tableOverview");
  assert.equal(matchSlots([], 1).length, 1);
  assert.equal(matchSlots([]).length, 2);
  assert.equal(currentMatchNumber([{number: 1, kind: "finished"}], 1), 1);
});

test("a skipped table counts for nobody; a no-show's 5:0 counts as a win", () => {
  // Kolo 1: 1 beat 2 by a no-show (two matches scored as a bye, 5:0); 3 and 4 skipped
  const tables = [table(1, 1, 2, 2, 0, 602), table(1, 3, 4, 0, 0, 0, false, false, false)];
  const totals = tournamentTotals([1, 2, 3, 4], tables);
  assert.deepEqual(totals.get(1), {teamId: 1, played: 1, wins: 1, draws: 0, losses: 0, points: 2, difference: 602, live: false});
  assert.equal(totals.get(3)!.played, 0);
  assert.equal(totals.get(4)!.points, 0);
});

test("teams level on points and difference go by their head-to-head, then by name", () => {
  // 1, 2 and 3 all win one and lose one between them (the same difference); 1 beat 2, 2 beat 3, 3 beat 1: a circle,
  // so the name decides. 4 and 5 are level, and 5 beat 4.
  const tables = [
    table(1, 1, 2, 2, 0, 100),
    table(2, 2, 3, 2, 0, 100),
    table(3, 3, 1, 2, 0, 100),
    table(1, 4, 6, 2, 0, 50),
    table(2, 5, 7, 2, 0, 50),
    table(3, 5, 4, 1, 1, 0),
    table(4, 4, 8, 0, 2, -50),
    table(4, 5, 9, 0, 2, -50),
  ];
  const ids = [1, 2, 3, 4, 5];
  const totals = tournamentTotals(ids, tables);
  assert.equal(totals.get(4)!.points, totals.get(5)!.points);
  const names: Record<number, string> = {1: "Zadrani", 2: "Bjelovarci", 3: "Osječani", 4: "Ante", 5: "Zvonko"};
  const ranked = rankTeams(ids.map((id) => ({id, name: names[id], totals: totals.get(id)!})), tables);
  // 4 and 5 (3 points) drew their table, so the name (Ante before Zvonko); then the circle of 1, 2, 3 by name
  assert.deepEqual(ranked.map((t) => t.id), [4, 5, 2, 3, 1]);

  // 5 beats 4 at their table: 5 goes ahead though its name comes later
  const won = tables.map((t) => (t.team1Id === 5 && t.team2Id === 4 ? table(3, 5, 4, 2, 0, 0) : t));
  const wonTotals = tournamentTotals(ids, won);
  // give 4 the same points and difference as 5 for the test
  const level = {...wonTotals.get(5)!};
  const ranked2 = rankTeams(
    [4, 5].map((id) => ({id, name: names[id], totals: {...level, teamId: id}})),
    won
  );
  assert.deepEqual(ranked2.map((t) => t.id), [5, 4]);
});

test("a draft of any Kolo is stale once the teams that play are not the ones at its tables", () => {
  const draft = [
    {team1Id: 1, team2Id: 2},
    {team1Id: 3, team2Id: BYE_TEAM_ID},
  ];
  assert.equal(draftIsStale(draft, [3, 2, 1]), false, "the same teams, the bye aside");
  assert.equal(draftIsStale(draft, [1, 2, 3, 4]), true, "a waiting team came in after the draft was made");
  assert.equal(draftIsStale(draft, [1, 2]), true, "a team left or was excluded");
  assert.equal(draftIsStale(draft, [1, 2, 4]), true, "one out, another in");
  assert.equal(draftIsStale([], [1, 2]), false, "no draft");
});

test("a tournament whose day passed without starting isn't coming up for the players", () => {
  assert.equal(isComingUp({phase: "upcoming", date: "2026-10-31"}, "2026-10-30"), true);
  assert.equal(isComingUp({phase: "upcoming", date: "2026-10-30"}, "2026-10-30"), true, "today still counts");
  assert.equal(isComingUp({phase: "upcoming", date: "2026-10-26"}, "2026-10-30"), false);
  assert.equal(isComingUp({phase: "active", date: "2026-10-31"}, "2026-10-30"), false);
});

test("joining ends once the last Kolo is made, a draft of it too", async () => {
  const {lastKoloMade} = await import("@/app/_lib/tournaments");
  const kolo = (number: number, published: boolean) => ({number, published, tables: 4, done: 0, live: 0});
  assert.equal(lastKoloMade([kolo(1, true), kolo(2, true)], 3), false);
  assert.equal(lastKoloMade([kolo(1, true), kolo(2, true), kolo(3, false)], 3), true);
  assert.equal(lastKoloMade([kolo(1, true), kolo(2, true), kolo(3, true)], 3), true);
});

test("Otvorene prijave: a closed tournament takes teams until it starts, an open one until its last Kolo is made", () => {
  const open = (over: Partial<Parameters<typeof signUpsOpenNow>[0]> = {}) =>
    signUpsOpenNow({phase: "active", registrationsOpen: true, openSignups: true, lastKoloMade: false, ...over});

  // before the start both kinds take teams, as they always did
  assert.equal(open({phase: "upcoming", openSignups: false}), true);
  assert.equal(open({phase: "upcoming", openSignups: true}), true);

  // a closed tournament takes nobody once it is being played
  assert.equal(open({openSignups: false}), false);
  // an open one does, right up to the moment its last Kolo is made (a draft counts)
  assert.equal(open(), true);
  assert.equal(open({lastKoloMade: true}), false);

  // the admin's own Prijave switch wins over everything
  assert.equal(open({registrationsOpen: false}), false);
  assert.equal(open({phase: "upcoming", registrationsOpen: false}), false);

  // a tournament that is over or cancelled takes nobody, open or not
  for (const phase of ["finished", "cancelled"] as const) {
    assert.equal(open({phase}), false, phase);
    assert.equal(open({phase, openSignups: false}), false, phase);
  }
});

test("the tournament form's switch reaches the server: open_signups survives the request's validation", () => {
  const body = {
    name: "Kafić", date: "2026-12-01", gathering_time: null, start_time: null,
    location_name: null, location_address: null, location_url: null,
    rounds: 3, matches_per_round: 2, declarations: true, max_teams: null, entry_fee: 0,
    rules_url: null, prizes: [], game_minutes: 35, auto_publish: false, organizer_phone: "0931234567",
  };
  // the field would be dropped without a line in the schema, and the tournament would quietly stay closed
  assert.equal(TournamentRequestValidation.parse({...body, open_signups: true}).open_signups, true);
  assert.equal(TournamentRequestValidation.parse({...body, open_signups: false}).open_signups, false);
  // left out: a tournament is closed, as every tournament made before this was
  assert.equal(TournamentRequestValidation.parse(body).open_signups, false);
  // Zvanja: kept as sent, and with zvanja when a form opened before the switch came back leaves it out
  assert.equal(TournamentRequestValidation.parse({...body, declarations: false}).declarations, false);
  const {declarations: _declarations, ...beforeZvanja} = body;
  void _declarations;
  assert.equal(TournamentRequestValidation.parse(beforeZvanja).declarations, true);
  // Igra se do: 41 or 51, and 41 when an older form leaves it out
  assert.equal(TournamentRequestValidation.parse({...body, score_threshold: 51}).score_threshold, 51);
  assert.equal(TournamentRequestValidation.parse(body).score_threshold, 41);
  assert.equal(TournamentRequestValidation.safeParse({...body, score_threshold: 61}).success, false);
});

test("Otvorene prijave: who counts as present, and what switching the setting off does", () => {
  // a team that comes in once the day's switch has run is here: that starts at the start time, not at Kolo 1
  assert.equal(joinsAsPresent({openSignups: true, dayClosed: true}), true);
  // before the start it signs up like anyone: it still has to press Tu smo
  assert.equal(joinsAsPresent({openSignups: true, dayClosed: false}), false);
  // a tournament without Otvorene prijave keeps the old flow in both cases
  assert.equal(joinsAsPresent({openSignups: false, dayClosed: true}), false);
  assert.equal(joinsAsPresent({openSignups: false, dayClosed: false}), false);

  // switching the setting off while it is played closes the sign-ups: the database refuses a started tournament
  // that keeps them open (Tournament_started_check), so the save would be a 500 without this
  assert.equal(signUpsCloseWithSwitch({started: true, registrationsOpen: true, openSignupsAfter: false}), true);
  // nothing to close
  assert.equal(signUpsCloseWithSwitch({started: true, registrationsOpen: false, openSignupsAfter: false}), false);
  // it stays open: that is the whole point of the setting
  assert.equal(signUpsCloseWithSwitch({started: true, registrationsOpen: true, openSignupsAfter: true}), false);
  // before the start the sign-ups are the admin's own business, whatever the setting says
  assert.equal(signUpsCloseWithSwitch({started: false, registrationsOpen: true, openSignupsAfter: false}), false);
});

test("how long a match takes: 40 min to 41 without zvanja, 35 with them, 5 more to 51", () => {
  assert.equal(typicalGameMinutes(41, false), 40);
  assert.equal(typicalGameMinutes(41, true), 35);
  assert.equal(typicalGameMinutes(51, false), 45);
  assert.equal(typicalGameMinutes(51, true), 40);
  assert.match(gameLengthNote(51, true), /^Za ovaj format \(do 51, sa zvanjima\) 95 % partija završi unutar 40 min\./);
  assert.match(gameLengthNote(41, false), /unutar 40 min\. Do 41 bez zvanja to je 40 min, sa zvanjima 35 min; do 51 sve traje 5 min dulje/);
});
