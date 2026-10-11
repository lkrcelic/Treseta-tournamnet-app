/*
  Conferences: a league can split its teams into groups with a name and a color (a dot before the team's name, and
  standings per conference). Additive: existing leagues have no conferences and their teams none.

  - Conference belongs to one league and goes with it. Names and colors are unique within the league; the app checks
    that when it saves the league's list.
  - LeagueTeam gets the team's conference in that league. Deleting a conference leaves its teams without one.
*/

-- CreateTable
CREATE TABLE "Conference" (
    "conference_id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Conference_pkey" PRIMARY KEY ("conference_id")
);

-- #RRGGBB
ALTER TABLE "Conference" ADD CONSTRAINT "Conference_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');

CREATE INDEX "Conference_league_id_idx" ON "Conference"("league_id");

ALTER TABLE "Conference" ADD CONSTRAINT "Conference_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "LeagueTeam" ADD COLUMN     "conference_id" INTEGER;

CREATE INDEX "LeagueTeam_conference_id_idx" ON "LeagueTeam"("conference_id");

ALTER TABLE "LeagueTeam" ADD CONSTRAINT "LeagueTeam_conference_id_fkey" FOREIGN KEY ("conference_id") REFERENCES "Conference"("conference_id") ON DELETE SET NULL ON UPDATE CASCADE;
