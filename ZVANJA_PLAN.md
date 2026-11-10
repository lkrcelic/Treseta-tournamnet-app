# Zvanja in Treseta — the plan

Written 10 Nov 2026, against `master` at `fe9fc19` (Turniri merged), and reviewed against the code the same day.
Reverses decision 3 of [TOURNAMENTS_PLAN.md](TOURNAMENTS_PLAN.md#decisions) ("Zvanja are dropped") and the Zvanja row
of [BELA_SYNC.md · Turniri](BELA_SYNC.md#turniri). Built on branch `zvanja` on 11 Nov 2026, a commit a step (4 and 5 together; the seed has no tables or hands, so step 9 left it as it is). Delete this file once the branch is merged.

## What it is

A hand gets zvanja on top of its 11 points. The entry offers two buttons, **3** and **4**, for each team. Every click
is one zvanje of that value, so 3 clicked twice and 4 once is 3 + 3 + 4 = 10 for that team. It is Bela's Zvanja step
with `[3, 4]` in place of `[20, 50, 100, 150, 200]`.

- **Worth 3:** tri trice, tri dvice, tri asa, and napola (A, 2, 3 of one suit) in špade, kope, bate or dinari.
- **Worth 4:** četiri trice, četiri dvice, četiri asa.
- Zvanja are one player's. Two partners' cards are never added together.
- A card may count in more than one zvanje (the trica špada in both tri trice and napola špade).

A hand's **total** is its points plus its zvanja. Everything that counts the match counts totals: the match score, 41,
the raised target, "s ovim dosta", and the winner when Vrijeme partije runs out. The standings and ratings follow,
because they read the match score and the winner.

**A tournament is played with or without zvanja**, as in Bela. Tournament has a **Zvanja: Da / Ne** switch, and every
table of a Kolo takes it at the moment the Kolo is made (`Round.declarations`). A table "bez zvanja" doesn't offer
the Zvanja step, and the server refuses zvanja there. Bela's "bez zvanja" still lets bela (20) through; Treseta's lets
no zvanja through at all. A league's tables always have zvanja.

## Decisions

1. **Zvanja on the phone are their own step, before Igra** (Bela's order: Zvanja → Igra). "Dalje" with nothing clicked
   is a hand without zvanja. A table "bez zvanja" skips the step. The alternative, a zvanja row on the keypad screen,
   saves a tap a hand. It changes only step 6.
2. **The check is exact.** A hand is refused when the cards can't make its zvanja, counting both teams together (see
   [What the cards allow](#what-the-cards-allow)). It catches a mis-click such as 4 × 4. Step 2.
3. **A custom hand has no zvanja**, as Bela's Ručni unos has none. Its typed points are the hand's total, zvanja
   included. Switching to Custom drops zvanja already clicked. "S ovim dosta" stays on custom hands only. Steps 2, 5,
   6 and 7.
4. **Tournaments switch zvanja on or off, as in Bela** (`Tournament.declarations`, `Round.declarations`, default on).
   - The table keeps what the tournament said when its Kolo was made.
   - Changing the switch after the start remakes the next Kolo's draft. The published Kolos keep theirs.
   - Before the start, the change moves into the drafts.
   - This is Bela's rule (`service/tournament/tournaments.ts`), and it is step 8.
5. **Old hands get 0 zvanja.** There is no backfill. Past nights' point differences stay as they were played. Old
   tournaments and tables get `declarations = true`, as Bela's migration does.
6. **Hand rows show totals.** The scoreboard, the admin's board and Pregled stola list each hand's total, as Bela does.
   The zvanja are seen when the hand is opened.

## What the cards allow

Only 12 cards make zvanja (A, 2 and 3 in four suits), and a player holds 10. Every deal was counted (a brute force over
which of the four players holds each of the 12 cards):

- **A team's maximum is 21 points:** 7 zvanja of 3 and none of 4. With any zvanje of 4 the maximum is 19.
- **The pairs (threes, fours) a team can have, 18 in all:**

  | Fours | Threes possible |
  |---|---|
  | 0 | 0–7 |
  | 1 | 0–5 |
  | 2 | 0–2 |
  | 3 | 0 |

- **Both teams together make at most 21.** The 12 cards are shared, so the more one team has, the less the other can
  have. Of the 18 × 18 pairs, only **66** can happen at one deal.
- **A zvanje may go unannounced**, so anything below a possible deal is allowed too. That adds two pairs (1 × 3 against
  5 × 3, either way round) to make **68**, and all 68 are what lies below **22 largest deals**. The code keeps those 22
  (`ZVANJA_DEALS`).
- **No simple rule describes them.** "Each team possible, and their sum possible as one team" is wrong in 34 cases.
  For example, 1 × 4 for one team and 4 × 3 for the other can't happen. So the check is a table, with a test that
  derives it again.

## The data

`Result` and `OngoingResult` each get four columns, `Int @default(0)`:

| Column | Meaning |
|---|---|
| `team1_zvanja3` | team 1's zvanja worth 3 (0–7) |
| `team1_zvanja4` | team 1's zvanja worth 4 (0–3) |
| `team2_zvanja3` | team 2's zvanja worth 3 (0–7) |
| `team2_zvanja4` | team 2's zvanja worth 4 (0–3) |

- Store the counts, not the points: 12 is either 4 × 3 or 3 × 4, and opening a hand has to show the clicks again.
- `team1_game_points` and `team2_game_points` keep meaning the card points (11 together, or a custom hand's typed
  points).
- `OngoingMatch.player_pair*_score` and `Match.player_pair*_score` keep meaning the match score. From now on that is the
  sum of the hands' **totals**.

`Tournament` and `Round` each get `declarations Boolean @default(true)`, with Bela's comments: "Zvanja: false = bez
zvanja" and "false (a tournament bez zvanja): no zvanja are entered".

## The steps

Each step is a commit that leaves the app working, in the order below.

### 1. Schema and migration

| File | Change |
|---|---|
| `prisma/schema.prisma` | The four columns on `Result` and `OngoingResult`, with a comment: "zvanja worth 3 / 4 entered for the team on this hand; a custom hand has none". `declarations` on `Tournament` and `Round`, placed where Bela has them (after `matches_per_round`). |
| `prisma/migrations/20261111120000_zvanja/migration.sql` (new) | On `"Result"` and `"OngoingResult"`: `ADD COLUMN … INTEGER NOT NULL DEFAULT 0` for the four counts. CHECKs per table: each team's pair is one of the 18 (`zvanja4` 0–3, `zvanja3` up to 7, 5, 2 or 0 by `zvanja4`), and `custom = false OR all four = 0`. On `"Tournament"` and `"Round"`: `ADD COLUMN "declarations" BOOLEAN NOT NULL DEFAULT true`, as in Bela's `20261026120000_tournaments` (lines 16 and 66). The joint check and "bez zvanja" stay in the code. |

The app is unchanged after this step: every hand has 0 zvanja, and every table has `declarations = true`.

### 2. The rules (`src/app/_lib/game/scoring.ts`)

| Change | Details |
|---|---|
| `ZVANJA_VALUES = [3, 4] as const`, `type Zvanje` | One place for the values. `WizardParts.ZVANJA_VALUES` imports it (step 6). |
| `type ZvanjaCounts = {3: number; 4: number}` and `NO_ZVANJA` | A team's zvanja on one hand. |
| `zvanjaPoints(c)` | `3 * c[3] + 4 * c[4]`. |
| `ZVANJA_DEALS` | The 22 largest deals `[t1threes, t1fours, t2threes, t2fours]`, as a literal, with a comment on how they were derived. A hand is allowed when its four counts are at most one of them. |
| `zvanjaError(z1, z2, {custom, declarations})` | `null`, or: "Zvanja moraju biti cijeli brojevi od 0.", "Ručni unos nema zvanja." (custom with zvanja), "Ovaj turnir se igra bez zvanja." (`declarations` false and any zvanje), "Ekipa ne može imati ta zvanja." (a team's pair not among the 18), "Obje ekipe ne mogu imati ta zvanja u istoj igri." (the pair not below any of the 22). `canAddZvanje` says whether one more click is still possible. It is pure, and used by the phone, the desktop, the admin and the server alike. |
| `PlayedHand` | Gets `team1_zvanja3`, `team1_zvanja4`, `team2_zvanja3` and `team2_zvanja4`, **required**, so every caller that forgets to select them fails to compile instead of quietly dropping zvanja. |
| `handTotals(h): [number, number]` | Points plus zvanja points. |
| `matchState`, `dostaCallers` | Add `handTotals(hand)` in place of `team*_game_points`. |
| `handError` | Unchanged: it is about the card points (11, or the custom limit). |

### 3. Validation, interfaces and server writes

| File | Change |
|---|---|
| `src/app/_interfaces/result.ts` | `ResultCreateRequestValidation`: the four counts, `z.number().int().min(0).optional()`, with **no default**. A new hand without them is 0. An edit without them keeps the stored counts, so a phone still on the old page that corrects a hand's points doesn't wipe its zvanja. `PartialResultResponseValidation`: the four counts. `_interfaces/match.ts` needs nothing: its `results` are `PartialResultResponseValidation`. |
| `src/app/_interfaces/round.ts` | `RoundResponseValidation` gets `declarations: z.boolean().optional()` (Bela line 24). Without it, zod strips the column from the round the phone loads into `RoundStore`. |
| `src/app/_lib/validation/validateResult.ts` | `normalizeResult` also throws `zvanjaError(…, {custom, declarations: true})`. The table's own `declarations` is checked where the round is known (below). |
| `src/app/_lib/helpers/databaseHelpers.ts` | `transformResult` and `ResultTransformed`: the four counts, `?? 0`. `MatchAllIncluded.results` and `transformMatch`'s `results.create` copy them, so a finished match keeps its zvanja. |
| `src/app/_lib/service/ongoingResult/create.ts` | The locking `SELECT … FROM "OngoingMatch"` joins `"Round"` for `r.declarations`, as Bela's `ongoingBelaResult/create.ts` (lines 28–42), and the hand is refused when the table is "bez zvanja" and has zvanja. The score increment is `handTotals(result)` instead of `team*_game_points`. |
| `src/app/_lib/service/ongoingResult/update.ts` | The raw `SELECT … FOR UPDATE` also reads the four counts. Missing counts in the request take the stored ones. The table's `declarations` is read as in Bela's `ongoingBelaResult/update.ts` (lines 27–29). The `update` writes the counts, and the increment is the difference of totals. |
| `src/app/_lib/service/ongoingResult/matchState.ts` | `ongoingMatchState`'s `select` adds the four counts (the compiler asks for it after step 2). |
| `src/app/_lib/service/ongoingMatch/getOneWithResults.ts` | The `select` adds the four counts. |
| `src/app/_lib/service/round/getById.ts` | Nothing: it reads full rows (`declarations`, and the counts on the ongoing match's results). `round.ts` above lets them through. |
| `src/app/_lib/service/match/finishOngoingMatch.ts` | Nothing beyond `transformMatch`. It reads full rows, so `matchState` already gets the counts. The stored scores are already totals. |
| `src/app/_lib/service/match/timeLimit.ts` | Nothing: the winner on time comes from the match score, now totals. |
| `src/app/_lib/service/round/insertPairRounds.ts` | Nothing: a bye's matches have no hands. |
| `src/app/_interfaces/adminHand.ts` | `AdminHandValidation` adds `zvanja1` and `zvanja2`: `{3: int 0–7, 4: int 0–3}`, optional, default 0. `PadHand` keeps `total1` and `total2` as **totals** and adds `points1`, `points2`, `zvanja1` and `zvanja2`, for opening a hand on the keypad. `TablePad` adds `declarations: boolean` (Bela line 67). |
| `src/app/_lib/service/admin/hands.ts` | `getTablePad` returns `declarations: round.declarations`. `assertEditableTable` also selects and returns `declarations`, and `addHand` and `updateHand` refuse zvanja on a table "bez zvanja", as Bela's `assertDeclarations` does (lines 164–176, 268–317). `adminHandToResult` maps `zvanja1` and `zvanja2` to the four columns. `toPadHand`: `total = handTotals`, plus the new fields. `updateHand` (finished) writes the counts. `deleteHand` (ongoing): the raw `SELECT` reads the counts, and the decrement is by totals. `recountFinishedMatch` already replays full rows. |
| `src/app/_lib/service/admin/tables.ts` | Re-pairing a Kolo's tables copies `declarations` along with `matches_per_round` (lines 33, 57 and 238–252; Bela lines 35, 60 and 243–258). |
| `src/app/_lib/tableOverview.ts` | Nothing: it passes `total1` and `total2`, which are now totals. |

When this step is done the server stores zvanja, but no screen enters them yet.

### 4. The players' hand store and saving

| File | Change |
|---|---|
| `src/app/_store/game/resultStore.ts` | `resultData` gets `zvanja: {team1: ZvanjaCounts; team2: ZvanjaCounts}`. `addZvanje(v)` adds to the active team, `clearZvanja()` clears the active team. `setResultData` loads the counts from a saved hand. `toggleCustom` drops the zvanja (decision 3). `resetResult` clears them. The persisted store (`name: "result-store"`, no `version` today) gets `version: 1` and a `migrate` that adds empty zvanja, because a phone's stored entry from before has no `zvanja`. |
| `src/app/ongoing-match/ui/handFlow.ts` | `saveHand` sends the four counts. `callDosta` sends 0 (a custom hand). |

### 5. The rules shared by the entry screens

| File | Change |
|---|---|
| `src/app/ongoing-match/ui/WizardParts.tsx` | `ZVANJA_VALUES` from `scoring.ts`. `ZvanjaButtons` is already there and unused: it gets the labels "3" and "4", the aria label "Zvanje 3, upisano 2", and Obriši zvanja. A 3 or 4 that `zvanjaError` would refuse after one more click is disabled, so an impossible hand can't be clicked together (Bela disables bela the same way, `zvanjeBlocked`). Bela's `_lib/bela/declarations.ts` (`zvanjaChoices`, `zvanjeLabel`) doesn't come: "bez zvanja" here has no buttons at all. |

### 6. The players' entry (phone and desktop)

| File | Change |
|---|---|
| `src/app/ongoing-match/[matchId]/ongoing-result/ui/pages/ZvanjaPage.tsx` (new) | From Bela's `AnnouncementPage.tsx`: `ZvanjaButtons` for the team picked in the header, and `ActionPair` with Natrag (back to the board, discarding the hand, as `ScorePage.back` does) and Dalje (to `score`). |
| `…/ongoing-result/new/zvanja/page.tsx`, `…/ongoing-result/[resultId]/zvanja/page.tsx` (new) | `ZvanjaPage` with `actionType` CREATE or UPDATE, like the two `score/page.tsx`. A table "bez zvanja" (`useRoundStore` → `roundData.declarations === false`) or a custom hand is sent on to `score` with `replace`. |
| `…/ongoing-result/ui/pages/ScorePage.tsx` | `invalid` also checks `zvanjaError`. Natrag goes back to `zvanja`, unless the table is "bez zvanja" or the hand is custom, in which case it goes to the board as today. The Custom key drops zvanja (through the store). |
| `…/ongoing-result/ui/WizardHeader.tsx` | The team boxes follow the step, as Bela's do: on Zvanja they read "Zvanja · Ekipa" and the team's zvanja points, and on Igra "Igra · Ekipa" and its points. The step comes from the pathname. |
| `…/ongoing-result/layout.tsx` | The comment: two steps, Zvanja (not at a table "bez zvanja") and Igra. |
| `src/app/ongoing-match/[matchId]/page.tsx` | Nova igra and the prefetch go to `ongoing-result/new/zvanja`, or to `new/score` at a table "bez zvanja". Opening a hand goes to `…/{id}/zvanja`, or `…/{id}/score` for a custom hand or a table "bez zvanja". `hands` (`PlayedHand`) and `rows` use the counts and `handTotals`. `callDosta` passes the last hand's points. |
| `src/app/ongoing-match/ui/HandEntryPanel.tsx` (desktop) | Bela's layout: each team box shows Zvanja and Igra (`Stat`), and a row of 3, 4 and Obriši zvanja for the active team sits above the keypad. The row is hidden at a table "bez zvanja", which is `roundData.declarations`, as in Bela's line 50. `canSave` adds `zvanjaError`. Keys: digits type points as now. Zvanja are clicked only, no keys, so a digit is never ambiguous. |
| `src/app/ongoing-match/ui/RoundResultCards.tsx`, `BoardParts.tsx` | Nothing: `HandRow` gets totals from `page.tsx`. |

### 7. The admin's scorepad (phone and desktop)

| File | Change |
|---|---|
| `src/app/_lib/ui/adminEntry.ts` | Bela's shape: `EntryState.zvanja: {1: ZvanjaCounts; 2: ZvanjaCounts}`, `addZvanje`, `clearZvanja` (active team), `zvanjaPoints`. `switchMode` to `man` drops zvanja. `canSave(s, declarations)` adds `zvanjaError`. `toAdminHand` sends `zvanja1` and `zvanja2`. `fromPadHand` loads `points1`/`points2` and the zvanja, where it now reads `total1`/`total2`. |
| `src/app/_ui/admin/TablePhone.tsx` | `Step`: korak `2` = Zvanja, `3` = Igra (Bela's numbers; `1`, Bela's trump caller and Treseta's keypad today, is opened as `2`). The board's Nova igra and "correct on the keypad" open korak 2, or 3 when `pad.declarations` is false. Korak 2 is Bela's `TeamValueBoxes label="Zvanja"` with `ZvanjaButtons`, and `ActionPair` (Natrag, Dalje → 3). Korak 3 is today's keypad, whose Natrag goes to 2, or to the board at a table "bez zvanja". `stepsFromBoard` counts both steps. `playedHands` (line 53) passes the counts, or maps `total1`/`total2` with zero zvanja. The Custom sheet and the "s ovim dosta" update send no zvanja. |
| `src/app/league/[leagueId]/daily-standings/table/AdminEntryPanel.tsx` (desktop) | The same zvanja row as `HandEntryPanel`, on `adminEntry`, with a `declarations` prop (Bela lines 46 and 61). |
| `src/app/league/[leagueId]/daily-standings/table/[roundId]/page.tsx` | `playedHands` (line 30), as in `TablePhone`. Passes `declarations={pad.declarations}` (Bela line 248). |
| `src/app/league/[leagueId]/daily-standings/table/TablePreview.tsx` | Nothing: it shows totals. |

### 8. A tournament with or without zvanja

Bela's code, file for file. Treseta has the same files without `declarations`.

| File | Change (Bela's lines) |
|---|---|
| `src/app/_interfaces/tournament.ts` | `declarations` in the request (`z.boolean()`, 46), in the card (72) and in the view (166). |
| `src/app/_lib/service/tournament/tournaments.ts` | `fields()` reads `declarations` (45). On an edit after the start, a changed switch drops the drafts as a changed Partija po kolu does (107). Before the start, the drafts take the new value (`updateMany`, 120). |
| `src/app/_lib/service/tournament/kola.ts` | The tournament's `select` (Treseta line 44) adds `declarations`, and a Kolo's new tables get `declarations: t.declarations` (Treseta line 133, Bela 134). |
| `src/app/_lib/service/tournament/views.ts` | `declarations: t.declarations` in the views (Treseta lines 157, 238 and 298; Bela 158). |
| `src/app/_lib/tournaments.ts` | `rulesLabel(declarations)` (Treseta line 295, Bela 294): `41 · s ovim dosta · zvanja` or `41 · s ovim dosta · bez zvanja`. |
| `src/app/_ui/tournaments/TournamentForm.tsx` | The `Choice` "Zvanja: Da / Ne" next to Partija po kolu (339), the default `true` (55), and the draft ↔ request mapping (29, 75, 95, 153). |
| `src/app/_ui/tournaments/TournamentParts.tsx` | `tournamentMeta` adds "zvanja" or "bez zvanja" (87–88). |
| `src/app/_ui/tournaments/PlayerParts.tsx` | `rulesLabel(t.declarations)` (248), " · bez zvanja" in the summary (562), and the "bez zvanja" note on a table (684). |
| `src/app/_ui/tournaments/admin/ManageTournamentPhone.tsx`, `StandingsDetailsDesktop.tsx` | The note on editing a started tournament names zvanja again: "Partija po kolu, zvanja i vrijeme partije vrijede za kola koja se tek slažu" (Bela's lines 978 and 156). |

### 9. Rules text and seed

| File | Change |
|---|---|
| League rules | Grep for other "41 · s ovim dosta" lines outside tournaments (Pravila, league pages) and add "· zvanja". |
| `prisma/seed.ts` | A few seeded hands with zvanja, and one seeded tournament "bez zvanja", so a fresh local database shows both. |

### 10. Tests

`npm test`, and `npm run test:db` against the local Postgres in podman (`bela-sync-pg` on :5433):

| Test | What it covers |
|---|---|
| `scoring.test.ts` | `zvanjaPoints`, `handTotals`. `matchState` reaching 41 with zvanja, a tie made by zvanja raising the target, "s ovim dosta" reached with a hand's zvanja. `zvanjaError`: 7 × 3 allowed, 4 × 4, 3 × 4 + 3 and 8 × 3 refused for one team, 1 × 4 against 4 × 3 refused, custom with zvanja refused, any zvanje refused with `declarations` false. |
| `zvanjaDeals.test.ts` (new) | Derives the deals again, compares their largest with `ZVANJA_DEALS`, and checks `zvanjaError` for every count from 0 to 8 threes and 0 to 4 fours per team (68 allowed). The derivation gives each of the 12 cards one of 4 players (4¹² ≈ 16.8 M deals, at most 10 cards each), with bitmasks per player, so it takes seconds. |
| `serverHand.test.ts` | `normalizeResult` with zvanja: allowed, refused, missing (0 on create). |
| `adminEntry.test.ts` | `addZvanje`, `clearZvanja`, `switchMode` dropping zvanja, `canSave` at a table "bez zvanja", the `toAdminHand` / `fromPadHand` round trip. |
| `handEntryStores.test.ts` | The store's zvanja, `toggleCustom`, `setResultData`, the version-0 → 1 migration. |
| `handRows.test.ts`, `scoreboardMatch.test.ts`, `tableOverview.test.ts` | Rows and totals with zvanja. |
| `finishedMatchEdit.test.ts` | Correcting a finished match's zvanja recounts its score and winner. `lostWinnerError` with zvanja. |
| `tournaments.test.ts` | Bela's `declarations` cases: the form round trip, the switch dropping drafts after the start and moving into them before, `rulesLabel` and `tournamentMeta`. |
| `db/*` | Create, update, delete and finish keep the match score equal to the sum of totals. An edit without counts keeps them. A Kolo's tables take the tournament's switch. A table "bez zvanja" refuses zvanja from the player and from the admin. The CHECKs refuse a custom hand with zvanja and 8 × 3. |

### 11. Docs

| File | Change |
|---|---|
| `TOURNAMENTS_PLAN.md` | Decision 3 gets a line: "Reversed on 11 Nov 2026: zvanja 3 and 4 came in, with Bela's Zvanja switch for a tournament; see ZVANJA_PLAN.md". |
| `BELA_SYNC.md` | The schema row: `Result` and `OngoingResult` carry `team*_zvanja3/4`, `Tournament.declarations` and `Round.declarations` are Bela's now, and Bela's announcement tables still don't come. The "A match" and "Zvanja" rows under Turniri: Treseta's zvanja are 3 and 4, per team per hand, and "bez zvanja" means none (Bela's lets bela through). The `HandEntryPanel`, `TablePhone` and `handFlow` rows: with a Zvanja step of 3 and 4. New rows for `WizardParts.tsx` (`ZVANJA_VALUES` from `scoring.ts`), `adminEntry.ts`, `resultStore.ts`, the `zvanja` pages, `ZvanjaPage.tsx` (Bela's `AnnouncementPage`), and `_lib/bela/declarations.ts` (not copied). The tournament files listed in step 8 lose their "without declarations" difference. A log line. |
| `ProcessFlow.md` | 2.1.2 Upis zvanja: per team, 3 and 4, clicked as many times as there are zvanja, and skipped at a tournament "bez zvanja". |
| `ZVANJA_PLAN.md` | Deleted once the work lands, as `TOURNAMENTS_PLAN.md` will be. |

## Checks before it ships

- `npx prisma migrate dev` on the local database, then `npm test`, `npm run test:db`, `npx tsc --noEmit` and
  `npm run lint`.
- In the browser, on the seeded database:
  - A player enters a hand with zvanja on the phone, then edits it.
  - A custom hand drops the zvanja.
  - 4 × 4 can't be clicked, and the server refuses it when sent.
  - A match is won on zvanja at 41.
  - The admin corrects a finished match's zvanja on TablePhone and on the desktop panel, and the standings move with
    it.
  - A tournament "bez zvanja": the form saves it, its Kolo's tables skip the Zvanja step on the phone and the admin's
    phone, the desktop has no zvanja row, Pravila igre reads "bez zvanja", and a hand with zvanja sent to the API is
    refused.
- The Vercel Preview migrates its own Neon branch. Production gets the migration with the deploy. The columns have
  defaults, so the deploy needs no downtime: old hands read as 0 zvanja, and old tournaments and tables as with zvanja.
