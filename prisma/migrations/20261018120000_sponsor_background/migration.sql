-- A sponsor's logo can also go without anything under it (Pozadina loga: Svijetla · Tamna · Bez pozadine): the
-- dark/light flag becomes one of three backgrounds, keeping each sponsor's choice.
ALTER TABLE "Sponsor" ADD COLUMN "background" VARCHAR(10) NOT NULL DEFAULT 'light';
UPDATE "Sponsor" SET "background" = 'dark' WHERE "dark";
ALTER TABLE "Sponsor" DROP COLUMN "dark";
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_background_check" CHECK ("background" IN ('light', 'dark', 'none'));
