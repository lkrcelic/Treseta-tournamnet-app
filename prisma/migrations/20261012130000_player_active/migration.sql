/*
  Deactivating and deleting players (admin, "Uredi osobne podatke").

  - Player.active: false = deactivated by an admin. The player can't log in and isn't offered when building teams or
    lineups; results and rating stay.
  - Player.deleted_at: set when an admin deleted the player. The row stays, anonymised as "Obrisani igrač", so
    played rounds, lineups and rating history keep their player. A deleted player is always inactive.
*/

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- a deleted player is always inactive
ALTER TABLE "Player" ADD CONSTRAINT "Player_deleted_inactive_check" CHECK ("deleted_at" IS NULL OR "active" = false);
