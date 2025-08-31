SELECT s.id                                   AS session_id,
       s."expiresAt"                          AS expires_at,
       p.id                                   AS player_id,
       p.username                             AS username,
       CONCAT(p.first_name, ' ', p.last_name) AS player_name
FROM "Session" s
         INNER JOIN "Player" p
                    ON s."userId" = p.id;
