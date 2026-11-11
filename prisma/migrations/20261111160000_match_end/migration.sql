/*
  Kraj partije: a tournament's matches end "s ovim dosta", as until now, or "na prolaz".

  - Tournament and Round get `match_end`. Every table of a Kolo takes its tournament's when the Kolo is made, and the
    server reads the table's for every hand and every Završi meč. A league's tables stay S_OVIM_DOSTA.
  - Na prolaz: no "s ovim dosta" and no raise of the target. Once a team is at the target the team with more points
    wins; level at or above it, one more hand is played, with 5 more minutes of Vrijeme partije each time. The players'
    Custom key is Kaput there (11 : 0, a normal hand); an admin's correction may still be custom.
  - Existing tournaments and tables get S_OVIM_DOSTA, as they were played.
*/

CREATE TYPE "MatchEnd" AS ENUM ('S_OVIM_DOSTA', 'NA_PROLAZ');

ALTER TABLE "Tournament" ADD COLUMN "match_end" "MatchEnd" NOT NULL DEFAULT 'S_OVIM_DOSTA';
ALTER TABLE "Round" ADD COLUMN "match_end" "MatchEnd" NOT NULL DEFAULT 'S_OVIM_DOSTA';
