-- The Bela app's migrations 20251007175452_add_player_ratings and 20261005150000_rating_history, word for word.

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "rating_deviation" DOUBLE PRECISION NOT NULL DEFAULT 350.0,
ADD COLUMN     "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06;

-- A player's rating after each league night they played. Filled by the rating replay (npm run ratings:replay, or
-- the next round that closes). Additive.
CREATE TABLE "PlayerRatingHistory" (
    "player_id" INTEGER NOT NULL,
    "night" DATE NOT NULL,
    "rating" INTEGER NOT NULL,
    "rating_deviation" DOUBLE PRECISION NOT NULL,
    "change" INTEGER NOT NULL,
    "rounds" INTEGER NOT NULL,

    CONSTRAINT "PlayerRatingHistory_pkey" PRIMARY KEY ("player_id","night")
);

ALTER TABLE "PlayerRatingHistory" ADD CONSTRAINT "PlayerRatingHistory_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
