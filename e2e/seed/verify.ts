// seed:verify — the rules every Treseta database must keep, checked with the app's own scoring functions
// (game/scoring.ts). On the generated world any broken rule stops the run (exit 1), so no test runs on bad data.
// With --report (a production copy) it prints how many rows break each rule, with a few ids, and exits 0: real data
// has old rows typed in by hand, and the point there is to see them.
// It only reads, so it may point at any copy.
import {BYE_MATCH_POINTS, handError, handZvanja, matchState, MATCH_THRESHOLD, zvanjaError, type MatchEnd} from "@/app/_lib/game/scoring";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {prisma} from "@/app/_lib/prisma";
import {NO_SHOW_SCORE} from "@/app/_lib/tournamentDay";

// bug: a rule the app itself breaks today, with the issue or a one-line note. It is printed with "!" and doesn't stop
// the run, so the world is still usable; drop the bug when the app is fixed.
type Finding = {rule: string; bad: number; examples: (number | string)[]; bug?: string};

const findings: Finding[] = [];
function record(rule: string, bad: (number | string)[], bug?: string) {
  findings.push({rule, bad: bad.length, examples: bad.slice(0, 5), bug});
}

async function hands() {
  const rows = await prisma.result.findMany({include: {match: {select: {round: {select: {declarations: true}}}}}});
  const badPoints: number[] = [];
  const badZvanja: number[] = [];
  const badCall: number[] = [];
  for (const r of rows) {
    if (handError(r.team1_game_points, r.team2_game_points, r.custom)) badPoints.push(r.result_id);
    const [z1, z2] = handZvanja(r);
    if (zvanjaError(z1, z2, {custom: r.custom, declarations: r.match.round?.declarations ?? true})) badZvanja.push(r.result_id);
    if (r.dosta_side != null && (!r.custom || (r.dosta_side !== 1 && r.dosta_side !== 2))) badCall.push(r.result_id);
  }
  record("igra: 11 bodova (Kaput 11 : 0), ili Custom do 99 po ekipi", badPoints);
  record("igra: zvanja koja karte dopuštaju, nijedno na Customu ni za stolom bez zvanja", badZvanja);
  record("igra: „s ovim dosta” samo na Custom igri, za ekipu 1 ili 2", badCall);
}

// with the bye's id, so a bye's score-only match is told from a missing one
type MatchRow = {
  id: number;
  player_pair1_score: number;
  player_pair2_score: number;
  score_threshold: number | null;
  winner_side: number | null;
  time_expired: boolean;
  results: {team1_game_points: number; team2_game_points: number; team1_zvanja3: number; team1_zvanja4: number; team2_zvanja3: number; team2_zvanja4: number; dosta_side: number | null}[];
  round: {team1_id: number; team2_id: number; attendance: string | null; match_end: MatchEnd} | null;
};

async function matches() {
  const rows: MatchRow[] = await prisma.match.findMany({
    select: {
      id: true,
      player_pair1_score: true,
      player_pair2_score: true,
      score_threshold: true,
      winner_side: true,
      time_expired: true,
      results: {
        orderBy: {result_id: "asc"},
        select: {team1_game_points: true, team2_game_points: true, team1_zvanja3: true, team1_zvanja4: true, team2_zvanja3: true, team2_zvanja4: true, dosta_side: true},
      },
      round: {select: {team1_id: true, team2_id: true, attendance: true, match_end: true}},
    },
  });
  const sums: number[] = [];
  const winners: number[] = [];
  const empty: number[] = [];
  const noWinner: number[] = [];
  for (const m of rows) {
    if (m.results.length === 0) {
      const bye = m.round != null && (m.round.team1_id === BYE_TEAM_ID || m.round.team2_id === BYE_TEAM_ID);
      const byeScore = bye && ((m.player_pair1_score === BYE_MATCH_POINTS && m.player_pair2_score === 0) || (m.player_pair1_score === 0 && m.player_pair2_score === BYE_MATCH_POINTS));
      const noShowScore =
        m.round?.attendance === "NO_SHOW" &&
        ((m.player_pair1_score === NO_SHOW_SCORE[0] && m.player_pair2_score === NO_SHOW_SCORE[1]) ||
          (m.player_pair1_score === NO_SHOW_SCORE[1] && m.player_pair2_score === NO_SHOW_SCORE[0]));
      const scoreWinner = m.player_pair1_score > m.player_pair2_score ? 1 : 2;
      if (!byeScore && !noShowScore) empty.push(m.id);
      else if (m.winner_side !== scoreWinner) noWinner.push(m.id);
      continue;
    }
    const state = matchState(m.results, m.score_threshold ?? MATCH_THRESHOLD, m.round?.match_end ?? "S_OVIM_DOSTA");
    if (state.score1 !== m.player_pair1_score || state.score2 !== m.player_pair2_score) sums.push(m.id);
    // Vrijeme partije: the team ahead wins; otherwise the hands decide, "s ovim dosta" and the raised target included
    const expected = m.time_expired ? (state.score1 === state.score2 ? null : state.score1 > state.score2 ? 1 : 2) : state.winner;
    if (expected === null || m.winner_side !== expected) winners.push(m.id);
  }
  record("meč: rezultat = zbroj igara sa zvanjima", sums);
  record("meč: pobjednik (winner_side) je onaj kojeg daju igre (41 i više, „s ovim dosta”, na prolaz) ili isteklo vrijeme", winners);
  record("meč bez igara je samo bye ili nedolazak (5 : 0)", empty);
  record(
    "bye i nedolazak imaju pobjednika (winner_side)",
    noWinner,
    "createByeMatches (round/insertPairRounds.ts) writes a bye without winner_side; the migration of 14.10. filled the old ones",
  );
}

async function tables() {
  const wins = await prisma.$queryRaw<{id: number}[]>`
    SELECT r.id FROM "Round" r LEFT JOIN "Match" m ON m.round_id = r.id
    WHERE r.open = false AND r.status = 'PUBLISHED' AND r.attendance IS DISTINCT FROM 'SKIPPED'
    GROUP BY r.id
    HAVING count(m.id) <> r.matches_per_round
        OR r.team1_wins <> count(m.id) FILTER (WHERE coalesce(m.winner_side, CASE WHEN m.player_pair1_score > m.player_pair2_score THEN 1 ELSE 2 END) = 1)
        OR r.team2_wins <> count(m.id) FILTER (WHERE coalesce(m.winner_side, CASE WHEN m.player_pair1_score > m.player_pair2_score THEN 1 ELSE 2 END) = 2)`;
  // (a bye without winner_side counts by its points: that bug has its own rule above)
  record("zatvoren stol: broj mečeva = partija po kolu, pobjede = mečevi koje je dobio (winner_side)", wins.map((r) => r.id));

  const twice = await prisma.$queryRaw<{team: number; round_date: Date; round_number: number}[]>`
    WITH seats AS (
      SELECT r.id, r.round_date, r.round_number, coalesce(lr.league_id, -tr.tournament_id) comp, t.team
      FROM "Round" r
      LEFT JOIN "LeagueRound" lr ON lr.round_id = r.id
      LEFT JOIN "TournamentRound" tr ON tr.round_id = r.id
      CROSS JOIN LATERAL (VALUES (r.team1_id), (r.team2_id)) t(team)
      WHERE t.team <> ${BYE_TEAM_ID})
    SELECT team, round_date, round_number FROM seats GROUP BY comp, team, round_date, round_number HAVING count(*) > 1`;
  record("ekipa sjedi za najviše jednim stolom u kolu", twice.map((t) => `${t.team}@${t.round_number}`));

  const both = await prisma.$queryRaw<{round_id: number}[]>`
    SELECT round_id FROM "RoundPlayer" GROUP BY round_id, player_id HAVING count(DISTINCT team_id) > 1`;
  record("nitko ne igra za obje ekipe istog stola", both.map((r) => r.round_id));

  const nights = await prisma.$queryRaw<{id: number}[]>`
    SELECT r.id FROM "Round" r JOIN "LeagueRound" lr ON lr.round_id = r.id
    WHERE NOT EXISTS (SELECT 1 FROM "LeagueNight" n WHERE n.league_id = lr.league_id AND n.night = r.round_date)`;
  record("stol lige je na večeri lige (LeagueNight)", nights.map((r) => r.id));
}

async function standings() {
  // what update_team_score would write, from the published closed tables
  const rows = await prisma.$queryRaw<{team_id: number; league_id: number}[]>`
    WITH t AS (
      SELECT lr.league_id, x.team, x.mine, x.theirs, x.diff
      FROM "Round" r JOIN "LeagueRound" lr ON lr.round_id = r.id
      CROSS JOIN LATERAL (VALUES
        (r.team1_id, r.team1_wins, r.team2_wins, (SELECT coalesce(sum(m.player_pair1_score - m.player_pair2_score), 0) FROM "Match" m WHERE m.round_id = r.id)),
        (r.team2_id, r.team2_wins, r.team1_wins, (SELECT coalesce(sum(m.player_pair2_score - m.player_pair1_score), 0) FROM "Match" m WHERE m.round_id = r.id))
      ) x(team, mine, theirs, diff)
      WHERE r.open = false AND r.status = 'PUBLISHED' AND x.team <> ${BYE_TEAM_ID}),
    agg AS (
      SELECT league_id, team, count(*) played, count(*) FILTER (WHERE mine > theirs) wins,
             count(*) FILTER (WHERE mine = theirs) draws, sum(diff) diff
      FROM t GROUP BY league_id, team)
    SELECT s.team_id, s.league_id FROM "TeamScore" s
    LEFT JOIN agg a ON a.league_id = s.league_id AND a.team = s.team_id
    WHERE s.league_id IS NOT NULL AND s.team_id <> ${BYE_TEAM_ID}
      AND (s.rounds_played <> coalesce(a.played, 0) OR s.wins <> coalesce(a.wins, 0) OR s.draws <> coalesce(a.draws, 0)
           OR s.point_difference <> coalesce(a.diff, 0) OR s.score <> 2 * coalesce(a.wins, 0) + coalesce(a.draws, 0))`;
  record("poredak lige (TeamScore) = zbroj zatvorenih objavljenih stolova", rows.map((r) => `${r.team_id}@${r.league_id}`));

  const ratings = await prisma.$queryRaw<{player_id: number}[]>`
    SELECT h.player_id FROM "PlayerRatingHistory" h JOIN "Player" p ON p.id = h.player_id
    WHERE h.night = (SELECT max(night) FROM "PlayerRatingHistory" x WHERE x.player_id = h.player_id) AND h.rating <> p.rating`;
  record("rejting: zadnji zapis povijesti = trenutni rejting igrača", ratings.map((r) => r.player_id));

  const range = await prisma.player.findMany({where: {OR: [{rating: {lt: 500}}, {rating: {gt: 2500}}]}, select: {id: true}});
  record("rejting je između 500 i 2500", range.map((p) => p.id));
}

async function tournaments() {
  const over = await prisma.$queryRaw<{tournament_id: number}[]>`
    SELECT t.tournament_id FROM "Tournament" t JOIN "TournamentTeam" e ON e.tournament_id = t.tournament_id
    WHERE t.max_teams IS NOT NULL AND e.status = 'REGISTERED' AND t.started_at IS NULL
    GROUP BY t.tournament_id, t.max_teams HAVING count(*) > t.max_teams`;
  record("turnir prije početka nema više prijavljenih od limita", over.map((t) => t.tournament_id));

  const waitingWithRoom = await prisma.$queryRaw<{tournament_id: number}[]>`
    SELECT t.tournament_id FROM "Tournament" t
    WHERE t.started_at IS NULL AND t.cancelled_at IS NULL AND t.max_teams IS NOT NULL
      AND EXISTS (SELECT 1 FROM "TournamentTeam" w WHERE w.tournament_id = t.tournament_id AND w.status = 'WAITING')
      AND (SELECT count(*) FROM "TournamentTeam" r WHERE r.tournament_id = t.tournament_id AND r.status = 'REGISTERED') < t.max_teams`;
  record("nitko ne čeka na listi dok ima mjesta", waitingWithRoom.map((t) => t.tournament_id));

  const playerTwice = await prisma.$queryRaw<{tournament_id: number}[]>`
    SELECT e.tournament_id FROM "TournamentTeam" e JOIN "TeamPlayer" tp ON tp.team_id = e.team_id
    GROUP BY e.tournament_id, tp.player_id HAVING count(*) > 1`;
  record("igrač je u najviše jednoj ekipi istog turnira", playerTwice.map((t) => t.tournament_id));
}

async function main() {
  const report = process.argv.includes("--report");
  const started = Date.now();
  await hands();
  await matches();
  await tables();
  await standings();
  await tournaments();
  await prisma.$disconnect();

  const broken = findings.filter((f) => f.bad > 0 && !f.bug);
  for (const f of findings) {
    const mark = f.bad === 0 ? "✓" : report || f.bug ? "!" : "✗";
    console.log(`${mark} ${f.rule}${f.bad ? ` — ${f.bad} (npr. ${f.examples.join(", ")})` : ""}${f.bad && f.bug ? ` · BUG: ${f.bug}` : ""}`);
  }
  const bugs = findings.filter((f) => f.bad > 0 && f.bug).length;
  console.log(
    `${findings.length - broken.length - bugs}/${findings.length} pravila drže${bugs ? ` · ${bugs} poznat bug aplikacije (!)` : ""} · ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  if (broken.length > 0 && !report) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
