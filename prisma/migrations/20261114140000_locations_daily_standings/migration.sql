/*
  Liga na dvije lokacije (LOCATIONS_PLAN.md, decision 17): Dnevni poredak of a two-place night can show one place, with
  its teams ranked from 1. get_league_standings_by_date gets a third parameter, the place (Round.location_slot, 1 or
  2); left out or NULL it counts every table of the night, as before, so every call with two arguments is unchanged.
  The function is dropped and made again because CREATE OR REPLACE can't add a parameter (a second function next to
  the old one would make a call with two arguments ambiguous).
*/

DROP FUNCTION IF EXISTS get_league_standings_by_date(BIGINT, DATE);

CREATE FUNCTION get_league_standings_by_date(
    p_league_id BIGINT,
    p_round_date DATE,
    p_slot SMALLINT DEFAULT NULL
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
              AND r.status = 'PUBLISHED'
              AND (p_slot IS NULL OR r.location_slot = p_slot)
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
              AND r.status = 'PUBLISHED'
              AND (p_slot IS NULL OR r.location_slot = p_slot)
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
              AND r.status = 'PUBLISHED'
              AND (p_slot IS NULL OR r.location_slot = p_slot)
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
              AND r.status = 'PUBLISHED'
              AND (p_slot IS NULL OR r.location_slot = p_slot)
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
