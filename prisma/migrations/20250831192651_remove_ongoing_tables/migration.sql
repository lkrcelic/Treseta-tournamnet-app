/*
  Warnings:

  - You are about to drop the `OngoingMatch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OngoingResult` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OngoingMatch" DROP CONSTRAINT "OngoingMatch_round_id_fkey";

-- DropForeignKey
ALTER TABLE "OngoingResult" DROP CONSTRAINT "OngoingResult_match_id_fkey";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "OngoingMatch";

-- DropTable
DROP TABLE "OngoingResult";
