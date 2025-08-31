-- Insert all teams that are not in the league to the "league_id"
INSERT INTO "LeagueTeam" (league_id, team_id)
SELECT 1, t.team_id
FROM "Team" t
         LEFT JOIN "LeagueTeam" lt ON lt.team_id = t.team_id AND lt.league_id = 1
WHERE lt.team_id IS NULL;
