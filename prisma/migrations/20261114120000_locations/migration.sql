/*
  Liga na dvije lokacije (LOCATIONS_PLAN.md): places become one shared list, and a league night can be played at two
  places at once. Additive: the text columns location_name/address/url stay on League, LeagueNight and Tournament
  until nothing reads them (a later migration drops them), and every query that ignores the new columns works as
  before.

  - Location: a place (name, address, Google Maps link) shared by leagues, nights and tournaments. A place in use
    can't be deleted.
  - League.location_id: the first place of a night that has none of its own ("Zadano lige").
  - LeagueNight.location_id: the night's own first place (null: the league's); second_location_id: a second place
    played at the same time (null: a one-place night).
  - Tournament.location_id: where the tournament is played.
  - LeagueNightTeam: Podjela, the place (slot 1 or 2) a team plays at on a two-place night; no row = not assigned.
  - Round.location_slot: the place of the night a table is at (1 or 2); null on a one-place night and on every old
    table.
  - CreateRoundDraft gets a slot in its key, so an admin keeps a Novo kolo setup per place (0: a one-place night).

  Data: every place written today becomes a Location. The same name (trimmed, inner spaces collapsed, any case) is
  one place. Its name is the spelling used most often (the newest of equals); its address and link come from the
  newest row that has them (a night or a tournament by its date, a league by when it was made). An admin can fix a
  name in Lokacije afterwards. Leagues, nights and tournaments then point at their place. A night without its own
  place keeps location_id null, as it keeps location_name null today.
*/

-- CreateTable
CREATE TABLE "Location" (
    "location_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(200),
    "url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("location_id")
);

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "location_id" INTEGER;

-- AlterTable
ALTER TABLE "LeagueNight" ADD COLUMN     "location_id" INTEGER,
ADD COLUMN     "second_location_id" INTEGER;

-- the second place is another place than the first (when the first is the league's, the app checks it)
ALTER TABLE "LeagueNight" ADD CONSTRAINT "LeagueNight_second_location_check"
  CHECK ("second_location_id" IS NULL OR "location_id" IS NULL OR "second_location_id" <> "location_id");

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "location_id" INTEGER;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "location_slot" SMALLINT;

ALTER TABLE "Round" ADD CONSTRAINT "Round_location_slot_check" CHECK ("location_slot" IS NULL OR "location_slot" IN (1, 2));

-- AlterTable
ALTER TABLE "CreateRoundDraft" DROP CONSTRAINT "CreateRoundDraft_pkey",
ADD COLUMN     "slot" SMALLINT NOT NULL DEFAULT 0,
ADD CONSTRAINT "CreateRoundDraft_pkey" PRIMARY KEY ("player_id", "league_id", "slot");

ALTER TABLE "CreateRoundDraft" ADD CONSTRAINT "CreateRoundDraft_slot_check" CHECK ("slot" IN (0, 1, 2));

-- CreateTable
CREATE TABLE "LeagueNightTeam" (
    "league_id" INTEGER NOT NULL,
    "night" DATE NOT NULL,
    "team_id" INTEGER NOT NULL,
    "slot" SMALLINT NOT NULL,
    "moved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueNightTeam_pkey" PRIMARY KEY ("league_id","night","team_id")
);

ALTER TABLE "LeagueNightTeam" ADD CONSTRAINT "LeagueNightTeam_slot_check" CHECK ("slot" IN (1, 2));

-- CreateIndex
CREATE INDEX "LeagueNightTeam_league_id_night_slot_idx" ON "LeagueNightTeam"("league_id", "night", "slot");

-- CreateIndex
CREATE INDEX "LeagueNightTeam_team_id_idx" ON "LeagueNightTeam"("team_id");

-- CreateIndex
CREATE INDEX "League_location_id_idx" ON "League"("location_id");

-- CreateIndex
CREATE INDEX "LeagueNight_location_id_idx" ON "LeagueNight"("location_id");

-- CreateIndex
CREATE INDEX "LeagueNight_second_location_id_idx" ON "LeagueNight"("second_location_id");

-- CreateIndex
CREATE INDEX "Tournament_location_id_idx" ON "Tournament"("location_id");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueNight" ADD CONSTRAINT "LeagueNight_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueNight" ADD CONSTRAINT "LeagueNight_second_location_id_fkey" FOREIGN KEY ("second_location_id") REFERENCES "Location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueNightTeam" ADD CONSTRAINT "LeagueNightTeam_league_id_night_fkey" FOREIGN KEY ("league_id", "night") REFERENCES "LeagueNight"("league_id", "night") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueNightTeam" ADD CONSTRAINT "LeagueNightTeam_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: today's places become Locations ------------------------------------------------------------------------------

-- every written place, with its key (trimmed, inner spaces collapsed, lower case) and how new it is
CREATE TEMP TABLE "_place_rows" AS
  SELECT lower(regexp_replace(btrim("location_name"), '\s+', ' ', 'g')) AS "key",
         regexp_replace(btrim("location_name"), '\s+', ' ', 'g') AS "name",
         NULLIF(btrim("location_address"), '') AS "address",
         NULLIF(btrim("location_url"), '') AS "url",
         "created_at" AS "at"
    FROM "League" WHERE NULLIF(btrim("location_name"), '') IS NOT NULL
  UNION ALL
  SELECT lower(regexp_replace(btrim("location_name"), '\s+', ' ', 'g')),
         regexp_replace(btrim("location_name"), '\s+', ' ', 'g'),
         NULLIF(btrim("location_address"), ''),
         NULLIF(btrim("location_url"), ''),
         "night"::timestamp
    FROM "LeagueNight" WHERE NULLIF(btrim("location_name"), '') IS NOT NULL
  UNION ALL
  SELECT lower(regexp_replace(btrim("location_name"), '\s+', ' ', 'g')),
         regexp_replace(btrim("location_name"), '\s+', ' ', 'g'),
         NULLIF(btrim("location_address"), ''),
         NULLIF(btrim("location_url"), ''),
         "date"::timestamp
    FROM "Tournament" WHERE NULLIF(btrim("location_name"), '') IS NOT NULL;

-- one place per key: the most used spelling (the newest of equals), and the newest address and link filled in
INSERT INTO "Location" ("name", "address", "url")
SELECT n."name", a."address", u."url"
  FROM (SELECT DISTINCT ON ("key") "key", "name"
          FROM (SELECT "key", "name", count(*) AS "uses", max("at") AS "at" FROM "_place_rows" GROUP BY "key", "name") s
         ORDER BY "key", "uses" DESC, "at" DESC) n
  LEFT JOIN (SELECT DISTINCT ON ("key") "key", "address" FROM "_place_rows" WHERE "address" IS NOT NULL ORDER BY "key", "at" DESC) a USING ("key")
  LEFT JOIN (SELECT DISTINCT ON ("key") "key", "url" FROM "_place_rows" WHERE "url" IS NOT NULL ORDER BY "key", "at" DESC) u USING ("key")
 ORDER BY n."name";

UPDATE "League" t SET "location_id" = l."location_id"
  FROM "Location" l
 WHERE NULLIF(btrim(t."location_name"), '') IS NOT NULL
   AND lower(regexp_replace(btrim(t."location_name"), '\s+', ' ', 'g')) = lower(l."name");

UPDATE "LeagueNight" t SET "location_id" = l."location_id"
  FROM "Location" l
 WHERE NULLIF(btrim(t."location_name"), '') IS NOT NULL
   AND lower(regexp_replace(btrim(t."location_name"), '\s+', ' ', 'g')) = lower(l."name");

UPDATE "Tournament" t SET "location_id" = l."location_id"
  FROM "Location" l
 WHERE NULLIF(btrim(t."location_name"), '') IS NOT NULL
   AND lower(regexp_replace(btrim(t."location_name"), '\s+', ' ', 'g')) = lower(l."name");

DROP TABLE "_place_rows";
