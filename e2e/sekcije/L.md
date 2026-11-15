# Section L (Treseta only)

**Area:** `e2e/tests/liga/l-*.spec.ts` · **helper file:** `e2e/helpers/l.ts` · **app id:** `l`

Lokacije and the league night at two places. Bela keeps one place per night as text, so only this section tests it.

Read `e2e/sekcije/README.md` first: where you work, how tests are written here, what "done" means and the report. The rules are in `BELA_SYNC.md` · Lokacije and `LOCATIONS_PLAN.md`; the db tests `src/app/_lib/__tests__/db/` (`arrivalPlaces`, `dailyPlaces`, `placeRounds`, `split`, `homeTonight`) show what the services promise.

## Flows to cover
- **Admin · Lokacije:** add a place (name, address, Google Maps link), edit it, and the refusal to delete a place in use (`places.pitanik` is used by the leagues and tournaments); delete an unused one.
- **A league's default place** ("Zadano lige") and a night's own place, as Raspored and Početna show them.
- **A night at two places** (on a league night of your own): the second place, Podjela (teams split between place 1 and 2), each place's Tu smo, Novo kolo, Skica and Objavi; the tables carry their place (`Round.location_slot`), the Kolo numbers stay the league's, and Dnevni poredak has a view per place.
- **Players:** Početna večeras shows the player's place; Tu smo answers for that place only.
- A one-place night works as before (no slot written).

## Notes
The generated world has two places (`places.pitanik`, `places.dubrava`) and no two-place night (Scenario requests: say what one should hold). Make your own night with Prisma or the admin's API in a fixture, and clean it up, so `--repeat-each=5` starts from the same point.
