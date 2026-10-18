-- Pozadina loga has two choices: Bez pozadine or Crna pozadina. A logo that was on white goes without a background.
ALTER TABLE "Sponsor" DROP CONSTRAINT "Sponsor_background_check";
UPDATE "Sponsor" SET "background" = 'none' WHERE "background" = 'light';
ALTER TABLE "Sponsor" ALTER COLUMN "background" SET DEFAULT 'none';
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_background_check" CHECK ("background" IN ('none', 'dark'));
