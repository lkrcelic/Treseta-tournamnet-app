/*
  League nights and Burza igrača.

  - LeagueNight: the nights a league plays (Manage League · Dates). Existing leagues get theirs from the start date,
    end date and play day, plus every date that already has a round.
  - Player gets an optional phone number; Burza igrača fills it into new ads.
  - MarketPost: an ad in Burza igrača (a team needs a substitute, a player looks for a partner or is available).
*/

-- CreateEnum
CREATE TYPE "MarketPostKind" AS ENUM ('SUBSTITUTE', 'PARTNER', 'AVAILABLE');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "phone" VARCHAR(30);

-- CreateTable
CREATE TABLE "LeagueNight" (
    "league_id" INTEGER NOT NULL,
    "night" DATE NOT NULL,

    CONSTRAINT "LeagueNight_pkey" PRIMARY KEY ("league_id","night")
);

-- CreateTable
CREATE TABLE "MarketPost" (
    "id" SERIAL NOT NULL,
    "kind" "MarketPostKind" NOT NULL,
    "player_id" INTEGER NOT NULL,
    "league_id" INTEGER,
    "team_id" INTEGER,
    "night" DATE,
    "out_player_id" INTEGER,
    "as_substitute" BOOLEAN NOT NULL DEFAULT false,
    "as_partner" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "phone" VARCHAR(30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "MarketPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPost_closed_at_kind_idx" ON "MarketPost"("closed_at", "kind");

-- AddForeignKey
ALTER TABLE "LeagueNight" ADD CONSTRAINT "LeagueNight_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPost" ADD CONSTRAINT "MarketPost_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPost" ADD CONSTRAINT "MarketPost_out_player_id_fkey" FOREIGN KEY ("out_player_id") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPost" ADD CONSTRAINT "MarketPost_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPost" ADD CONSTRAINT "MarketPost_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- What each kind of ad needs: a substitute ad its league, team, night and phone; a partner ad its league and phone;
-- an availability ad at least one of substitute / partner (its phone may be the profile's)
ALTER TABLE "MarketPost" ADD CONSTRAINT "MarketPost_kind_check" CHECK (
    ("kind" <> 'SUBSTITUTE' OR ("league_id" IS NOT NULL AND "team_id" IS NOT NULL AND "night" IS NOT NULL AND "phone" IS NOT NULL))
    AND ("kind" <> 'PARTNER' OR ("league_id" IS NOT NULL AND "phone" IS NOT NULL))
    AND ("kind" <> 'AVAILABLE' OR "as_substitute" OR "as_partner")
);

-- The nights of the existing leagues: every play day from the start date to the end date (play_day 0 = Monday) ...
INSERT INTO "LeagueNight" ("league_id", "night")
SELECT l."league_id", d::date
FROM "League" l
         CROSS JOIN LATERAL generate_series(l."start_date", l."end_date", interval '1 day') AS d
WHERE l."start_date" IS NOT NULL
  AND l."end_date" IS NOT NULL
  AND l."play_day" IS NOT NULL
  AND EXTRACT(ISODOW FROM d)::int - 1 = l."play_day"
ON CONFLICT DO NOTHING;

-- ... and every night that already has a round
INSERT INTO "LeagueNight" ("league_id", "night")
SELECT DISTINCT lr."league_id", r."round_date"
FROM "LeagueRound" lr
         JOIN "Round" r ON r."id" = lr."round_id"
WHERE r."round_date" IS NOT NULL
ON CONFLICT DO NOTHING;
