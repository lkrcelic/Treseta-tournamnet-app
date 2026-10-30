-- Potvrda dolaska in the league (Tu smo, DECISIONS #73): one row per team and league night it came to. Only adds a
-- table.
-- CreateTable
CREATE TABLE "LeagueArrival" (
    "league_id" INTEGER NOT NULL,
    "night" DATE NOT NULL,
    "team_id" INTEGER NOT NULL,
    "arrived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrived_by" INTEGER,
    "by_admin" BOOLEAN NOT NULL DEFAULT false,
    "left_at" TIMESTAMP(3),
    "left_by_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LeagueArrival_pkey" PRIMARY KEY ("league_id","night","team_id")
);

-- CreateIndex
CREATE INDEX "LeagueArrival_team_id_idx" ON "LeagueArrival"("team_id");

-- AddForeignKey
ALTER TABLE "LeagueArrival" ADD CONSTRAINT "LeagueArrival_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueArrival" ADD CONSTRAINT "LeagueArrival_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueArrival" ADD CONSTRAINT "LeagueArrival_arrived_by_fkey" FOREIGN KEY ("arrived_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

