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
| Konferencije na Podacima: dodaj dvije, ime i boja, odbijanja (isto ime, jedna, ista boja, boja izvan palete) | admin (računalo) | `tests/liga/k-upravljanje.racunalo.spec.ts` › the admin adds two conferences with their names and colors on Podaci, and the editor refuses what a league can't have |
| Ekipe: konferencija ekipe, filter, Rasporedi ravnomjerno | admin (računalo) | `tests/liga/k-upravljanje.racunalo.spec.ts` › the admin puts a team in a conference, and Rasporedi ravnomjerno deals all eight out in snake order of the table |
| Preimenuj, dodaj i obriši konferenciju (ekipe ostaju bez nje) | admin (računalo) | `tests/liga/k-upravljanje.racunalo.spec.ts` › the admin renames a conference, adds a third and deletes one, whose teams are left without a conference |
| Točka konferencije: Ukupni i Dnevni poredak, stolovi kola | igrač | `tests/liga/k-tocka.spec.ts` › each team's dot in its conference color shows on Ukupni poredak, Dnevni poredak and the Kolo's tables |
| Točke na kartici Započni igru (svoja ekipa prva, s obje strane stola) | igrač | `tests/liga/k-tocka.spec.ts` › Započni igru on Početna shows the two teams' conference colors, the player's own team first on both sides of the table |
| Poredak po konferenciji (Ukupni i Dnevni, ostaje nakon osvježavanja) | igrač | `tests/liga/k-poredak.spec.ts` › Ukupni poredak and Dnevni poredak with a conference picked show only its teams, ranked from 1, and the pick stays after a reload |
| Novo kolo „Samo unutar konferencija” uključeno | admin | `tests/liga/k-novo-kolo.spec.ts` › with Samo unutar konferencija on, every table of the new Kolo pairs two teams of one conference |
| Novo kolo „Samo unutar konferencija” isključeno | admin | `tests/liga/k-novo-kolo.spec.ts` › with Samo unutar konferencija off, the pairing ignores conferences |
| Novo kolo: premalo ekipa u konferenciji | admin | `tests/liga/k-novo-kolo.spec.ts` › with Samo unutar konferencija on, a conference with too few teams tonight is refused with its name |
| Liga bez konferencija: bez točaka, filtera i prekidača | igrač, admin | `tests/liga/k-bez-konferencija.spec.ts` › a league without conferences shows no dots and no conference filter, and Novo kolo has no Samo unutar konferencija |
