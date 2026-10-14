-- What an admin has set up on Novo kolo for a league tonight (rounds, window, smoking tables, the teams sitting out),
-- so it survives a reload, a trip to make a new team and another computer. One row per admin and league: the next
-- night overwrites it.
CREATE TABLE "CreateRoundDraft" (
    "player_id"      INTEGER NOT NULL,
    "league_id"      INTEGER NOT NULL,
    "night"          DATE NOT NULL,
    "rounds"         INTEGER NOT NULL,
    "window_size"    INTEGER NOT NULL,
    "smoking_on"     BOOLEAN NOT NULL,
    "smoking_tables" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "sitting_out"    INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreateRoundDraft_pkey" PRIMARY KEY ("player_id", "league_id")
);

ALTER TABLE "CreateRoundDraft" ADD CONSTRAINT "CreateRoundDraft_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreateRoundDraft" ADD CONSTRAINT "CreateRoundDraft_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CreateRoundDraft_league_id_idx" ON "CreateRoundDraft"("league_id");
