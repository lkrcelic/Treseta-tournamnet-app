/*
  Warnings:

  - You are about to drop the column `team1_id` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `team2_id` on the `Match` table. All the data in the column will be lost.
  - Made the column `start_time` on table `Match` required. This step will fail if there are existing NULL values in that column.
  - Made the column `match_date` on table `Match` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Match" DROP COLUMN "team1_id",
DROP COLUMN "team2_id",
ALTER COLUMN "start_time" SET NOT NULL,
ALTER COLUMN "start_time" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "match_date" SET NOT NULL;
