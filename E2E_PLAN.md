# E2E testovi — Treseta

Dio [`ORKESTRACIJA_AGENATA.md`](ORKESTRACIJA_AGENATA.md). Unit i db testovi su u [`UNIT_PLAN.md`](UNIT_PLAN.md).

Belin plan (`../Bela-Treseta-Tournamnet-app/E2E_PLAN.md`) vrijedi i ovdje: isti stack (Podman, compose,
produkcijski build, Playwright), isti generirani svijet oblika produkcije, isti testovi (A prolaz kroz stranice, B
dozvole, C glavni tokovi). Kod je skoro isti, pa su i testovi skoro isti: Playwright testove piše Bela, dolaze
syncom, a `treseta-e2e-nightly` ih svaku noć vrti na Tresetinom `master`u i `bela-sync`u. Ovdje je samo ono što
Treseta mora imati svoje.

## 1. Kako je sada (15.11.)

- U Beli je gotov generator podataka (`e2e/seed/`, `npm run seed:e2e`, `npm run seed:verify`), ali ga Bela još
  nije deployala, pa ga sync još nije donio. Compose, `run.sh` i Playwright testova još nema ni u Beli (njene faze
  1, 3 i 4).
- U Treseti noćni run zato vrti unit, db, lint i `tsc`, a Playwright preskače ("no suite yet").

## 2. Što dolazi iz Bele kako jest

`playwright.config.ts`, pomoćnici za prijavu i pomak vremena, i testovi koji ne upisuju igru (Belin compose stack,
`compose.e2e.yml` i `app.Dockerfile`, nije napravljen ni u Beli: suite vrti lokalni `e2e/local/app.sh`, a noćni run
Tresetin `e2e/run.sh` na njemu, 18.11.): A (prolaz kroz stranice), B (dozvole), dio C3 (prijave, lista čekanja, Tu smo,
Nedolazak, Vrati stol), C6 (prijava u aplikaciju), C7 (organizator), C8 (Burza) i C9 (profil).

## 3. Što je Tresetino

| Dio | Belin | Tresetin |
| --- | --- | --- |
| `e2e/seed/play.ts` i scenariji s igrama (`history`, `tonight`, `tournamentPlay`) | igra do 1001, Belina zvanja (20–200) i bela, tko je zvao | igra od 11 bodova, Custom, Kaput "na prolaz", "s ovim dosta", zvanja 3 i 4, meč do 41 (51, 61 nakon izjednačenja), kolo od dvije partije, bye 5 : 0 dvaput |
| `e2e/seed/verify.ts` | 16 pravila, pobjednik je onaj s 1001 | ista pravila s `MATCH_THRESHOLD`, `winner_side` i `dosta_side` |
| `e2e/seed/scenarios/leagues.ts` | lige bez konferencija | i liga s dvije konferencije ("Samo unutar konferencija"); i liga na dvije lokacije |
| upis igre: pomoćnik `scorepad.ts`, C1, C2, C4, C5 | Belin upis (zvao → zvanja → bodovi) | Tresetin upis: 11-split, Custom, pitanje "s ovim dosta", "Izjednačeno · još jedna igra", adminov Ručni unos |
| brend u očekivanjima | "Bela Liga" | `BRAND` |

## 4. Kako to dolazi

- **Belin generator sync ne prenosi** dok Treseta nema svoj (`BELA_SYNC.md`, Not copied): Belin `play.ts` uvozi
  Belino bodovanje, pa se u Treseti ne bi ni preveo, a `next build` provjerava i `e2e/`. S njim ostaju vani i
  skripte `seed:e2e` i `seed:verify` u `package.json`.
- 15.11. Treseta je napravila svoj generator odmah, iz Belinog (`6971500`), i piše suite usporedo s Belom
  ([`E2E_SUITE_PLAN.md`](E2E_SUITE_PLAN.md)), umjesto da čeka. Od tada sync nosi zajedničke testove kako jesu, a Tresetini dijelovi iz tablice gore ostaju Own version.
- Promjena toka u Tresetinom kodu do tada nosi unit ili db test, uz "no E2E yet" u commit poruci (skill).

## 5. Faze

| Faza | Što | Gotovo kad |
| --- | --- | --- |
| TE0 | noćni run: unit, db, lint, `tsc` na `master`u i `bela-sync`u (15.11.) | prvo jutro s izvještajem |
| TE1 | Belin suite gotov (Beline faze 1–4); Treseta ga piše usporedo, istim planom ([`E2E_SUITE_PLAN.md`](E2E_SUITE_PLAN.md)) | u Beli |
| TE2 | ~~Tresetin generator: `e2e/seed/` kao Own version, `seed:e2e` i `seed:verify` u `package.json`~~ (15.11., grana `e2e-suite`, [`E2E_SUITE_PLAN.md`](E2E_SUITE_PLAN.md)) | `seed:verify` zelen na Tresetinom svijetu |
| TE3 | Tresetini testovi upisa igre (C1, C2, C4, C5) i Tresetin `e2e/FLOWS.md` | svaki prolazi `--repeat-each=5` |
| TE4 | noćni run vrti cijeli suite (`run.sh`), sync nosi Beline testove | prva noć s Playwrightom |

## 6. Otvoreno

- **Kako Treseta dobiva generator:** kopija Belinog s Tresetinom igrom, ili Belin generator koji igru uzima iz
  jednog modula, pa Treseta zamijeni samo taj modul (kao `_lib/game/scoring.ts` zamjenjuje `_lib/bela/scoring.ts`)?
  Prijedlog: drugo, jer je manje razlika za sync. **15.11.:** za sada prvo, kopija s Tresetinom igrom (`play.ts`,
  `live.ts`, `verify.ts`); drugo ostaje opcija kad Bela mijenja generator.
