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
| **S1 Pilot C1** (1 agent) | ligaška večer s Tresetinim upisom igre; `helpers/scorepad.ts` | C1 zelen `--repeat-each=5`; pregledam pomoćnike i spojim |
| **S2 Ostali** (12 agenata paralelno) | A, B, C2–C9, K, L | svaka sekcija zelena `--repeat-each=5`, izvještaj predan |
| **S3 Spajanje** (ja) | spojim grane, `FLOWS.md`, issuei za nađene bugove, cijeli suite `--repeat-each=5` | suite zelen (osim `test.fail` s issueom) |
| **S4 Master** | merge `e2e-suite` → `master`; noćni run (`rutine/treseta-e2e-nightly.md`) ga počne vrtjeti | na masteru |

## 4. Sekcije

Briefovi su u [`e2e/sekcije/`](e2e/sekcije/README.md). Belinih 11 su Belini, s Tresetinom igrom (C1: Zvanja, 11-split,
Custom i "s ovim dosta", izjednačeno → do 51; C3: nedolazak 5 : 0 i stol "na prolaz"; C4: 45 minuta; C5: pobjednik po
igrama i "s ovim dosta"), a K i L su novi.

## 5. Što je generator već našao

- **Bye bez pobjednika.** `createByeMatches` (`_lib/service/round/insertPairRounds.ts`, Tresetina mala izmjena) piše
  bye meč bez `winner_side`, a Treseta taj stupac čita kao "meč bez pobjednika". Migracija `s_ovim_dosta` (14.10.)
  popunila je stare mečeve, pa su od tada novi byevi (liga s neparnim brojem ekipa, turnir) drukčiji od starih.
  `seed:verify` ga javlja kao poznat bug (`!`) i ne staje. Popravak je Tresetin (Bela nema `winner_side`).

## 6. Rizici

Kao u Beli, plus: **dvije suite odjednom** na istom laptopu i istom Podman Postgresu (Belinih 11 servera i Tresetinih
13). Portovi i baze se ne sudaraju, ali laptop nosi dvostruko. Ako je tijesno, Tresetin S2 ide u dva vala.
