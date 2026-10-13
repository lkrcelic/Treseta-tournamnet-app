import {test} from "node:test";
import assert from "node:assert/strict";
import {Prisma} from "@prisma/client";
import {Team, TeamPair} from "@/app/_lib/matching/multipleRoundMatching";
import {emptyRecord, fairShares, seatRounds, SeatedPair, SmokingRecord, SmokingRound, smokingRecords} from "@/app/_lib/matching/smokingTables";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {teamSmokers} from "@/app/_lib/service/team/smokers";

const team = (id: number): Team => ({id, name: `Team ${id}`, score: 0, point_difference: 0, played_against: []});
const bye: Team = {id: BYE_TEAM_ID, name: "Bye", score: 0, point_difference: 0, played_against: []};
// pairs in the order the pairing gives them: [1, 2] is the best-ranked table
const round = (...pairs: [number, number][]): TeamPair[] =>
  pairs.map(([a, b]) => ({teamOne: a === BYE_TEAM_ID ? bye : team(a), teamTwo: b === BYE_TEAM_ID ? bye : team(b)}));
const smokers = (entries: Record<number, number>) => new Map(Object.entries(entries).map(([id, n]) => [Number(id), n]));
const records = (entries: Record<number, Partial<SmokingRecord>>) =>
  new Map(Object.entries(entries).map(([id, r]) => [Number(id), {...emptyRecord(), ...r}]));

// "1-2@3": teams 1 and 2 at table 3, with "*" when it is a smoking table
const show = (seated: SeatedPair[]) => seated.map((p) => `${p.teamOne.id}-${p.teamTwo.id}@${p.table}${p.smoking ? "*" : ""}`);
const smokingTeams = (seated: SeatedPair[]) =>
  seated.filter((p) => p.smoking).flatMap((p) => [p.teamOne.id, p.teamTwo.id]).sort((a, b) => a - b);

test("without smoking tables every round keeps its order: tables 1, 2, ... and the bye last", () => {
  const rounds = [round([1, 2], [3, 4], [5, BYE_TEAM_ID])];
  assert.deepEqual(show(seatRounds(rounds)[0]), ["1-2@1", "3-4@2", `5-${BYE_TEAM_ID}@3`]);
  assert.deepEqual(show(seatRounds(rounds, {tables: [], smokers: smokers({1: 2}), records: new Map()})[0]), ["1-2@1", "3-4@2", `5-${BYE_TEAM_ID}@3`]);
});

test("a match with smokers sits at the smoking table, the others keep their order on the rest", () => {
  const seated = seatRounds([round([1, 2], [3, 4], [5, 6], [7, 8])], {tables: [2], smokers: smokers({7: 1}), records: new Map()})[0];
  assert.deepEqual(show(seated), ["1-2@1", "7-8@2*", "3-4@3", "5-6@4"]);
});

test("the smoking tables go in the order of their numbers, the match with more smokers first", () => {
  const seated = seatRounds([round([1, 2], [3, 4], [5, 6], [7, 8])], {
    tables: [4, 1],
    smokers: smokers({2: 1, 5: 1, 6: 2}),
    records: new Map(),
  })[0];
  assert.deepEqual(show(seated), ["5-6@1*", "3-4@2", "7-8@3", "1-2@4*"]);
});

test("a smoking table no smoking team needs still gets a match, and is still a smoking table", () => {
  const seated = seatRounds([round([1, 2], [3, 4], [5, 6])], {tables: [1, 2], smokers: smokers({5: 1}), records: new Map()})[0];
  assert.deepEqual(show(seated), ["5-6@1*", "1-2@2*", "3-4@3"]);
});

test("smoking tables above the round's number of tables are left out, and the bye never gets one", () => {
  const seated = seatRounds([round([1, 2], [3, BYE_TEAM_ID])], {tables: [2, 5], smokers: smokers({3: 3}), records: new Map()})[0];
  assert.deepEqual(show(seated), ["1-2@1", `3-${BYE_TEAM_ID}@2`]);
});

test("equal needs keep the pairing's order", () => {
  const seated = seatRounds([round([1, 2], [3, 4], [5, 6])], {tables: [3], smokers: smokers({2: 1, 3: 1, 6: 1}), records: new Map()})[0];
  assert.deepEqual(show(seated), ["3-4@1", "5-6@2", "1-2@3*"]);
});

test("one smoking table over three rounds: every smoking team gets a turn before anyone gets a second", () => {
  // teams 1, 3 and 5 smoke; each round they play a different non-smoking team
  const rounds = [round([1, 2], [3, 4], [5, 6]), round([1, 4], [3, 6], [5, 2]), round([1, 6], [3, 2], [5, 4])];
  const seated = seatRounds(rounds, {tables: [1], smokers: smokers({1: 2, 3: 1, 5: 1}), records: new Map()});
  assert.deepEqual(seated.map(smokingTeams), [[1, 2], [3, 6], [4, 5]]);
});

test("a team that already sat at a smoking table tonight waits for the ones that haven't", () => {
  const seated = seatRounds([round([1, 2], [3, 4])], {
    tables: [1],
    smokers: smokers({1: 3, 3: 1}),
    records: records({1: {tonight: 1, smokingRounds: 1}}),
  })[0];
  assert.deepEqual(smokingTeams(seated), [3, 4]);
});

test("a night without a smoking table outweighs more smokers", () => {
  const seated = seatRounds([round([1, 2], [3, 4])], {
    tables: [1],
    // team 1 has three smokers and team 2 two; team 3 has one smoker and went a night without a smoking table
    smokers: smokers({1: 3, 2: 2, 3: 1}),
    records: records({3: {missedNights: 1}}),
  })[0];
  assert.deepEqual(smokingTeams(seated), [3, 4]);
});

test("more nights without a smoking table go first, also against a table of two teams with one", () => {
  const seated = seatRounds([round([1, 2], [3, 4])], {
    tables: [1],
    smokers: smokers({1: 1, 2: 1, 3: 1}),
    records: records({1: {missedNights: 1}, 2: {missedNights: 1}, 3: {missedNights: 2}}),
  })[0];
  assert.deepEqual(smokingTeams(seated), [3, 4]);
});

test("a night without a smoking table doesn't count once the team has sat at one tonight", () => {
  const seated = seatRounds([round([1, 2], [3, 4])], {
    tables: [1],
    smokers: smokers({1: 1, 3: 1}),
    records: records({1: {missedNights: 3, tonight: 1, smokingRounds: 4}}),
  })[0];
  assert.deepEqual(smokingTeams(seated), [3, 4]);
});

test("among teams that sat tonight, the ones below their fair share this season go first", () => {
  const seated = seatRounds([round([1, 2], [3, 4])], {
    tables: [1],
    smokers: smokers({1: 1, 3: 1}),
    records: records({1: {tonight: 1, smokingRounds: 6, fairShare: 4}, 3: {tonight: 1, smokingRounds: 2, fairShare: 4}}),
  })[0];
  assert.deepEqual(smokingTeams(seated), [3, 4]);
});

test("two teams that haven't sat tonight beat one, and the next round goes to a match with a team that hasn't", () => {
  const rounds = [round([1, 3], [2, 4]), round([1, 2], [3, 4])];
  // round 1: 1-3 has two teams that haven't sat (1 has two smokers), 2-4 one; round 2: 1-2 (2 hasn't sat) wins
  const seated = seatRounds(rounds, {tables: [1], smokers: smokers({1: 2, 2: 1, 3: 1}), records: new Map()});
  assert.deepEqual(seated.map(smokingTeams), [[1, 3], [1, 2]]);
});

// the roster query answered as Prisma would, over players given as [team, smoker, active]
const rosterDb = (players: [number, boolean, boolean][]) =>
  ({
    teamPlayer: {
      findMany: async ({where}: {where: {team_id: {in: number[]}; player: {smoker?: boolean; active?: boolean}}}) =>
        players
          .map(([team_id, smoker, active]) => ({team_id, player: {smoker, active}}))
          .filter((r) => where.team_id.in.includes(r.team_id))
          .filter((r) => Object.entries(where.player).every(([field, value]) => r.player[field as "smoker" | "active"] === value)),
    },
  }) as unknown as Prisma.TransactionClient;

test("a team's smokers are its players with Pušač on, but not deactivated ones, and the bye has none", async () => {
  const db = rosterDb([
    [1, true, true],
    [1, true, false], // deactivated: still on the roster, but can't play
    [1, false, true],
    [2, true, false],
    [3, true, true],
    [3, true, true],
    [4, true, true], // a team that wasn't asked for
  ]);
  assert.deepEqual(await teamSmokers([1, 2, 3, BYE_TEAM_ID], db), new Map([[1, 1], [3, 2]]));
});

test("fair shares split the smoking seats by smokers, at most one per team", () => {
  assert.deepEqual(fairShares(4, [2, 1, 1]), [1, 1, 1]);
  assert.deepEqual(fairShares(2, [1, 1, 1, 1]), [0.5, 0.5, 0.5, 0.5]);
  // three smokers would take 1.2 of two seats; it gets 1 and the other two split what's left
  assert.deepEqual(fairShares(2, [3, 1, 1]), [1, 0.5, 0.5]);
  assert.deepEqual(fairShares(2, [2, 1, 1]), [1, 0.5, 0.5]);
  assert.deepEqual(fairShares(0, [1, 1]), [0, 0]);
  assert.deepEqual(fairShares(2, []), []);
  const shares = fairShares(3, [2, 1, 1, 1, 1]);
  assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 3) < 1e-9);
  assert.ok(Math.abs(shares[0] - 2 * shares[1]) < 1e-9);
});

// A table of a league round: "1-2*" is teams 1 and 2 at a smoking table
const tables = (date: string, roundNumber: number, smokersOf: Record<number, number>, ...list: string[]): SmokingRound[] =>
  list.map((t) => {
    const [a, b] = t.replace("*", "").split("-").map(Number);
    return {date, roundNumber, team1Id: a, team2Id: b, team1Smokers: smokersOf[a] ?? 0, team2Smokers: smokersOf[b] ?? 0, smoking: t.endsWith("*")};
  });

test("records count smoking rounds, fair shares and nights without a smoking table", () => {
  const s = {1: 1, 3: 1, 5: 2};
  const rounds = [
    ...tables("2026-10-01", 1, s, "1-2*", "3-4", "5-6"),
    ...tables("2026-10-01", 2, s, "1-4", "3-6", "5-2*"),
    // a night without smoking tables: nobody misses it
    ...tables("2026-10-08", 3, s, "1-2", "3-4", "5-6"),
    // tonight: counts for the rounds, not as a missed night yet
    ...tables("2026-10-15", 4, s, "1-6", "3-2*", "5-4"),
  ];
  const r = smokingRecords(rounds, "2026-10-15");
  // one smoking table is two seats a round: team 5 (two smokers) gets one, teams 1 and 3 half each
  assert.deepEqual(r.get(1), {smokingRounds: 1, fairShare: 1.5, missedNights: 0, tonight: 0});
  // team 3 sat at no smoking table on 1 October
  assert.deepEqual(r.get(3), {smokingRounds: 1, fairShare: 1.5, missedNights: 1, tonight: 1});
  assert.deepEqual(r.get(5), {smokingRounds: 1, fairShare: 3, missedNights: 0, tonight: 0});
  // teams without smokers have no record
  assert.equal(r.get(2), undefined);
});

test("records skip the bye, rounds where the team had no smoker, and later nights", () => {
  const rounds = [
    ...tables("2026-10-01", 1, {1: 1}, `1-${BYE_TEAM_ID}`, "2-3*"),
    // team 4 had no smoker that night (it joined later), so it didn't miss it
    ...tables("2026-10-01", 2, {1: 1}, "1-2*", "3-4"),
    ...tables("2026-10-20", 3, {1: 1, 4: 1}, "1-4*"),
  ];
  const r = smokingRecords(rounds, "2026-10-15");
  assert.deepEqual(r.get(1), {smokingRounds: 1, fairShare: 1, missedNights: 0, tonight: 0});
  assert.equal(r.get(4), undefined);
});

// deterministic pseudo random numbers
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

test("over a season every smoking team rotates in: teams with one smoker miss about as many nights as each other", () => {
  const random = rng(3);
  const ids = Array.from({length: 20}, (_, i) => i + 1);
  // eight teams with one smoker, four with two
  const smokersOf = smokers(Object.fromEntries(ids.map((id) => [id, id <= 4 ? 2 : id <= 12 ? 1 : 0])));
  const history: SmokingRound[] = [];
  for (let night = 1; night <= 24; night++) {
    const date = `2026-${String(Math.ceil(night / 28) + 9).padStart(2, "0")}-${String(night).padStart(2, "0")}`;
    const rounds = Array.from({length: 3}, () => {
      const order = [...ids].sort(() => random() - 0.5);
      return Array.from({length: 10}, (_, k) => ({teamOne: team(order[2 * k]), teamTwo: team(order[2 * k + 1])}));
    });
    // one smoking table: three seats a night for twelve smoking teams, so most miss most nights
    const seated = seatRounds(rounds, {tables: [1], smokers: smokersOf, records: smokingRecords(history, date)});
    seated.forEach((r, k) =>
      r.forEach((p) =>
        history.push({
          date,
          roundNumber: night * 10 + k,
          team1Id: p.teamOne.id,
          team2Id: p.teamTwo.id,
          team1Smokers: smokersOf.get(p.teamOne.id) ?? 0,
          team2Smokers: smokersOf.get(p.teamTwo.id) ?? 0,
          smoking: p.smoking,
        })
      )
    );
  }
  const final = smokingRecords(history, "2027-01-01");
  const missed = (id: number) => final.get(id)!.missedNights;
  const one = [5, 6, 7, 8, 9, 10, 11, 12].map(missed);
  // without the season's records the same pairings leave them 11 to 20 nights without one
  assert.ok(Math.max(...one) - Math.min(...one) <= 2, `nights without a smoking table: ${one.join(", ")}`);
  const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
  assert.ok(mean([1, 2, 3, 4].map(missed)) <= mean(one), "two smokers miss no more nights than one");
});

test("with spare smoking tables, teams with more smokers sit at them more often", () => {
  const random = rng(9);
  const ids = Array.from({length: 16}, (_, i) => i + 1);
  const smokersOf = smokers(Object.fromEntries(ids.map((id) => [id, id <= 3 ? 2 : id <= 9 ? 1 : 0])));
  const history: SmokingRound[] = [];
  for (let night = 1; night <= 20; night++) {
    const date = `2026-10-${String(night).padStart(2, "0")}`;
    const rounds = Array.from({length: 4}, () => {
      const order = [...ids].sort(() => random() - 0.5);
      return Array.from({length: 8}, (_, k) => ({teamOne: team(order[2 * k]), teamTwo: team(order[2 * k + 1])}));
    });
    const seated = seatRounds(rounds, {tables: [1, 2, 3, 4], smokers: smokersOf, records: smokingRecords(history, date)});
    seated.forEach((r, k) =>
      r.forEach((p) =>
        history.push({
          date,
          roundNumber: night * 10 + k,
          team1Id: p.teamOne.id,
          team2Id: p.teamTwo.id,
          team1Smokers: smokersOf.get(p.teamOne.id) ?? 0,
          team2Smokers: smokersOf.get(p.teamTwo.id) ?? 0,
          smoking: p.smoking,
        })
      )
    );
  }
  const final = smokingRecords(history, "2027-01-01");
  const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
  const two = mean([1, 2, 3].map((id) => final.get(id)!.smokingRounds));
  const one = mean([4, 5, 6, 7, 8, 9].map((id) => final.get(id)!.smokingRounds));
  assert.ok(two > one * 1.3, `two smokers ${two}, one smoker ${one}`);
  assert.ok(ids.filter((id) => id <= 9).every((id) => final.get(id)!.missedNights === 0), "nobody misses a night");
});
