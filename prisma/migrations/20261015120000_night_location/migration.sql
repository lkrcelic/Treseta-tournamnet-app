/*
  Where a league's nights are played (Raspored, Početna · Sljedeća večer): optional, like the start time. The league
  has a default place (name, address, Google Maps link), and a single night can have its own; a night has its own place
  when its location_name is set.
*/

-- AlterTable
ALTER TABLE "League" ADD COLUMN "location_name" VARCHAR(100),
ADD COLUMN "location_address" VARCHAR(200),
ADD COLUMN "location_url" VARCHAR(500);

-- AlterTable
ALTER TABLE "LeagueNight" ADD COLUMN "location_name" VARCHAR(100),
ADD COLUMN "location_address" VARCHAR(200),
ADD COLUMN "location_url" VARCHAR(500);
