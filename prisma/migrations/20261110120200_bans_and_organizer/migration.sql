-- Zabrana prijava and Organizator: Bela's 20261030120000_turniri_v1 (the SignupBan part) and
-- 20261107120000_organizer_role. Bans belong to the tournaments: a team or a player who doesn't show up in Kolo 1 is
-- banned from signing up by the app itself. League nights don't check bans (Tu smo came without them).

-- A team or a player (exactly one) may not sign up for any tournament until the day "until" (null: Trajno) or until an
-- admin lifts it. A team's ban usually comes with a ban for each of its players (via_ban_id: "preko ekipe"). A ban the
-- app sets itself has no created_by and names its tournament.
CREATE TABLE "SignupBan" (
    "id"            SERIAL NOT NULL,
    "team_id"       INTEGER,
    "player_id"     INTEGER,
    "via_ban_id"    INTEGER,
    -- the first day the team or player may sign up again; null = Trajno
    "until"         DATE,
    -- only admins see it
    "reason"        VARCHAR(200) NOT NULL DEFAULT '',
    "tournament_id" INTEGER,
    "created_by"    INTEGER,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifted_at"     TIMESTAMP(3),
    "lifted_by"     INTEGER,

    CONSTRAINT "SignupBan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SignupBan_target_check" CHECK (("team_id" IS NULL) <> ("player_id" IS NULL)),
    CONSTRAINT "SignupBan_via_check" CHECK ("via_ban_id" IS NULL OR "player_id" IS NOT NULL)
);

CREATE INDEX "SignupBan_team_id_idx" ON "SignupBan"("team_id");
CREATE INDEX "SignupBan_player_id_idx" ON "SignupBan"("player_id");
CREATE INDEX "SignupBan_via_ban_id_idx" ON "SignupBan"("via_ban_id");
ALTER TABLE "SignupBan" ADD CONSTRAINT "SignupBan_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignupBan" ADD CONSTRAINT "SignupBan_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignupBan" ADD CONSTRAINT "SignupBan_via_ban_id_fkey" FOREIGN KEY ("via_ban_id") REFERENCES "SignupBan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignupBan" ADD CONSTRAINT "SignupBan_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("tournament_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SignupBan" ADD CONSTRAINT "SignupBan_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SignupBan" ADD CONSTRAINT "SignupBan_lifted_by_fkey" FOREIGN KEY ("lifted_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Organizator: a third role beside ADMIN and PLAYER. An organizer makes tournaments and runs the ones they made;
-- everything else in the league stays the admin's. The role is in the code (_lib/auth/permissions.ts), the database
-- only says which role a player has. AFTER 'ADMIN' so the database's order of the enum is the schema's. The value is
-- only added here and used by no statement in this migration: Postgres refuses a value used in the transaction that
-- added it.
ALTER TYPE "RoleEnum" ADD VALUE 'ORGANIZER' AFTER 'ADMIN';

-- Whose tournament it is: the organizer who made it, or the admin. Set once, when the tournament is made, and never
-- changed (ownership.ts).
ALTER TABLE "Tournament" ADD COLUMN "created_by" INTEGER;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- the organizer's own list of tournaments ("moji turniri") reads by this column
CREATE INDEX "Tournament_created_by_idx" ON "Tournament"("created_by");
