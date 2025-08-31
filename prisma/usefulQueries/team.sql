-- Fetches detailed team data including team name, founders, creator, creation time, and ranked players.
SELECT
    t.team_id,
    t.team_name,
    t.founder_id1,
    f1.username AS founder1_name,
    t.founder_id2,
    f2.username AS founder2_name,
    t.creator_id,
    c.username AS creator_name,
    t.created_at,
    tp.player_id,
    p.username AS player_name,
    RANK() OVER (PARTITION BY t.team_id ORDER BY tp.player_id) AS player_rank
FROM
    "Team" t
        LEFT JOIN
    "TeamPlayer" tp ON t.team_id = tp.team_id
        LEFT JOIN
    "Player" p ON tp.player_id = p.id
        LEFT JOIN
    "Player" f1 ON t.founder_id1 = f1.id
        LEFT JOIN
    "Player" f2 ON t.founder_id2 = f2.id
        LEFT JOIN
    "Player" c ON t.creator_id = c.id
ORDER BY
    t.team_id, player_rank;


-- Retrieves only team names and their ranked players for a simplified view.
SELECT
    t.team_id,
    t.team_name,
    p.username AS player_name,
    RANK() OVER (PARTITION BY t.team_id ORDER BY tp.player_id) AS player_rank
FROM
    "Team" t
        LEFT JOIN
    "TeamPlayer" tp ON t.team_id = tp.team_id
        LEFT JOIN
    "Player" p ON tp.player_id = p.id
ORDER BY
    t.team_name, player_rank;
