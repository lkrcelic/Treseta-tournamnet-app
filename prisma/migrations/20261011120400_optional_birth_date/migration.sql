-- The Bela app's migration 20261004150000_optional_birth_date, word for word. This app's Google sign-up stored the same
-- placeholder (the sign-up day as birth date, no password).

/*
  Players who sign up with Google don't give a birth date; the app asks for it after their first login.

  - Player.birth_date becomes optional.
  - Google sign-ups so far got the day they signed up as birth date. Those placeholders are cleared, so the app asks
    these players too. A Google player has no password; the placeholder is within a day of created_at (the two were
    written in different time zones).
*/

-- AlterTable
ALTER TABLE "Player" ALTER COLUMN "birth_date" DROP NOT NULL;

UPDATE "Player"
SET "birth_date" = NULL
WHERE "password_hash" = ''
  AND "birth_date" BETWEEN ("created_at"::date - 1) AND ("created_at"::date + 1);
