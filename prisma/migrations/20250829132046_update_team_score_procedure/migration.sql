CREATE PROCEDURE update_team_score(
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
    SELECT SUM(m.team1_score) as team_score,
           SUM(m.team2_score) as opponent_score
    FROM "Round" r
             JOIN "LeagueRound" lr ON r.id = lr.round_id
             JOIN "Match" m ON r.id = m.round_id
    WHERE r.team1_id = p_team_id
      AND lr.league_id = p_league_id
      AND r.open = false

    UNION ALL

    -- Team as team2
    SELECT SUM(m.team2_score) as team_score,
           SUM(m.team1_score) as opponent_score
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
