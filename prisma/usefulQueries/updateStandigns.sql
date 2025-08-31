-- update league standings for "league_id"
DO $$
DECLARE
rec RECORD;
BEGIN
FOR rec IN
SELECT team_id
FROM "LeagueTeam"
WHERE league_id = 1
    LOOP
        EXECUTE format('CALL update_team_score(%s, 1)', rec.team_id);
END LOOP;
END $$;
