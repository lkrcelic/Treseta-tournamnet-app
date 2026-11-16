/*
  A bye's matches get their winner. createByeMatches wrote a Slobodna runda's matches (5 : 0, the real team's) without
  Match.winner_side, and 20261014120000_s_ovim_dosta filled winner_side only for a winner with at least the threshold
  (41), so no bye ever had one; the app reads a null winner_side as a match nobody won. Each such match goes to the
  real team: side 2 when the bye (team 0) is team 1, else 1. Only matches at a bye table, without hands, with the real
  team ahead and no winner yet are touched; running it again changes nothing.
*/

UPDATE "Match" AS m
SET "winner_side" = CASE WHEN r."team1_id" = 0 THEN 2 ELSE 1 END
FROM "Round" AS r
WHERE m."round_id" = r."id"
  AND m."winner_side" IS NULL
  AND ((r."team1_id" = 0 AND m."player_pair2_score" > m."player_pair1_score")
    OR (r."team2_id" = 0 AND m."player_pair1_score" > m."player_pair2_score"))
  AND NOT EXISTS (SELECT 1 FROM "Result" AS x WHERE x."match_id" = m."id");
