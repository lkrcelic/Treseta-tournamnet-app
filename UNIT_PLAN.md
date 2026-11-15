# Unit i db testovi — Treseta

Dio [`ORKESTRACIJA_AGENATA.md`](ORKESTRACIJA_AGENATA.md). E2E (Playwright) je u [`E2E_PLAN.md`](E2E_PLAN.md).
Pravila i odluke su Beline (`../Bela-Treseta-Tournamnet-app/UNIT_PLAN.md`, pogl. 2 i 3, i skill `testovi`): isti
`node:test`, bez jsdom-a, db testovi na bazi koja se baca, ime testa kaže pravilo. Ovdje je samo ono što je
Tresetino.

## 1. Kako je sada (15.11.)

- **Unit:** `npm test` pokreće 611 testova iz 58 fileova za ~6 s, sve zeleno.
- **Db:** 63 testa iz 16 fileova u `__tests__/db/` (vrijeme partije, zvanja, na prolaz, zatvaranje kola, ispravljeni
  meč, nedolazak, Uredi ishod, lista čekanja, turnir s jednom partijom, cilj partije, i pet za lokacije). Pokreće ih
  `npm run test:db:local` na svježoj bazi u `bela-e2e-pg`, a od 15.11. i noćni run.
- **Rupe:** 57 od 149 modula u `_lib` nijedan test ne uvozi izravno. Većina je zajednička s Belom (servisi
  `round/`, `league/`, `tournament/`, `team/`, `players/`, `bans`, `burza` …); njihove testove piše Bela (Belin
  `UNIT_PLAN.md`, pogl. 4) i dolaze syncom. **Tresetini** moduli bez testa:
  - `helpers/databaseHelpers` (`transformResult`, `transformMatch`): prepisuje završen meč i njegove igre iz
    `OngoingMatch`/`OngoingResult` u `Match`/`Result`;
  - `service/ongoingResult/matchState` (`ongoingMatchState`, `assertPlayersHand`, `assertCallStands`) i
    `service/ongoingResult/getOne`;
  - `service/ongoingMatch/getOneWithResults`, `service/ongoingMatch/getRoundId`;
  - `service/admin/recalc` i `service/ratings/ratings`: rejting čita `winner_side`, pa je pobjeda "s ovim dosta" s
    manje bodova pobjeda;
  - `service/league/conferences`;
  - `brand`.

## 2. Backlog (Tresetin kod, redom po šteti)

**P1 — gube se igre ili rezultati** (db)
- `transformMatch` / `transformResult` kroz zatvaranje stola: meč s Custom igrom, igrom sa zvanjima i pozivom
  "s ovim dosta" prenosi `custom`, `dosta_side`, zvanja (`team*_zvanja3/4`) i `winner_side` u `Match`/`Result`, i
  ništa više (područje Belinog 1bb39ea: Prisma odbije nepoznato polje).
- `ongoingMatchState` na pravoj bazi: cilj 41 → 51 nakon izjednačenja, poziv "s ovim dosta" koji ne stoji se
  odbija (`assertCallStands`), igračev Custom za stolom "na prolaz" se odbija (`assertPlayersHand`), a adminov
  prolazi.
- `replayRatings` i `ratings`: pobjeda "s ovim dosta" s manje bodova ulazi u rejting kao pobjeda, a meč bez
  pobjednika ne ulazi.

**P2 — konferencije** (db): `setLeagueConferences` (dodaj, preimenuj, obriši konferenciju koja ima ekipe),
`setLeagueTeamConference(s)` i `getRoundConferences`; kolo složeno sa "Samo unutar konferencija" spari samo ekipe
iste konferencije.

**P3 — ostalo:** `getOneWithResults` i `getRoundId` (unit ili db, uz P1), `brand` (unit).

**Lokacije** su stigle sa svojim db testovima (dolazak po mjestima, dnevni poredak, kola po mjestu, podjela, Početna
večeras); nove promjene nose svoje, po skillu.

Backlog pišu sesije koje ti pokreneš, svaka stavka jedan commit s testom. Kad test otkrije bug, ostaje crven
(`{todo: "#N"}`) i otvara se issue; test se ne prilagođava bugu.

## 3. Pokretanje

| Gdje | Što |
| --- | --- |
| Sesija, prije commita | `npm test` (hook) i `npx tsc --noEmit`; `npm run test:db:local` kad je dirala nešto iz db retka skilla |
| `treseta-e2e-nightly` | `npm test`, lint, `tsc` i `test:db:local` na `master`u i na `bela-sync`u (kad ima commitova iza mastera) |
| `bela-nightly-sync` | `npm test`, lint, `tsc` i `next build` na `bela-sync`u (njegov korak 5) |
