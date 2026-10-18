-- Profile photos of players and teams (Claude Design "Profilna slika igrača i ekipe"): who may see them, the admin's
-- block on a new one, and the photos themselves in tables of their own, so the many queries that read whole Player
-- and Team rows never load the bytes.
CREATE TYPE "PhotoVisibility" AS ENUM ('ALL', 'TEAMMATES', 'ME');

ALTER TABLE "Player" ADD COLUMN     "photo_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photo_updated_at" TIMESTAMP(3),
ADD COLUMN     "photo_visibility" "PhotoVisibility" NOT NULL DEFAULT 'ALL';

ALTER TABLE "Team" ADD COLUMN     "photo_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photo_updated_at" TIMESTAMP(3),
ADD COLUMN     "photo_updated_by" INTEGER,
ADD COLUMN     "photo_visibility" "PhotoVisibility" NOT NULL DEFAULT 'ALL',
-- "Samo ja" is a player's choice; a team is seen by all or by its own players
ADD CONSTRAINT "Team_photo_visibility_check" CHECK ("photo_visibility" <> 'ME');

-- 512×512 WebP (or PNG where the browser can't make WebP), up to 512 KB
CREATE TABLE "PlayerPhoto" (
    "player_id" INTEGER NOT NULL,
    "photo" BYTEA NOT NULL,
    "type" VARCHAR(20) NOT NULL,

    CONSTRAINT "PlayerPhoto_pkey" PRIMARY KEY ("player_id"),
    CONSTRAINT "PlayerPhoto_type_check" CHECK ("type" IN ('image/png', 'image/jpeg', 'image/webp')),
    CONSTRAINT "PlayerPhoto_size_check" CHECK (octet_length("photo") BETWEEN 1 AND 524288)
);

CREATE TABLE "TeamPhoto" (
    "team_id" INTEGER NOT NULL,
    "photo" BYTEA NOT NULL,
    "type" VARCHAR(20) NOT NULL,

    CONSTRAINT "TeamPhoto_pkey" PRIMARY KEY ("team_id"),
    CONSTRAINT "TeamPhoto_type_check" CHECK ("type" IN ('image/png', 'image/jpeg', 'image/webp')),
    CONSTRAINT "TeamPhoto_size_check" CHECK (octet_length("photo") BETWEEN 1 AND 524288)
);

ALTER TABLE "PlayerPhoto" ADD CONSTRAINT "PlayerPhoto_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_photo_updated_by_fkey" FOREIGN KEY ("photo_updated_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamPhoto" ADD CONSTRAINT "TeamPhoto_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;
