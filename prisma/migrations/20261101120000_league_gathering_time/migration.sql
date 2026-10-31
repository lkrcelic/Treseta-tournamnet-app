-- Okupljanje in the league (DECISIONS #80): when a night starts gathering, beside its Početak (start_time), as in a
-- tournament. "HH:MM", optional; a night's own wins over the league's.
ALTER TABLE "League" ADD COLUMN "gathering_time" VARCHAR(5);
ALTER TABLE "LeagueNight" ADD COLUMN "gathering_time" VARCHAR(5);
ALTER TABLE "League" ADD CONSTRAINT "League_gathering_time_check" CHECK ("gathering_time" IS NULL OR "gathering_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "LeagueNight" ADD CONSTRAINT "LeagueNight_gathering_time_check" CHECK ("gathering_time" IS NULL OR "gathering_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
