-- Turniri: a one-day event teams sign up for, played in Kolos of tables like a league night (Bela's
-- 20261026120000_tournaments, 20261030120000_turniri_v1, 20261031120000_tournament_auto_publish,
-- 20261107180000_open_signups and 20261107190000_open_signups_check, as one migration; Treseta never had Bela's old
-- unused Tournament tables, so everything is created rather than altered). A Kolo is a set of Round rows (one per
-- table) linked by TournamentRound, so the scorepad, Tko igra and the ratings work for them as they are; every table
-- of a tournament carries its date, which makes the whole tournament one rating period.
--
-- Treseta's own: no "declarations" column (zvanja are Bela's game), and TeamScore keeps only its league — a
-- tournament's standings are counted from its tables (_lib/leagueOrder.ts), never stored.

-- a team's entry: in the tournament, or on its waiting list (in the order they signed up)
CREATE TYPE "TournamentEntryStatus" AS ENUM ('REGISTERED', 'WAITING');

-- out of the rest of the tournament: a no-show, a skipped match, or the admin's Isključi ekipu
CREATE TYPE "TournamentExclusion" AS ENUM ('NO_SHOW', 'SKIPPED', 'ADMIN');

-- Nedolazak za stol: the answer to "Jesu li … za stolom?" (PRESENT: Da, tu su; NO_SHOW: Ne, nisu došli, the answering
-- team wins every match of the table as a Slobodna runda is won) or SKIPPED (nobody started or answered in time: not
-- scored)
CREATE TYPE "RoundAttendance" AS ENUM ('PRESENT', 'NO_SHOW', 'SKIPPED');

-- the tournament itself: when and where, its format, its registrations and its day
CREATE TABLE "Tournament" (
    "tournament_id"      SERIAL NOT NULL,
    "tournament_name"    VARCHAR(100) NOT NULL,
    -- the day it is played; every Kolo's tables carry it as their round_date
    "date"               DATE NOT NULL,
    -- "HH:MM": Okupljanje and Početak, both optional
    "gathering_time"     VARCHAR(5),
    "start_time"         VARCHAR(5),
    "location_name"      VARCHAR(100),
    "location_address"   VARCHAR(200),
    "location_url"       VARCHAR(500),
    -- Broj kola
    "rounds"             INTEGER NOT NULL DEFAULT 9,
    -- Partija po kolu: the matches a table plays (1 or 2)
    "matches_per_round"  INTEGER NOT NULL DEFAULT 2,
    -- Najveći broj ekipa; null = no limit. Teams over it wait on the waiting list
    "max_teams"          INTEGER,
    -- Kotizacija po igraču in whole euros
    "entry_fee"          INTEGER NOT NULL DEFAULT 0,
    "rules_url"          VARCHAR(500),
    -- the admin's Prijave otvorene; closed by itself when the tournament starts, unless open_signups
    "registrations_open" BOOLEAN NOT NULL DEFAULT true,
    -- Automatska kola: once every table of a Kolo is over, the next one is made and published at once
    "auto_publish"       BOOLEAN NOT NULL DEFAULT false,
    -- Otvorene prijave: teams may sign up while the tournament is played, up to the last Kolo
    "open_signups"       BOOLEAN NOT NULL DEFAULT false,
    -- Telefon organizatora: the players call it or write on WhatsApp from the tournament's page
    "organizer_phone"    VARCHAR(30),
    -- when Kolo 1 was published
    "started_at"         TIMESTAMP(3),
    "cancelled_at"       TIMESTAMP(3),
    -- the admin who pressed Otkaži
    "cancelled_by"       INTEGER,
    -- when the start time's switch ran: sign-ups closed, the teams that didn't confirm became inactive and the
    -- confirmed teams on the waiting list came in (up to the limit)
    "arrival_closed_at"  TIMESTAMP(3),
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("tournament_id")
);

ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_name_check" CHECK (length(btrim("tournament_name")) > 0);
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_gathering_time_check" CHECK ("gathering_time" IS NULL OR "gathering_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_start_time_check" CHECK ("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_rounds_check" CHECK ("rounds" BETWEEN 1 AND 20);
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_matches_per_round_check" CHECK ("matches_per_round" IN (1, 2));
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_max_teams_check" CHECK ("max_teams" IS NULL OR "max_teams" >= 2);
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_entry_fee_check" CHECK ("entry_fee" BETWEEN 0 AND 999);
-- a tournament that started takes no sign-ups, unless it has Otvorene prijave; one is cancelled only before it starts
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_started_check" CHECK ("started_at" IS NULL OR "open_signups" OR NOT "registrations_open");
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_cancelled_check" CHECK ("cancelled_at" IS NULL OR ("started_at" IS NULL AND NOT "registrations_open"));
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Nagrade: one row per place, in order (1 = first place)
CREATE TABLE "TournamentPrize" (
    "tournament_id" INTEGER NOT NULL,
    "place"         INTEGER NOT NULL,
    "prize"         VARCHAR(100) NOT NULL,
    "description"   VARCHAR(200) NOT NULL DEFAULT '',

    CONSTRAINT "TournamentPrize_pkey" PRIMARY KEY ("tournament_id", "place"),
    CONSTRAINT "TournamentPrize_place_check" CHECK ("place" >= 1)
);

ALTER TABLE "TournamentPrize" ADD CONSTRAINT "TournamentPrize_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("tournament_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A team's entry and its day at the tournament. registered_by: the player who signed it up (null: an admin added it).
-- arrived_*: Potvrda dolaska (Tu smo, or the admin's Označi dolazak); active: it is paired in the next Kolo (Aktivna);
-- excluded_*: out of the rest of the tournament after a Kolo, until an admin brings it back (Vrati)
CREATE TABLE "TournamentTeam" (
    "tournament_id"    INTEGER NOT NULL,
    "team_id"          INTEGER NOT NULL,
    "status"           "TournamentEntryStatus" NOT NULL DEFAULT 'REGISTERED',
    "registered_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registered_by"    INTEGER,
    "arrived_at"       TIMESTAMP(3),
    "arrived_by"       INTEGER,
    "arrived_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "active"           BOOLEAN NOT NULL DEFAULT true,
    "excluded_at"      TIMESTAMP(3),
    "excluded_kolo"    INTEGER,
    "excluded_reason"  "TournamentExclusion",

    CONSTRAINT "TournamentTeam_pkey" PRIMARY KEY ("tournament_id", "team_id"),
    CONSTRAINT "TournamentTeam_excluded_check" CHECK (("excluded_at" IS NULL) = ("excluded_reason" IS NULL))
);

-- a team's own entries ("moji turniri") and the admin's team pages read by the team
CREATE INDEX "TournamentTeam_team_id_idx" ON "TournamentTeam"("team_id");
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("tournament_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_arrived_by_fkey" FOREIGN KEY ("arrived_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- which tables belong to which tournament (a Kolo is the tables with the same round_number)
CREATE TABLE "TournamentRound" (
    "tournament_id" INTEGER NOT NULL,
    "round_id"      INTEGER NOT NULL,

    CONSTRAINT "TournamentRound_pkey" PRIMARY KEY ("tournament_id", "round_id")
);

-- a table is looked up by its round id (the admin's table edits)
CREATE INDEX "TournamentRound_round_id_idx" ON "TournamentRound"("round_id");
ALTER TABLE "TournamentRound" ADD CONSTRAINT "TournamentRound_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("tournament_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentRound" ADD CONSTRAINT "TournamentRound_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A table plays two matches in a league; a tournament plays one or two (Partija po kolu). Every round there is now
-- keeps the league's two.
ALTER TABLE "Round" ADD COLUMN "matches_per_round" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Round" ADD CONSTRAINT "Round_matches_per_round_check" CHECK ("matches_per_round" IN (1, 2));

-- a tournament table's answer to "Jesu li … za stolom?": who answered (attendance_team_id, one of the two teams; the
-- other one didn't come when it is NO_SHOW), which player and when; SKIPPED has no team. A NO_SHOW or SKIPPED table
-- isn't rated.
ALTER TABLE "Round" ADD COLUMN "attendance" "RoundAttendance",
ADD COLUMN "attendance_team_id" INTEGER,
ADD COLUMN "attendance_by" INTEGER,
ADD COLUMN "attendance_at" TIMESTAMP(3);
ALTER TABLE "Round" ADD CONSTRAINT "Round_attendance_team_check" CHECK ("attendance_team_id" IS NULL OR "attendance_team_id" IN ("team1_id", "team2_id"));
-- an answer has a time; a skipped table has no answering team, an answered one has it
ALTER TABLE "Round" ADD CONSTRAINT "Round_attendance_at_check" CHECK (("attendance" IS NULL) = ("attendance_at" IS NULL));
ALTER TABLE "Round" ADD CONSTRAINT "Round_attendance_skipped_check" CHECK ("attendance" IS DISTINCT FROM 'SKIPPED' OR "attendance_team_id" IS NULL);
ALTER TABLE "Round" ADD CONSTRAINT "Round_attendance_answer_check" CHECK ("attendance" IS NULL OR "attendance" = 'SKIPPED' OR "attendance_team_id" IS NOT NULL);
ALTER TABLE "Round" ADD CONSTRAINT "Round_attendance_by_fkey" FOREIGN KEY ("attendance_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
