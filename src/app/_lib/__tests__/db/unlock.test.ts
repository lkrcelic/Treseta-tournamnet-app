import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {prisma} from "@/app/_lib/prisma";
import {addHand, getTablePad} from "@/app/_lib/service/admin/hands";
import {answerAttendance, skipDueTables} from "@/app/_lib/service/tournament/attendance";
import {gameMinutesOf} from "@/app/_lib/service/match/timeLimit";
import {getTournamentResults} from "@/app/_lib/service/tournament/tournaments";
import {NOT_LOCKED, unlockTable} from "@/app/_lib/service/admin/unlock";
import {NO_SHOW_SKIP_MS, NO_SHOW_UNLOCK_MS} from "@/app/_lib/tournamentDay";
import {HAND_POINTS, MATCH_THRESHOLD, MatchEnd, TARGET_RAISE} from "@/app/_lib/game/scoring";
import {TARGET_RAISE_MINUTES} from "@/app/_lib/gameTime";

// Otključaj partiju against a real Postgres (DECISIONS #89): a table locked by Nedolazak, by a skipped match and by
// Vrijeme partije is unlocked, and what the lock did is undone with it. Every unlock gives the tournament's Vrijeme
// partije (35 here), whatever the table had (Bela's DECISIONS #102), and in Treseta whatever raises of the target the
// hands already had. Run with `npm run test:db` and DATABASE_URL on
// a throwaway database with the migrations applied (it adds its own tournament, teams and players and removes them
// afterwards). Never point it at production.

const tag = `ul${Date.now()}`;
// the tournament's Vrijeme partije
const MINUTES = 35;
let tournamentId = 0;
let adminId = 0;
const teams: number[] = [];
const players: number[] = [];
const rounds: number[] = [];

const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

before(async () => {
  const t = await prisma.tournament.create({
    data: {tournament_name: `${tag} turnir`, date: today(), rounds: 3, game_minutes: MINUTES, started_at: new Date(), registrations_open: false},
  });
  tournamentId = t.tournament_id;
  for (const name of ["A", "B", "C", "D", "E", "F"]) {
    const team = await prisma.team.create({data: {team_name: `${tag} ${name}`}});
    teams.push(team.team_id);
    const player = await prisma.player.create({
      data: {first_name: tag, last_name: name, username: `${tag}${name}`.toLowerCase().slice(0, 20), password_hash: "x", email: `${tag}${name}@test.local`.toLowerCase(), player_role: "PLAYER"},
    });
    players.push(player.id);
    await prisma.teamPlayer.create({data: {team_id: team.team_id, player_id: player.id}});
    await prisma.tournamentTeam.create({data: {tournament_id: tournamentId, team_id: team.team_id, status: "REGISTERED", active: true, arrived_at: new Date()}});
  }
  const admin = await prisma.player.create({data: {first_name: tag, last_name: "Admin", username: `${tag}admin`.toLowerCase().slice(0, 20), password_hash: "x", email: `${tag}admin@test.local`.toLowerCase(), player_role: "ADMIN"}});
  adminId = admin.id;
});

after(async () => {
  await prisma.signupBan.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.ongoingMatch.deleteMany({where: {round_id: {in: rounds}}});
  await prisma.match.deleteMany({where: {round_id: {in: rounds}}});
  await prisma.tournamentRound.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.round.deleteMany({where: {id: {in: rounds}}});
  await prisma.tournamentTeam.deleteMany({where: {tournament_id: tournamentId}});
  await prisma.tournament.delete({where: {tournament_id: tournamentId}});
  await prisma.teamPlayer.deleteMany({where: {team_id: {in: teams}}});
  await prisma.team.deleteMany({where: {team_id: {in: teams}}});
  await prisma.player.deleteMany({where: {id: {in: [...players, adminId]}}});
  await prisma.$disconnect();
});

// a published table of the tournament whose Kolo went out this many milliseconds ago
async function table(kolo: number, team1: number, team2: number, outFor: number, matchesPerRound = 1) {
  const round = await prisma.round.create({
    data: {
      team1_id: team1,
      team2_id: team2,
      round_number: kolo,
      round_date: today(),
      status: "PUBLISHED",
      published_at: new Date(Date.now() - outFor),
      matches_per_round: matchesPerRound,
      tournamentRounds: {create: {tournament_id: tournamentId}},
    },
  });
  rounds.push(round.id);
  return round.id;
}

const entry = (teamId: number) => prisma.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}}});

test("Nedolazak unlocked: the 5 : 0 (NO_SHOW_SCORE) goes, the team is back in the tournament and its ban with it", async () => {
  const roundId = await table(1, teams[0], teams[1], NO_SHOW_UNLOCK_MS + 1000);
  const viewer = {id: players[0], player_role: "PLAYER"};
  assert.equal(await answerAttendance(roundId, viewer, "NO_SHOW"), "NO_SHOW");
  // what the answer did: the result, the exclusion and, in Kolo 1, the ban
  assert.equal(await prisma.match.count({where: {round_id: roundId}}), 1);
  assert.equal((await entry(teams[1])).excluded_reason, "NO_SHOW");
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, team_id: teams[1], lifted_at: null}}), 1);
  const locked = await getTablePad(roundId);
  assert.equal(locked.lock?.kind, "no_show");
  assert.ok(locked.lock?.absent?.includes("B"));

  const out = await unlockTable(roundId, adminId);
  assert.deepEqual([out.kind, out.minutes, out.resumed, out.bans_lifted], ["no_show", 35, false, 1]);
  assert.equal(await prisma.match.count({where: {round_id: roundId}}), 0);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.open, round.attendance, round.team1_wins, round.team2_wins, round.game_minutes], [true, "PRESENT", 0, 0, null]);
  const back = await entry(teams[1]);
  assert.deepEqual([back.excluded_at, back.excluded_reason, back.active], [null, null, true]);
  // the ban and the player's ban under it are lifted
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, lifted_at: null}}), 0);
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, player_id: players[1], lifted_at: {not: null}}}), 1);
  // the game Započni igru starts has the tournament's Vrijeme partije
  assert.equal(await gameMinutesOf(prisma, roundId), 35);
  const pad = await getTablePad(roundId);
  assert.equal(pad.lock, null);
  assert.equal(pad.gameMinutes, 35);
  // an open table can't be unlocked again
  await assert.rejects(unlockTable(roundId, adminId), {message: NOT_LOCKED});
  // and the question doesn't come back at it: its Kolo went out long ago, so the skip would close it again at once
  assert.equal(round.attendance, "PRESENT");
  assert.deepEqual(await skipDueTables(tournamentId), []);
  assert.equal((await prisma.round.findUniqueOrThrow({where: {id: roundId}})).open, true);
});

test("Preskočen unlocked: both teams come back and the table is new again", async () => {
  const roundId = await table(1, teams[2], teams[3], NO_SHOW_SKIP_MS + 1000);
  assert.deepEqual(await skipDueTables(tournamentId), [roundId]);
  assert.equal((await getTablePad(roundId)).lock?.kind, "skipped");
  for (const t of [teams[2], teams[3]]) assert.equal((await entry(t)).excluded_reason, "SKIPPED");

  const out = await unlockTable(roundId, adminId);
  assert.deepEqual([out.kind, out.resumed, out.restored.length], ["skipped", false, 2]);
  for (const t of [teams[2], teams[3]]) assert.equal((await entry(t)).excluded_at, null);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.open, round.attendance, round.active, round.game_minutes], [true, "PRESENT", false, null]);
  // the skipped table isn't skipped again the moment the clock is read
  assert.deepEqual(await skipDueTables(tournamentId), []);
  assert.equal(await prisma.signupBan.count({where: {tournament_id: tournamentId, lifted_at: null}}), 0);
});

test("Vrijeme isteklo unlocked: the match carries on with its hands, the tournament's time from now and the win off the score", async () => {
  // a table of two matches with its own 20 minutes, as an unlock wrote them before every unlock took the tournament's
  const roundId = await table(2, teams[4], teams[5], 60_000, 2);
  await prisma.round.update({where: {id: roundId}, data: {game_minutes: 20}});
  assert.equal(await gameMinutesOf(prisma, roundId), 35, "a table's own time isn't read");
  const match = await prisma.match.create({
    data: {
      round_id: roundId,
      player_pair1_score: 30,
      player_pair2_score: 18,
      score_threshold: 41,
      // closed by the clock: the team with more points won it
      winner_side: 1,
      time_expired: true,
      start_time: new Date(Date.now() - 35 * 60_000),
      end_time: new Date(),
      match_date: today(),
      results: {
        create: [
          {team1_game_points: 8, team2_game_points: 3, team1_zvanja3: 1},
          {team1_game_points: 4, team2_game_points: 7},
          {team1_game_points: 15, team2_game_points: 8, custom: true},
        ],
      },
    },
  });
  await prisma.round.update({where: {id: roundId}, data: {open: false, active: false, team1_wins: 1}});
  assert.equal((await getTablePad(roundId)).lock?.kind, "time_expired");
  // the Kolo's status quotes the tournament's Vrijeme partije, not the table's own 20
  const results = await getTournamentResults(tournamentId, null);
  const status = results.kolos.flatMap((k) => k.tables).find((x) => x.id === roundId)?.state;
  assert.equal(status?.label, "Vrijeme isteklo");
  assert.match(status?.note ?? "", /završena nakon 35 min/);

  const out = await unlockTable(roundId, adminId);
  assert.deepEqual([out.kind, out.resumed, out.minutes], ["time_expired", true, 35]);
  // the finished match is gone and is the match being played again, with both hands and the zvanje on the first and the custom hand
  assert.equal(await prisma.match.count({where: {id: match.id}}), 0);
  const ongoing = await prisma.ongoingMatch.findFirstOrThrow({where: {round_id: roundId}, include: {results: {orderBy: {result_id: "asc"}}}});
  assert.deepEqual([ongoing.player_pair1_score, ongoing.player_pair2_score, ongoing.score_threshold], [30, 18, 41]);
  assert.equal(ongoing.results.length, 3);
  assert.equal(ongoing.results[0].team1_zvanja3, 1);
  assert.equal(ongoing.results[2].custom, true);
  assert.ok(ongoing.ends_at && Math.abs(ongoing.ends_at.getTime() - (Date.now() + 35 * 60_000)) < 60_000);
  assert.ok(Math.abs(new Date(out.ends_at).getTime() - ongoing.ends_at.getTime()) < 1000);
  const round = await prisma.round.findUniqueOrThrow({where: {id: roundId}});
  assert.deepEqual([round.open, round.active, round.team1_wins, round.team2_wins, round.game_minutes], [true, true, 0, 0, null]);
  // the pad opens on the match being played, with the tournament's time, which the table's second match has too
  const pad = await getTablePad(roundId);
  assert.deepEqual([pad.lock, pad.gameMinutes, pad.matches.map((m) => m.kind)], [null, 35, ["ongoing"]]);
  assert.equal(await gameMinutesOf(prisma, roundId), 35);
});

test("a table played to the end with no match at all is unlocked with nothing to carry on", async () => {
  const roundId = await table(3, teams[0], teams[2], 60_000);
  await prisma.round.update({where: {id: roundId}, data: {open: false}});
  const out = await unlockTable(roundId, adminId);
  assert.deepEqual([out.kind, out.resumed, out.minutes], ["done", false, 35]);
});

// Treseta's own (gameTime.ts): every raise of the target gives a match five more minutes, counted from its hands at
// every hand (syncDeadline). An unlocked match has the tournament's minutes from the unlock whatever its hands raised,
// and keeps that deadline at the next hand: only a raise after the unlock adds five.

// A table of Kolo 3 whose finished match was left without a winner, from these custom hands ([team 1, team 2]), on
// the table's rule ("s ovim dosta" or "na prolaz"): locked, as played out, for Otključaj partiju
async function lockedMatch(team1: number, team2: number, hands: [number, number][], end: MatchEnd = "S_OVIM_DOSTA") {
  const roundId = await table(3, team1, team2, 60_000);
  const total = (side: 0 | 1) => hands.reduce((sum, hand) => sum + hand[side], 0);
  await prisma.match.create({
    data: {
      round_id: roundId,
      player_pair1_score: total(0),
      player_pair2_score: total(1),
      score_threshold: MATCH_THRESHOLD,
      winner_side: null,
      start_time: new Date(Date.now() - 40 * 60_000),
      end_time: new Date(),
      match_date: today(),
      results: {create: hands.map(([a, b]) => ({team1_game_points: a, team2_game_points: b, custom: true}))},
    },
  });
  await prisma.round.update({where: {id: roundId}, data: {open: false, active: false, match_end: end}});
  assert.equal((await getTablePad(roundId)).lock?.kind, "done");
  return roundId;
}

// the minutes left on the clock of the table's match being played
async function minutesLeft(roundId: number) {
  const m = await prisma.ongoingMatch.findFirstOrThrow({where: {round_id: roundId}});
  return (m.ends_at!.getTime() - Date.now()) / 60_000;
}

const near = (left: number, minutes: number) => left > minutes - 1 && left <= minutes;

// a hand of the game (11 points between the teams) that leaves nobody level
const PLAIN_HAND = {custom: false, points1: 6, points2: HAND_POINTS - 6};

test("a match level at 41 is unlocked with the tournament's minutes, its next hand keeps them, and a raise after the unlock adds five", async () => {
  // level at 41, nobody calling: the target went up to 51 and the match was left without a winner
  const below = MATCH_THRESHOLD - HAND_POINTS;
  const roundId = await lockedMatch(teams[1], teams[3], [[below, below], [HAND_POINTS, HAND_POINTS]]);

  const out = await unlockTable(roundId, adminId);
  assert.deepEqual([out.kind, out.resumed, out.minutes], ["done", true, MINUTES]);
  const unlocked = await minutesLeft(roundId);
  assert.ok(near(unlocked, MINUTES), `${MINUTES} minutes from the unlock, not ${MINUTES + TARGET_RAISE_MINUTES}: ${unlocked}`);
  assert.ok(Math.abs(new Date(out.ends_at).getTime() - (Date.now() + unlocked * 60_000)) < 1000);

  // the next hand raises nothing, and the deadline stays where the unlock put it
  await addHand(roundId, {kind: "ongoing"}, PLAIN_HAND);
  const next = await minutesLeft(roundId);
  assert.ok(near(next, MINUTES), `the next hand keeps ${MINUTES} minutes, it doesn't jump by ${TARGET_RAISE_MINUTES}: ${next}`);
  // level at the raised target (51): it goes up again, and that raise is five more minutes
  const raised = MATCH_THRESHOLD + TARGET_RAISE;
  await addHand(roundId, {kind: "ongoing"}, {custom: true, points1: raised - (MATCH_THRESHOLD + PLAIN_HAND.points1), points2: raised - (MATCH_THRESHOLD + PLAIN_HAND.points2)});
  const after = await minutesLeft(roundId);
  assert.ok(near(after, MINUTES + TARGET_RAISE_MINUTES), `a raise after the unlock adds ${TARGET_RAISE_MINUTES}: ${after}`);
});

test("\"na prolaz\": a match level at 41 and again at 45 is unlocked with the tournament's minutes, which its next hand keeps", async () => {
  // "na prolaz" every hand that leaves the teams level at or above 41 is five more minutes: two here (41 : 41, then
  // 45 : 45), where "s ovim dosta" would count one (41 goes up to 51, and 45 is below it)
  const below = MATCH_THRESHOLD - HAND_POINTS;
  const roundId = await lockedMatch(teams[4], teams[2], [[below, below], [HAND_POINTS, HAND_POINTS], [4, 4]], "NA_PROLAZ");

  const out = await unlockTable(roundId, adminId);
  assert.deepEqual([out.kind, out.resumed, out.minutes], ["done", true, MINUTES]);
  assert.ok(near(await minutesLeft(roundId), MINUTES));
  // the next hand leaves them apart: no raise, and the deadline stays where the unlock put it
  await addHand(roundId, {kind: "ongoing"}, PLAIN_HAND);
  const next = await minutesLeft(roundId);
  assert.ok(near(next, MINUTES), `the next hand keeps ${MINUTES} minutes: ${next}`);
});
