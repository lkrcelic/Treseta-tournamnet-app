-- Sponsors (Claude Design "Sponzori ekrani"): the admin's one list of sponsors, the ones each league shows (in the
-- admin's order) and, for the sponsors, how often their logo was shown and their page opened, per league and day.
CREATE TABLE "Sponsor" (
    "id"          SERIAL NOT NULL,
    "name"        VARCHAR(100) NOT NULL,
    "url"         VARCHAR(500),
    "message"     VARCHAR(80) NOT NULL DEFAULT '',
    "dark"        BOOLEAN NOT NULL DEFAULT false,
    "logo"        BYTEA NOT NULL,
    "logo_type"   VARCHAR(20) NOT NULL,
    "logo_width"  INTEGER NOT NULL,
    "logo_height" INTEGER NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Sponsor_name_check" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "Sponsor_url_check" CHECK ("url" IS NULL OR "url" ~* '^https?://'),
    CONSTRAINT "Sponsor_logo_type_check" CHECK ("logo_type" IN ('image/png', 'image/jpeg', 'image/webp')),
    CONSTRAINT "Sponsor_logo_size_check" CHECK (octet_length("logo") <= 1048576 AND "logo_width" > 0 AND "logo_height" > 0)
);

CREATE TABLE "LeagueSponsor" (
    "league_id"  INTEGER NOT NULL,
    "sponsor_id" INTEGER NOT NULL,
    "position"   INTEGER NOT NULL,

    CONSTRAINT "LeagueSponsor_pkey" PRIMARY KEY ("league_id", "sponsor_id")
);

ALTER TABLE "LeagueSponsor" ADD CONSTRAINT "LeagueSponsor_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueSponsor" ADD CONSTRAINT "LeagueSponsor_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SponsorDailyStat" (
    "sponsor_id" INTEGER NOT NULL,
    "league_id"  INTEGER NOT NULL,
    "day"        DATE NOT NULL,
    "views"      INTEGER NOT NULL DEFAULT 0,
    "clicks"     INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SponsorDailyStat_pkey" PRIMARY KEY ("sponsor_id", "league_id", "day")
);

ALTER TABLE "SponsorDailyStat" ADD CONSTRAINT "SponsorDailyStat_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SponsorDailyStat" ADD CONSTRAINT "SponsorDailyStat_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SponsorDailyStat_league_id_idx" ON "SponsorDailyStat"("league_id");
