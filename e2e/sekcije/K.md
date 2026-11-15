# Section K (Treseta only)

**Area:** `e2e/tests/liga/k-*.spec.ts` · **helper file:** `e2e/helpers/k.ts` · **app id:** `k`

Conferences: a league split into conferences, the colored dot before a team's name, the standings per conference, and Novo kolo pairing within each conference. Bela has none of it, so only this section tests it.

Read `e2e/sekcije/README.md` first: where you work, how tests are written here, what "done" means and the report. The rules are in `BELA_SYNC.md` · Conferences and `docs/arhiva/CONFERENCES_PLAN.md`; the pure rules in `src/app/_lib/conferences.ts` (none or 2–6, names and colors unique).

## Flows to cover
- **Admin, Upravljanje ligom:** on a league of your own (made in a fixture, or through Create League with conferences): add two conferences with names and colors, assign the teams (and "Distribute evenly"), rename one, delete one; the validation messages for a single conference, duplicate names or colors.
- **The dot:** after saving, the team's dot in its conference color shows wherever the league's teams are listed (Dnevni poredak, Ukupni poredak, the scorepad's team cards).
- **Standings per conference:** Dnevni poredak and Ukupni poredak with a conference picked show only that conference's teams; the pick survives a reload in the same tab.
- **Novo kolo "Samo unutar konferencija":** with the switch on, every published table pairs two teams of the same conference (check in the database); with it off, any pairing.
- A league without conferences shows no dots and no filter.

## Notes
The generated world has no conferences (Scenario requests: say what a conference scenario should hold). Make your own league with Prisma or the admin's API in a fixture, and clean it up, so `--repeat-each=5` starts from the same point.
