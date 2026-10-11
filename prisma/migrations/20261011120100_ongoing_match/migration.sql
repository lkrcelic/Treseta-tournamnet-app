/*
  The match being played moves to its own tables again, as in the Bela app: OngoingMatch with its hands in
  OngoingResult. Finishing a match copies it to Match / Result (the app does that in one locked transaction).

  - Result gets `custom`: the hand's points were typed freely instead of splitting 11. A hand saved before this
    migration is marked custom when its points don't add up to 11 (the app only allowed that in custom mode).
  - Abandoned matches are deleted: still active, without a single hand, and in a closed round or in none. Production
    has 9 (Oct 2025 - Jan 2026), next to the two finished matches of their rounds. The old night standings counted
    their points in the point difference; the season standings (TeamScore) never did.
  - Matches being played (Match.active) move to OngoingMatch with their hands, keeping their ids. Normally there are
    none: the switch happens between league nights.
  - Match.active is dropped.
*/

-- A hand entered with the "Custom" key
ALTER TABLE "Result" ADD COLUMN "custom" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Result"
SET "custom" = true
WHERE "team1_game_points" + "team2_game_points" <> 11;

-- CreateTable
CREATE TABLE "OngoingMatch" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER,
    "player_pair1_score" INTEGER NOT NULL DEFAULT 0,
    "player_pair2_score" INTEGER NOT NULL DEFAULT 0,
    "score_threshold" INTEGER,
    "start_time" TIME DEFAULT CURRENT_TIME,
    "end_time" TIME,
    "match_date" DATE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OngoingMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OngoingResult" (
    "result_id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "team1_game_points" INTEGER NOT NULL DEFAULT 0,
    "team2_game_points" INTEGER NOT NULL DEFAULT 0,
    "custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OngoingResult_pkey" PRIMARY KEY ("result_id")
);

-- AddForeignKey
ALTER TABLE "OngoingMatch" ADD CONSTRAINT "OngoingMatch_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OngoingResult" ADD CONSTRAINT "OngoingResult_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "OngoingMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Abandoned matches
DELETE FROM "Match" m
WHERE m."active"
  AND NOT EXISTS (SELECT 1 FROM "Result" r WHERE r."match_id" = m."id")
  AND (m."round_id" IS NULL OR NOT (SELECT "open" FROM "Round" WHERE "id" = m."round_id"));

-- Matches being played, with their hands
INSERT INTO "OngoingMatch" ("id", "round_id", "player_pair1_score", "player_pair2_score", "score_threshold", "start_time", "match_date")
SELECT "id", "round_id", "player_pair1_score", "player_pair2_score", "score_threshold", "start_time"::time, "match_date"
FROM "Match"
WHERE "active";

INSERT INTO "OngoingResult" ("result_id", "match_id", "team1_game_points", "team2_game_points", "custom")
SELECT r."result_id", r."match_id", r."team1_game_points", r."team2_game_points", r."custom"
FROM "Result" r
         JOIN "Match" m ON m."id" = r."match_id"
WHERE m."active";

-- their hands go with them (ON DELETE CASCADE)
DELETE FROM "Match" WHERE "active";

-- the moved rows kept their ids; new ones continue after them
SELECT setval(pg_get_serial_sequence('"OngoingMatch"', 'id'), COALESCE(MAX("id"), 0) + 1, false) FROM "OngoingMatch";
SELECT setval(pg_get_serial_sequence('"OngoingResult"', 'result_id'), COALESCE(MAX("result_id"), 0) + 1, false) FROM "OngoingResult";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "active";
