-- Broj kola of a league night: how many rounds this night plays, when it differs from the league's rounds_per_night
-- (null: the league's). When that many rounds are finished, the night is over for Potvrda dolaska (no Odlazimo, no
-- Tu smo · Želimo uskočiti); without it the night ends at 06:00 as before.
ALTER TABLE "LeagueNight" ADD COLUMN "rounds_per_night" INTEGER;
ALTER TABLE "LeagueNight" ADD CONSTRAINT "LeagueNight_rounds_per_night_check" CHECK ("rounds_per_night" IS NULL OR "rounds_per_night" BETWEEN 1 AND 6);
