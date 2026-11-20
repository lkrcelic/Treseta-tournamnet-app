-- Sakrij broj prijava (DECISIONS #93): until the tournament starts, players see neither the number of teams signed up
-- nor the list of them. False = as before.
ALTER TABLE "Tournament" ADD COLUMN "hide_entries" BOOLEAN NOT NULL DEFAULT false;
