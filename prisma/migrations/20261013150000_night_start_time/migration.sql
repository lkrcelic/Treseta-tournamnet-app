/*
  The time a league night starts (Raspored, Početna · Sljedeća večer): optional, like the play day. The league has a
  default time, and a single night can have its own; a night without either shows only its date. Stored as "HH:MM"
  text, checked here.
*/

-- AlterTable
ALTER TABLE "League" ADD COLUMN "start_time" VARCHAR(5);

-- AlterTable
ALTER TABLE "LeagueNight" ADD COLUMN "start_time" VARCHAR(5);

-- 00:00 ... 23:59
ALTER TABLE "League" ADD CONSTRAINT "League_start_time_check" CHECK ("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "LeagueNight" ADD CONSTRAINT "LeagueNight_start_time_check" CHECK ("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
