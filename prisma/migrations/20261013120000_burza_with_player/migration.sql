/*
  Trebam zamjenu names the player the substitute plays with (who asks for the substitute), no longer who can't play:
  a team has up to six players, so "who can't come" told the substitute nothing. MarketPost.out_player_id becomes
  with_player_id; the ads already up keep their player, now read as "igra s".
*/

-- AlterTable
ALTER TABLE "MarketPost" RENAME COLUMN "out_player_id" TO "with_player_id";

-- RenameForeignKey
ALTER TABLE "MarketPost" RENAME CONSTRAINT "MarketPost_out_player_id_fkey" TO "MarketPost_with_player_id_fkey";
