/*
  Zvanja (ZVANJA_PLAN.md, step 1).

  - Result and OngoingResult get each team's zvanja on the hand, counted by value: zvanja3 (tri trice, tri dvice, tri
    asa, napola) and zvanja4 (četiri trice, četiri dvice, četiri asa). The hand's total is its points plus
    3 × zvanja3 + 4 × zvanja4. Existing hands get 0: they were played without zvanja.
  - A team's counts stay within what the cards allow one team (12 cards make zvanja and a player holds 10): up to 7
    zvanja worth 3 with none worth 4, 5 with one, 2 with two, and none with three. What both teams can have together at
    one deal is checked by the app (_lib/game/scoring.ts), which also says why.
  - A custom hand (Custom, "s ovim dosta") has no zvanja: its typed points are the hand's total.
  - Tournament and Round get Bela's "declarations": a tournament is played with zvanja or "bez zvanja", and each table
    of a Kolo takes it when the Kolo is made. A league's tables always have zvanja. Existing tournaments and tables get
    true.
*/

ALTER TABLE "OngoingResult" ADD COLUMN "team1_zvanja3" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "team1_zvanja4" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "team2_zvanja3" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "team2_zvanja4" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OngoingResult" ADD CONSTRAINT "OngoingResult_team1_zvanja_check" CHECK (
  "team1_zvanja4" BETWEEN 0 AND 3
  AND "team1_zvanja3" BETWEEN 0 AND (CASE "team1_zvanja4" WHEN 0 THEN 7 WHEN 1 THEN 5 WHEN 2 THEN 2 ELSE 0 END)
);
ALTER TABLE "OngoingResult" ADD CONSTRAINT "OngoingResult_team2_zvanja_check" CHECK (
  "team2_zvanja4" BETWEEN 0 AND 3
  AND "team2_zvanja3" BETWEEN 0 AND (CASE "team2_zvanja4" WHEN 0 THEN 7 WHEN 1 THEN 5 WHEN 2 THEN 2 ELSE 0 END)
);
ALTER TABLE "OngoingResult" ADD CONSTRAINT "OngoingResult_custom_zvanja_check" CHECK (
  NOT "custom" OR ("team1_zvanja3" = 0 AND "team1_zvanja4" = 0 AND "team2_zvanja3" = 0 AND "team2_zvanja4" = 0)
);

ALTER TABLE "Result" ADD COLUMN "team1_zvanja3" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "team1_zvanja4" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "team2_zvanja3" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "team2_zvanja4" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Result" ADD CONSTRAINT "Result_team1_zvanja_check" CHECK (
  "team1_zvanja4" BETWEEN 0 AND 3
  AND "team1_zvanja3" BETWEEN 0 AND (CASE "team1_zvanja4" WHEN 0 THEN 7 WHEN 1 THEN 5 WHEN 2 THEN 2 ELSE 0 END)
);
ALTER TABLE "Result" ADD CONSTRAINT "Result_team2_zvanja_check" CHECK (
  "team2_zvanja4" BETWEEN 0 AND 3
  AND "team2_zvanja3" BETWEEN 0 AND (CASE "team2_zvanja4" WHEN 0 THEN 7 WHEN 1 THEN 5 WHEN 2 THEN 2 ELSE 0 END)
);
ALTER TABLE "Result" ADD CONSTRAINT "Result_custom_zvanja_check" CHECK (
  NOT "custom" OR ("team1_zvanja3" = 0 AND "team1_zvanja4" = 0 AND "team2_zvanja3" = 0 AND "team2_zvanja4" = 0)
);

ALTER TABLE "Tournament" ADD COLUMN "declarations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Round" ADD COLUMN "declarations" BOOLEAN NOT NULL DEFAULT true;
