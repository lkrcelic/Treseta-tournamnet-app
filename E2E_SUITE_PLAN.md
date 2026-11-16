# Playwright suite s agentima — Treseta

Dio [`E2E_PLAN.md`](E2E_PLAN.md) i [`ORKESTRACIJA_AGENATA.md`](ORKESTRACIJA_AGENATA.md). Isti plan kao Belin
`E2E_SUITE_PLAN.md` (zajednička baza, pa jedan agent po sekciji, paralelno, svaki u svom worktreeju, sa svojim
serverom i svojom bazom), na Tresetinom kodu i Tresetinim pravilima igre. Ovdje je samo ono što je drukčije.

## 1. Odluke (15.11.)

| Odluka | Izbor |
| --- | --- |
| Sekcije | **13:** Belinih 11 (A, B, C1–C9) i dvije Tresetine: **K** (konferencije) i **L** (lokacije), koje Bela nema pa ih ni ne testira. Svaka sekcija je jedan agent. |
| Redoslijed | **Generator → baza → pilot C1 → ostalih 12 paralelno**, kao u Beli. |
| Generator | **Tresetin, iz Belinog** (`6971500`): `play.ts`, `live.ts` i `verify.ts` igraju i provjeravaju Tresetinu igru (11 bodova, Kaput, zvanja 3 i 4, Custom i "s ovim dosta", meč do 41/51, na prolaz, bye i nedolazak 5 : 0, pobjede po `winner_side`); mjesta su iz Lokacija (`scenarios/places.ts`); Sakrij broj prijava (Treseta ga nema) zamijenio je turnir "na prolaz". Isti oblik svijeta: 409 igrača, 181 ekipa, ~18.000 igara, 14 turnira, ~11 s. |
| Okruženje | Kao u Beli: jedan produkcijski build u `e2e-suite` worktreeju, svaka sekcija svoja baza i svoj `next start`. **Postgres je Belin `bela-e2e-pg`**, ali baze su `treseta_e2e_<id>`, a portovi 4000+ (Belini 3900+), pa obje suite mogu raditi u isto vrijeme. Tajne su lažne, u `e2e/local/env.e2e` (Treseta ne prati `.env`). |
| Install sheet | Treseta ga pokazuje pri svakom otvaranju Početne u pregledniku, pa testovi glume aplikaciju otvorenu s početnog zaslona (`navigator.standalone`). |
| Grana | **`e2e-suite`**, lokalna, bez pusha. Agenti na `e2e/<sekcija>`, ja spajam. Na `master` ide kad cijeli suite prođe `--repeat-each=5`. |

## 2. Kako se ne gaze

| Sekcija | Agent radi u | Port | Baza | Testovi |
| --- | --- | --- | --- | --- |
| baza | `.claude/worktrees/e2e-suite` | 4000 | `treseta_e2e_smoke` | `tests/smoke/baza.spec.ts` |
| A | `.claude/worktrees/e2e-a` | 4010 | `treseta_e2e_a` | `tests/smoke/a-*` |
| B | `.claude/worktrees/e2e-b` | 4011 | `treseta_e2e_b` | `tests/dozvole/b-*` |
| C1 … C9 | `.claude/worktrees/e2e-c1` … `e2e-c9` | 4021 … 4029 | `treseta_e2e_c1` … `_c9` | `tests/<područje>/cN-*` |
| K | `.claude/worktrees/e2e-k` | 4031 | `treseta_e2e_k` | `tests/liga/k-*` |
| L | `.claude/worktrees/e2e-l` | 4032 | `treseta_e2e_l` | `tests/liga/l-*` |

Ostala pravila (svoji fileovi, generator se ne dira, bug ostaje `test.fail()` u izvještaju) su ista kao u Beli i
stoje u [`e2e/sekcije/README.md`](e2e/sekcije/README.md). Uz bug agent kaže je li kod zajednički (popravak ide u
Belu) ili Tresetin.

## 3. Faze

| Faza | Što | Gotovo kad |
| --- | --- | --- |
| **S−1 Generator** (ja) | Tresetin `e2e/seed/`, `seed:e2e`, `seed:verify` | ~~`seed:verify` zelen~~ (15.11.: 17 pravila, jedno je poznat bug aplikacije, dolje) |
| **S0 Baza** (ja) | Belina baza s Tresetinim portovima, bazama, tajnama i install sheetom; briefovi (i K, L) | ~~smoke zelen `--repeat-each=5`~~ (15.11.: 15/15); `tsc -p e2e` čist |
| **S1 Pilot C1** (1 agent) | ligaška večer s Tresetinim upisom igre; `helpers/scorepad.ts` | ~~C1 zelen `--repeat-each=5`~~ (15.11.: 30/30, spojen) |
| **S2 Ostali** (12 agenata, u dva vala) | val 1: C2–C5, K, L (Tresetini briefovi); val 2: A, B, C6–C9, od Belinih predanih sekcija | svaka sekcija zelena `--repeat-each=5`, izvještaj predan (16.11.: val 1 spojen; C6, C8, C9 spojeni; A, B, C7 čekaju Belu) |
| **S3 Spajanje** (ja) | spojim grane, `FLOWS.md`, issuei za nađene bugove, cijeli suite `--repeat-each=5` | suite zelen (osim `test.fail` s issueom) |
| **S4 Master** | merge `e2e-suite` → `master`; noćni run (`rutine/treseta-e2e-nightly.md`) ga počne vrtjeti | na masteru |

## 4. Sekcije

Briefovi su u [`e2e/sekcije/`](e2e/sekcije/README.md). Belinih 11 su Belini, s Tresetinom igrom (C1: Zvanja, 11-split,
Custom i "s ovim dosta", izjednačeno → do 51; C3: nedolazak 5 : 0 i stol "na prolaz"; C4: 45 minuta; C5: pobjednik po
igrama i "s ovim dosta"), a K i L su novi.

## 5. Što su generator i sekcije našli

Bugovi aplikacije (testovi su `test.fail` s `// BUG:` dok popravak ne stigne):

| Bug | Gdje | Kod | Stanje |
| --- | --- | --- | --- |
| Bye bez pobjednika: `createByeMatches` (`round/insertPairRounds.ts`) piše bye meč bez `winner_side`, a Treseta taj stupac čita kao "meč bez pobjednika" | generator (`seed:verify` `!`), C3 | Tresetin | popravljeno na masteru (`6536637b`, `19361b22` s backfillom), spojeno u `e2e-suite` 16.11. |
| Drugi brzi dodir na Završi meč otvara upis igre (Bela #74) | C1 | zajednički | Belin `e721909`, dolazi sa syncom |
| Ista igra s dva telefona upiše se dvaput (Bela #57) | C2 | zajednički | Belin `3efe0f4`, na `bela-sync` kao `a03b1ade`; čeka merge na master |
| Poslije ponoći Početna ispusti večerašnju kartu (Tu smo, Pauza) za sljedeću večer, a Burza večerašnje zamjene broji kao istekle: "danas" po kalendaru (`mySchedule`, `burza.ts`, `BurzaForms`, Moji oglasi) | L, C8 | zajednički | Belin `1f7d51e`, već na `bela-sync` |
| Gost na Burzi vidi broj svakog oglasa (`/api/burza`, stranica oglasa; Bela #11) | C8 | zajednički | Belin `3eb80df`, već na `bela-sync` |
| Korisnička imena su privatna: Moje ekipe i stranica ekipe pokazuju ime, suigrač ne vidi `@username` (Belin DECISIONS #88) | C9 | zajednički | Belin `5defdb6`, već na `bela-sync` |
| Gost s Objavi → Prijava: prijava unutar 30 s ostavi ga na Prijavi s vrtuljkom; Nextov router cache još drži preusmjeravanje middlewarea, a `login/page.tsx` radi `router.replace(next)` | C8 | zajednički (i Belin `development`) | otvoreno, za Belin issue |
| Moje ekipe pokazuje staru sliku dok se stranica ne učita ponovo (`useMyTeams` se ne osvježi nakon Spremi) | C9 | zajednički (Belin C9 ga ima kao `test.fail`) | otvoreno, za Belin issue |
| Nakon što admin vrati meč u igru, njegov mobitel ne pita "s ovim dosta" na 41 : 41 (`reopenMatch` kopira igre s novim id-jevima, a TablePhone traži stari) | C5 | Tresetin (`467ea599`) | otvoreno |
| Spremi odbijen jer je vrijeme isteklo ostavlja mobitel na koraku Igra; u Beli vraća na stol, koji je prešao na Meč 2 (Belin DECISIONS #83) | C4 | Tresetin (`ScorePage`, `handFlow`; port `a0686e1` bez provjere `matchClosed`) | otvoreno |
| Rate limiter: prozor se pomiče sa svakim zahtjevom, pa se nikad ne isprazni | fixtures (svaki kontekst svoj `X-Forwarded-For`) | zajednički | komentar na Belin issue #4 |

Pitanje: adminov mobitel ne može dopisati igru završenom meču, iako upozorenje "Meč ostaje bez pobjednika?" to
predlaže (C5). Čeka odluku.

Suite i generator (S3):
- ~~`fixtures.as()` prijavi kroz API, a `refreshUser` zna isprazniti ploču kad je `/api/auth/me` spor (C2)~~: `as()`
  sprema korisnika kao Prijava (16.11.).
- ~~Generatorov nedolazak u Kolu 2 turnira uživo odgovori se u 12. minuti, pa svijet ima preskočen stol~~: odgovori se u
  7. minuti, a kolo se zatim pomakne na 12 (16.11.).
- `/api/cron/tick` zatvara svaki istekli meč u bazi; `c4.ts` ga zove samo za svoj stol, ostali neka rade isto.

## 6. Rizici

Kao u Beli, plus: **dvije suite odjednom** na istom laptopu i istom Podman Postgresu (Belinih 11 servera i Tresetinih
13). Portovi i baze se ne sudaraju, ali laptop nosi dvostruko. Ako je tijesno, Tresetin S2 ide u dva vala.
