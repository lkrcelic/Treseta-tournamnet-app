/*
  Smokers and smoking tables.

  - Player.smoker: the player smokes ("Pušiš li?" at sign-up after the birth date, the Smoker switch on the profile).
    smoker_answered stays false for the players who signed up before it, so the app asks them once.
  - League.smoking_tables: the smoking tables of the league's last Create Round, offered again the next time.
  - Round.smoking_table: smoking is allowed at the table. team1_smokers / team2_smokers: the smokers on each team's
    roster when it was seated, which the smoking rotation counts from (rounds at a smoking table, nights without one).
*/

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "smoker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smoker_answered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "smoking_tables" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "smoking_table" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "team1_smokers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "team2_smokers" INTEGER NOT NULL DEFAULT 0;
