-- The Bela app's migration 20261005120000_round_lineup, word for word.

-- The two players of each team who play a round, picked on Start Game. Additive: older rounds have no rows and
-- keep rating the whole roster.
CREATE TABLE "RoundPlayer" (
    "round_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,

    CONSTRAINT "RoundPlayer_pkey" PRIMARY KEY ("round_id","player_id")
);

CREATE INDEX "RoundPlayer_team_id_idx" ON "RoundPlayer"("team_id");

ALTER TABLE "RoundPlayer" ADD CONSTRAINT "RoundPlayer_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundPlayer" ADD CONSTRAINT "RoundPlayer_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundPlayer" ADD CONSTRAINT "RoundPlayer_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;
