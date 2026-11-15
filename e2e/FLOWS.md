# Tokovi i testovi

Svaki tok iz perspektive igrača, organizatora i admina, i test koji ga pokriva (ili "nema"). Sekcije su u
[`sekcije/`](sekcije/README.md), plan u [`../E2E_SUITE_PLAN.md`](../E2E_SUITE_PLAN.md). Voditelj upisuje retke iz
izvještaja sekcija; sesija koja doda tok ili test dopiše svoj redak u istom commitu.

| Tok | Uloga | Test |
| --- | --- | --- |
| Prijava kroz API i Početna | igrač | `tests/smoke/baza.spec.ts` › a player logged in through the API lands on Početna |
| Novo kolo → Tko igra večeras → Kreiraj → Skica → Odobri sva → Objavi → Dnevni poredak | admin | `tests/liga/c1-novo-kolo.spec.ts` › the admin creates tonight's Kolo with Novo kolo, approves and publishes it, and Dnevni poredak shows it |
| Tko igra (zamjena igrača) i upis igre: Zvanja 3/4, 11-split | igrač | `tests/liga/c1-stol.spec.ts` › Tko igra starts the table, and hands entered with zvanja and the keypad are listed with their totals |
| Ručno i „s ovim dosta” (pobjeda s manje bodova, Završi meč) | igrač | `tests/liga/c1-stol.spec.ts` › a custom hand that takes both teams past 41 asks "s ovim dosta", and the team that called it wins with fewer points |
| Ručno bez poziva („Ne, nitko nije zvao”) | igrač | `tests/liga/c1-stol.spec.ts` › a custom hand below the target asks nothing, and "Ne, nitko nije zvao" leaves the match to the points |
| Izjednačeno na 41+ → Do 51 | igrač | `tests/liga/c1-stol.spec.ts` › teams level at 41 or more play on to 51 (Do 51), and only then is there a winner |
| Ispravak spremljene igre (obična i ručna) | igrač | `tests/liga/c1-ispravak.spec.ts` › a corrected hand is still one hand, with the new points and zvanja in the list, the score and the database |
| Ispravak spremljene igre na `tables.correction` | igrač | `tests/liga/c1-ispravak.spec.ts` › tables.correction: the second of the seeded hands corrected on team1's phone, and the match moved by the difference |
| Završi meč dvaput (Bela #74; `test.fail` dok sync ne donese Belin e721909) | igrač | `tests/liga/c1-kraj.spec.ts` › Završi meč tapped twice opens Meč 2 and no hand entry (Bela #74) |
| Meč 2, Kraj kola, Dnevni i Ukupni poredak, rejting | igrač | `tests/liga/c1-kraj.spec.ts` › Meč 1 and Meč 2 won on the phone end the Kolo, and Dnevni poredak, Ukupni poredak and the ratings follow |
