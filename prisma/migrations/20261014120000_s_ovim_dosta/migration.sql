/*
  The end of a match as the rules have it (section 10): "s ovim dosta" and the target going up on a tie.

  - OngoingResult and Result get `dosta_side`: the team (1 or 2) that called "s ovim dosta" on that hand. That team
    wins once it has reached the target with the hand, even with fewer points.
  - Match gets `winner_side`: the team that won, since a "s ovim dosta" win can't be read from the points. Null when
    an admin's edit left the match without a winner. Existing matches get it from their points, as the app decided
    until now: more points and at least the threshold (41).
  - A tie at or above the target raises it by 10 (41 → 51 → 61); the app works that out from the hands, so nothing
    is stored for it.
*/

ALTER TABLE "OngoingResult" ADD COLUMN "dosta_side" INTEGER;
ALTER TABLE "OngoingResult" ADD CONSTRAINT "OngoingResult_dosta_side_check" CHECK ("dosta_side" IN (1, 2));

ALTER TABLE "Result" ADD COLUMN "dosta_side" INTEGER;
ALTER TABLE "Result" ADD CONSTRAINT "Result_dosta_side_check" CHECK ("dosta_side" IN (1, 2));

ALTER TABLE "Match" ADD COLUMN "winner_side" INTEGER;
ALTER TABLE "Match" ADD CONSTRAINT "Match_winner_side_check" CHECK ("winner_side" IN (1, 2));

UPDATE "Match"
SET "winner_side" = CASE WHEN "player_pair1_score" > "player_pair2_score" THEN 1 ELSE 2 END
WHERE "player_pair1_score" <> "player_pair2_score"
  AND GREATEST("player_pair1_score", "player_pair2_score") >= COALESCE("score_threshold", 41);
