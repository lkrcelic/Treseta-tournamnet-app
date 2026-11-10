-- Vrijeme partije: every match has a time limit, counted from the start of the match (Tko igra · Započni igru for the
-- first, the moment it opens for the second). When the time is up the match ends at once with the score entered then:
-- the team with more points wins it. With the score level one more hand is played; level at or above the target, the
-- target goes up by TARGET_RAISE and the match gets TARGET_RAISE_MINUTES (5) more minutes — Treseta's own rule, which
-- needs no column: the deadline is counted from the hands the match has (_lib/gameTime.ts).
--
-- From Bela's 20261030120000_turniri_v1 (the Vrijeme partije part) and 20261107200000_round_game_minutes. Treseta's
-- default is 45 minutes, Bela's 35.

ALTER TABLE "League" ADD COLUMN "game_minutes" INTEGER NOT NULL DEFAULT 45;
ALTER TABLE "League" ADD CONSTRAINT "League_game_minutes_check" CHECK ("game_minutes" BETWEEN 5 AND 180);

ALTER TABLE "Tournament" ADD COLUMN "game_minutes" INTEGER NOT NULL DEFAULT 45;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_game_minutes_check" CHECK ("game_minutes" BETWEEN 5 AND 180);

-- Otključaj partiju: an admin who unlocks a locked table chooses how long the game may run, and that Vrijeme partije
-- belongs to the table alone. Null on every other table: its tournament's or its league's limit decides.
ALTER TABLE "Round" ADD COLUMN "game_minutes" INTEGER;
ALTER TABLE "Round" ADD CONSTRAINT "Round_game_minutes_check" CHECK ("game_minutes" IS NULL OR ("game_minutes" >= 5 AND "game_minutes" <= 180));

-- a running match: when it started and when its time is up (null: no limit, a match that was already running when
-- this was deployed)
ALTER TABLE "OngoingMatch" ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "ends_at" TIMESTAMP(3);

-- a match closed by its time limit with the score entered then
ALTER TABLE "Match" ADD COLUMN "time_expired" BOOLEAN NOT NULL DEFAULT false;
