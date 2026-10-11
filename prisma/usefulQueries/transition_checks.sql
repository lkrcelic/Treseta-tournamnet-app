-- Checks for the switch to the Bela app design (TRANSITION_PLAN.md). Run the "before" queries on the database
-- before the 2026-10-11 migrations, the "after" ones once they ran; the results must match.

------------------------------------------------------------------------------------------------------------------------
-- Before the switch: nothing should be in the middle of being played
------------------------------------------------------------------------------------------------------------------------

-- Active matches. "abandoned" ones (no hands, round closed or none) are deleted by the migration; any other one is
-- being played and moves to OngoingMatch, but better none.
SELECT m.id, m.round_id, m.team1_score, m.team2_score, r.round_date,
       (SELECT count(*) FROM "Result" x WHERE x.match_id = m.id) AS hands,
       NOT EXISTS (SELECT 1 FROM "Result" x WHERE x.match_id = m.id) AND NOT coalesce(r.open, false) AS abandoned
FROM "Match" m LEFT JOIN "Round" r ON r.id = m.round_id
WHERE m.active
ORDER BY m.id;

-- Rounds whose two matches are finished but that are still open (the app finishes a round from the phone after
-- leaving the page, which can fail). Close them with the admin finish before the switch.
SELECT r.id, r.round_date, r.round_number, r.table_number, r.team1_id, r.team2_id, r.team1_wins, r.team2_wins
FROM "Round" r
WHERE r.open
  AND (SELECT count(*) FROM "Match" m WHERE m.round_id = r.id AND NOT m.active) >= 2;

------------------------------------------------------------------------------------------------------------------------
-- Before and after: the same results
------------------------------------------------------------------------------------------------------------------------

SELECT league_id, team_id, rounds_played, wins, draws, losses, point_difference, score
FROM "TeamScore"
ORDER BY league_id, team_id;

-- the standings of every league night. Expected difference: the old function counted abandoned matches in the
-- point difference, so the nights that had one change there (production: 22 Oct, 12 Nov, 26 Nov 2025, 14 Jan 2026).
SELECT d.league_id, d.round_date, s.*
FROM (SELECT DISTINCT lr.league_id, r.round_date::date AS round_date
      FROM "Round" r JOIN "LeagueRound" lr ON lr.round_id = r.id) d,
     LATERAL get_league_standings_by_date(d.league_id, d.round_date) s
ORDER BY d.league_id, d.round_date, s.team_id;

------------------------------------------------------------------------------------------------------------------------
-- Before: totals
------------------------------------------------------------------------------------------------------------------------

-- without the abandoned matches
SELECT count(*) AS matches, sum(team1_score) AS points1, sum(team2_score) AS points2
FROM "Match" m
WHERE NOT (m.active
    AND NOT EXISTS (SELECT 1 FROM "Result" x WHERE x.match_id = m.id)
    AND (m.round_id IS NULL OR NOT (SELECT open FROM "Round" WHERE id = m.round_id)));

SELECT count(*) AS hands,
       count(*) FILTER (WHERE team1_game_points + team2_game_points <> 11) AS custom_hands
FROM "Result";

------------------------------------------------------------------------------------------------------------------------
-- After: the same totals, finished and live matches together
------------------------------------------------------------------------------------------------------------------------

SELECT count(*) AS matches, sum(p1) AS points1, sum(p2) AS points2
FROM (SELECT player_pair1_score p1, player_pair2_score p2 FROM "Match"
      UNION ALL
      SELECT player_pair1_score, player_pair2_score FROM "OngoingMatch") x;

SELECT count(*) AS hands, count(*) FILTER (WHERE custom) AS custom_hands
FROM (SELECT custom FROM "Result" UNION ALL SELECT custom FROM "OngoingResult") x;
