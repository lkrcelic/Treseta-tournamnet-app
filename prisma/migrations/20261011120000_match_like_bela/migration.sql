/*
  Match takes the Bela app's column names, so the code shared with the Bela app reads it unchanged.

  - team1_score / team2_score are renamed to player_pair1_score / player_pair2_score; the scores stay.
  - start_time and match_date become optional, as in the Bela app (the app sets both when a match is finished).

  update_team_score and get_league_standings_by_date read the renamed columns, so both are recreated below with
  the Bela app's current SQL (migration 20251029110018_bye_team_only_0 there). Apart from the column names it is the
  same SQL as this app's: same rounds counted, 2 points a win, 1 a draw, the bye team (0) left out.
*/

ALTER TABLE "Match" RENAME COLUMN "team1_score" TO "player_pair1_score";
ALTER TABLE "Match" RENAME COLUMN "team2_score" TO "player_pair2_score";

ALTER TABLE "Match" ALTER COLUMN "start_time" DROP NOT NULL,
ALTER COLUMN "start_time" DROP DEFAULT,
ALTER COLUMN "match_date" DROP NOT NULL;

CREATE
OR REPLACE PROCEDURE update_team_score(
    p_team_id BIGINT,
    p_league_id BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
v_rounds_played INT;
    v_wins
INT;
    v_draws
INT;
    v_losses
INT;
    v_point_difference
INT;
    v_score
INT;
BEGIN
    -- Calculate rounds, wins, draws, losses from both team perspectives
WITH round_results AS (
    -- Team as team1
    SELECT COUNT(*)                                            as rounds_played,
           COUNT(CASE WHEN team1_wins > team2_wins THEN 1 END) as wins,
           COUNT(CASE WHEN team1_wins = team2_wins THEN 1 END) as draws,
           COUNT(CASE WHEN team1_wins < team2_wins THEN 1 END) as losses
    FROM "Round" r
             JOIN "LeagueRound" lr ON r.id = lr.round_id
    WHERE r.team1_id = p_team_id
      AND lr.league_id = p_league_id
      AND r.open = false

    UNION ALL

    -- Team as team2
    SELECT COUNT(*)                                            as rounds_played,
           COUNT(CASE WHEN team2_wins > team1_wins THEN 1 END) as wins,
           COUNT(CASE WHEN team2_wins = team1_wins THEN 1 END) as draws,
           COUNT(CASE WHEN team2_wins < team1_wins THEN 1 END) as losses
    FROM "Round" r
             JOIN "LeagueRound" lr ON r.id = lr.round_id
    WHERE r.team2_id = p_team_id
      AND lr.league_id = p_league_id
      AND r.open = false)
SELECT SUM(rounds_played),
       SUM(wins),
       SUM(draws),
       SUM(losses)
INTO
    v_rounds_played,
    v_wins,
    v_draws,
    v_losses
FROM round_results;

-- Calculate point difference from matches
WITH match_points AS (
    -- Team as team1
    SELECT SUM(m.player_pair1_score) as team_score,
           SUM(m.player_pair2_score) as opponent_score
    FROM "Round" r
             JOIN "LeagueRound" lr ON r.id = lr.round_id
             JOIN "Match" m ON r.id = m.round_id
    WHERE r.team1_id = p_team_id
      AND lr.league_id = p_league_id
      AND r.open = false

    UNION ALL

    -- Team as team2
    SELECT SUM(m.player_pair2_score) as team_score,
           SUM(m.player_pair1_score) as opponent_score
    FROM "Round" r
             JOIN "LeagueRound" lr ON r.id = lr.round_id
             JOIN "Match" m ON r.id = m.round_id
    WHERE r.team2_id = p_team_id
      AND lr.league_id = p_league_id
      AND r.open = false)
SELECT COALESCE(SUM(team_score - opponent_score), 0)
INTO v_point_difference
FROM match_points;

-- Calculate total score (wins * 2 + draws * 1)
v_score
:= (COALESCE(v_wins, 0) * 2) + COALESCE(v_draws, 0);

    -- Update or insert TeamScore record
INSERT INTO "TeamScore" (team_id,
                         league_id,
                         rounds_played,
                         wins,
                         draws,
                         losses,
                         point_difference,
                         score)
VALUES (p_team_id,
        p_league_id,
        COALESCE(v_rounds_played, 0),
        COALESCE(v_wins, 0),
        COALESCE(v_draws, 0),
        COALESCE(v_losses, 0),
        v_point_difference,
        v_score) ON CONFLICT (team_id, league_id)
    DO
UPDATE SET
    rounds_played = EXCLUDED.rounds_played,
    wins = EXCLUDED.wins,
    draws = EXCLUDED.draws,
    losses = EXCLUDED.losses,
    point_difference = EXCLUDED.point_difference,
    score = EXCLUDED.score;
END;
$$;


CREATE
OR REPLACE FUNCTION get_league_standings_by_date(
    p_league_id BIGINT,
    p_round_date DATE
)
RETURNS TABLE (
    team_id INT,
    rounds_played NUMERIC,
    wins NUMERIC,
    draws NUMERIC,
    losses NUMERIC,
    active_round_count NUMERIC,
    point_difference NUMERIC,
    score NUMERIC
)
LANGUAGE plpgsql AS $$
BEGIN
RETURN QUERY WITH round_results AS (
        SELECT
            sub.team_id,
            SUM(sub.rounds_played) AS rounds_played,
            SUM(sub.wins) AS wins,
            SUM(sub.draws) AS draws,
            SUM(sub.losses) AS losses,
            SUM(sub.active_round_count) AS active_round_count
        FROM (
            SELECT r.team1_id AS team_id,
                   COUNT(CASE WHEN r.open = false THEN 1 END) AS rounds_played,
                   COUNT(CASE WHEN r.team1_wins > r.team2_wins AND r.open = false THEN 1 END) AS wins,
                   COUNT(CASE WHEN r.team1_wins = r.team2_wins AND r.open = false THEN 1 END) AS draws,
                   COUNT(CASE WHEN r.team1_wins < r.team2_wins AND r.open = false THEN 1 END) AS losses,
                   COUNT(CASE WHEN r.active THEN 1 END) AS active_round_count
            FROM "Round" r
            JOIN "LeagueRound" lr ON r.id = lr.round_id
            WHERE lr.league_id = p_league_id
              AND r.round_date::DATE = p_round_date
              AND r.team1_id != 0
            GROUP BY r.team1_id

            UNION ALL

            SELECT r.team2_id AS team_id,
                   COUNT(CASE WHEN r.open = false THEN 1 END) AS rounds_played,
                   COUNT(CASE WHEN r.team2_wins > r.team1_wins AND r.open = false THEN 1 END) AS wins,
                   COUNT(CASE WHEN r.team2_wins = r.team1_wins AND r.open = false THEN 1 END) AS draws,
                   COUNT(CASE WHEN r.team2_wins < r.team1_wins AND r.open = false THEN 1 END) AS losses,
                   COUNT(CASE WHEN r.active THEN 1 END) AS active_round_count
            FROM "Round" r
            JOIN "LeagueRound" lr ON r.id = lr.round_id
            WHERE lr.league_id = p_league_id
              AND r.round_date::DATE = p_round_date
              AND r.team2_id != 0
            GROUP BY r.team2_id
        ) AS sub
        GROUP BY sub.team_id
    ),
    match_points AS (
        SELECT
            mp.team_id,
            COALESCE(SUM(mp.team_score - mp.opponent_score), 0) AS point_difference
        FROM (
            SELECT r.team1_id AS team_id,
                   SUM(m.player_pair1_score) AS team_score,
                   SUM(m.player_pair2_score) AS opponent_score
            FROM "Round" r
            JOIN "LeagueRound" lr ON r.id = lr.round_id
            JOIN "Match" m ON r.id = m.round_id
            WHERE lr.league_id = p_league_id
              AND r.round_date::DATE = p_round_date
              AND r.team1_id != 0
              AND r.open = false
            GROUP BY r.team1_id

            UNION ALL

            SELECT r.team2_id AS team_id,
                   SUM(m.player_pair2_score) AS team_score,
                   SUM(m.player_pair1_score) AS opponent_score
            FROM "Round" r
            JOIN "LeagueRound" lr ON r.id = lr.round_id
            JOIN "Match" m ON r.id = m.round_id
            WHERE lr.league_id = p_league_id
              AND r.round_date::DATE = p_round_date
              AND r.team2_id != 0
              AND r.open = false
            GROUP BY r.team2_id
        ) AS mp
        GROUP BY mp.team_id
    )

SELECT rr.team_id,
       rr.rounds_played,
       rr.wins,
       rr.draws,
       rr.losses,
       rr.active_round_count,
       COALESCE(mp.point_difference, 0) AS point_difference,
       (rr.wins * 2 + rr.draws) AS score
FROM round_results rr
         LEFT JOIN match_points mp ON rr.team_id = mp.team_id
ORDER BY score DESC, mp.point_difference DESC;
END;
$$;
