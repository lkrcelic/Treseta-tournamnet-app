/*
  A lineup row is keyed by round, team and player (it was round and player).

  Before a team's roster changes (a player added, removed or deleted), each finished round it played without a lineup
  gets the team's roster of today saved as its lineup, so the next rating replay gives everyone the same rating
  (src/app/_lib/service/team/freezeLineups.ts). Those rounds were rated with today's rosters, and a player can be on
  both teams' rosters of such a round (one round in the data); with the team in the key they are saved for both, as
  they were rated. A lineup picked on Start Game still has each player on one team only (saveLineup refuses the rest).
*/

-- AlterTable
ALTER TABLE "RoundPlayer" DROP CONSTRAINT "RoundPlayer_pkey",
ADD CONSTRAINT "RoundPlayer_pkey" PRIMARY KEY ("round_id", "team_id", "player_id");
