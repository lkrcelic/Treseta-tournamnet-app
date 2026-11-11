/*
  Igra se do: a tournament is played to 41, as a league is, or to 51.

  - Tournament gets `score_threshold` (41 or 51), set in its form next to Zvanja.
  - Round gets the same: every table of a Kolo takes its tournament's when the Kolo is made, and a match started at the
    table takes the table's (the server sets it, whatever the phone sends). A league's tables stay at 41.
  - A tie at or above the target still raises it by 10 (51 → 61 …), with 5 more minutes of Vrijeme partije each time.
  - Existing tournaments and tables get 41, as they were played.
*/

ALTER TABLE "Tournament" ADD COLUMN "score_threshold" INTEGER NOT NULL DEFAULT 41;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_score_threshold_check" CHECK ("score_threshold" IN (41, 51));

ALTER TABLE "Round" ADD COLUMN "score_threshold" INTEGER NOT NULL DEFAULT 41;
ALTER TABLE "Round" ADD CONSTRAINT "Round_score_threshold_check" CHECK ("score_threshold" IN (41, 51));
