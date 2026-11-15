/*
  Liga na dvije lokacije (LOCATIONS_PLAN.md, step 12): the place text columns go. Since 20261114120000_locations every
  league, night and tournament points at its place in Lokacije (location_id), and nothing reads location_name,
  location_address or location_url any more. No constraint, index or function uses them.

  Deploy it after the release that stops reading them is live: `npm run build` migrates before `next build`, and the
  deployment still serving until then selects these columns.
*/

-- AlterTable
ALTER TABLE "League" DROP COLUMN "location_name",
DROP COLUMN "location_address",
DROP COLUMN "location_url";

-- AlterTable
ALTER TABLE "LeagueNight" DROP COLUMN "location_name",
DROP COLUMN "location_address",
DROP COLUMN "location_url";

-- AlterTable
ALTER TABLE "Tournament" DROP COLUMN "location_name",
DROP COLUMN "location_address",
DROP COLUMN "location_url";
