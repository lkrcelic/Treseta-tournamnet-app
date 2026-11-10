# Turniri in Treseta — the plan

Written 10 Nov 2026, against Bela `development` at `d2a0b98` and Treseta `master` at `f379023` (synced with Bela up
to `a0686e1`).

Treseta gets Bela's one-day tournaments. This reverses the decisions of 26 Oct 2026 (no tournaments), 30 Oct 2026 (no
Vrijeme partije, bans stay with the tournaments) and the part of 7 Nov 2026 that kept the organizer role out —
[BELA_SYNC.md · Bela's tournaments](BELA_SYNC.md#belas-tournaments) is replaced by this file and, once the work lands,
deleted.

A tournament is one day, not a season: an admin or an organizer makes it with a date, Okupljanje and Početak, a place,
Broj kola, Partija po kolu, a team limit, Kotizacija, prizes, a rules link and a phone. Teams sign up themselves,
confirm with **Tu smo**, and are paired Kolo by Kolo on the standings so far. The day runs on a clock: sign-ups close
at the start time, unconfirmed teams go inactive, the waiting list moves up, a table nobody sits at is asked "Jesu li
… za stolom?" after 3 minutes (answerable from 5, skipped at 8), and matches end on Vrijeme partije as well as on
points.

## Decisions

Settled 10 Nov 2026:

1. **Vrijeme partije comes over whole**, for the league's matches as well as the tournaments'. The default is **45
   minutes** (Bela's is 35). **Each time the target goes up, the match gets 5 more minutes** — Treseta's own rule,
   specified under [Vrijeme partije in Treseta](#vrijeme-partije-in-treseta).
2. **The no-show score is the bye's**: the team that answered wins each match of the table `BYE_MATCH_POINTS : 0`
   (**5 : 0**) at threshold 41, exactly as a Slobodna runda is scored in `_lib/service/round/insertPairRounds.ts`.
   Bela's `NO_SHOW_SCORE = [1001, 700]` does not come.
3. **Zvanja are dropped.** No `Round.declarations`, no `Tournament.declarations`, no Zvanja switch in Podaci, no
   `declarationsError` in `validateResult`, no "bez zvanja" anywhere. Pravila igre reads Treseta's rules, not
   "1001 · zvanja".
4. **Partija po kolu comes over**: a table plays 1 or 2 matches (`Round.matches_per_round`,
   `Tournament.matches_per_round`), where Treseta now always plays 2.
5. **Zabrana prijava comes over** — the model, the services, the admin's routes and `BanSection` on a player's and a
   team's page, including the automatic ban for a no-show in Kolo 1. Whether bans also keep teams out of league
   nights (Bela's `de2001c`) stays out of this work, as it is today.
6. **The organizer role comes over**: `RoleEnum.ORGANIZER`, `_lib/auth/**` (the role→capability map, `requireCan`,
   ownership of a tournament by `Tournament.created_by`), the Rola picker in place of the Admin switch, and the
   role-aware phone bottom bar.

Two small calls left, neither of which blocks the work:

- **Gost i poziv** (`3b85bfa` and its follow-ups) stays out for now, as decided on 7 Nov — Treseta's league stays
  public without an account. Only `_ui/tournaments/PlayerFrame.tsx` comes, because `PlayerParts.tsx` imports it; it is
  28 lines and carries nothing of the guest's Početna. Revisit after this lands.
- **Conference dots in a tournament.** Treseta's shared team chips draw a conference dot (`TeamLabel`) where Bela
  draws `TeamChipBadge`. A tournament has no conferences, so the tournament screens pass no conference and draw no
  dot. If a team's league conference should show there too, it is a later change in one place.

## What comes over

~13 000 lines over ~110 files Treseta does not have, plus the tournament code to put back into ~40 shared files
(BELA_SYNC.md's tables list those file by file, which is the checklist for step 6).

| Part | Files | Lines |
|---|---|---|
| `_ui/tournaments/**` — 11 screens + `admin/` (11 more) | 22 | 6 712 |
| `_lib/service/tournament/**` — `attendance`, `attention`, `clock`, `day`, `entries`, `kola`, `load`, `lock`, `routes`, `tournaments`, `views` | 11 | 2 219 |
| `api/admin/tournaments/**` | 12 | 378 |
| `api/tournaments/**` | 7 | 155 |
| `turniri/**` (9 pages: popis, novi, `[id]`, ekipe, poredak, stol, upravljanje, zavrseni) | 9 | 116 |
| `_interfaces/tournament.ts`, `_fetchers/tournament/`, `_hooks/useTournaments.ts` | ~6 | ~560 |
| `_lib/tournaments.ts`, `tournamentEntries.ts`, `tournamentDay.ts`, `tableState.ts`, `matching/tournamentPairing.ts`, `ui/tableScope.ts` | 6 | 718 |
| Vrijeme partije: `_lib/gameTime.ts`, `_lib/service/match/timeLimit.ts`, `ongoing-match/ui/MatchClock.tsx` | 3 | 244 |
| Bans: `_lib/bans.ts`, `_lib/service/bans/`, `api/admin/bans/**`, `_ui/profiles/BanSection.tsx` | ~6 | ~400 |
| Roles: `_lib/auth/` (`roles`, `permissions`, `ownership`, `forbidden`) | 4 | 150 |
| The clock's backup: `api/cron/tick/`, `_lib/cron.ts` | 2 | 33 |
| Attendance and player search: `api/rounds/[id]/attendance/`, `api/players/search/`, `_lib/service/players/search.ts` | ~3 | ~200 |
| Tests: `tournaments`, `tournamentDay`, `tableScope`, `lineupPass`, `gameTime`, `cron` | 6 | 770 |

The transfer is lighter than the number suggests: nothing under `_ui/tournaments`, `_lib/service/tournament`,
`_lib/tournaments.ts` or the routes imports `_lib/bela/` or `_store/bela/` — the hands go through the shared scorepad,
of which Treseta already has its own version — and the standings maths is already here, carried in
`_lib/leagueOrder.ts`.

## Database

Three migrations, in this order. Bela's SQL (174 lines over its seven tournament migrations) is the source; the
differences are listed under each.

**1. `20261110120000_tournaments`** — from Bela's `20261026120000_tournaments`, `20261030120000_turniri_v1` (the
tournament half) and `20261031120000_tournament_auto_publish`:

- `Tournament` (without `declarations`; `game_minutes` default **45**), `TournamentPrize`, `TournamentTeam`,
  `TournamentRound`, and the enums `TournamentEntryStatus`, `TournamentExclusion`, `RoundAttendance`. Treseta never
  had Bela's old unused `Tournament` tables, so these are created, where Bela's migration alters them.
- **No `TeamScore.tournament_id`** (decided while writing the migration, 10 Nov 2026). Bela has the column and its
  either-or CHECK, but nothing in Bela's tournament code writes `TeamScore`: a tournament's standings are counted
  from its tables. Treseta's `TeamScore` stays league-only, which also keeps a CHECK off a live table whose rows this
  work has no reason to touch. `_lib/service/league/getStandings.ts` therefore keeps its difference from Bela (no
  `tournament_id: null` filter), as it has since the transition.
- `Round.matches_per_round` (default 2, CHECK 1–2) and `Round.attendance`, `attendance_team_id`, `attendance_by`,
  `attendance_at` with their CHECKs. **No `Round.declarations`.**
- Bela's `Tournament_started_check` as `5ee98ec` left it (a started tournament may keep `open_signups` open).

**2. `20261110120100_game_time`** — from the Vrijeme partije half of `20261030120000_turniri_v1` and
`20261107200000_round_game_minutes`:

- `League.game_minutes` default **45**, CHECK 5–180.
- `OngoingMatch.started_at`, `OngoingMatch.ends_at`, `Match.time_expired`.
- `Round.game_minutes` (nullable, CHECK 5–180): the minutes an admin chose for one table in Otključaj partiju.

**3. `20261110120200_bans_and_organizer`** — from `20261030120000_turniri_v1` (the `SignupBan` half) and
`20261107120000_organizer_role`:

- `SignupBan` with its indexes and the CHECK that exactly one of `team_id` / `player_id` is set.
- `ALTER TYPE "RoleEnum" ADD VALUE 'ORGANIZER' AFTER 'ADMIN'`, and `Tournament.created_by` with its FK and index.
- The new enum value is only added here, never used in the same migration — Postgres refuses a value used in the
  transaction that added it.

Production has none of these tables, so every migration is additive and `prisma migrate deploy` on production is
safe. `prisma/seed.ts` grows a tournament with a few signed-up teams for the click-through; Bela's `seedHelpers.ts`
stays out, as it is today.

## Vrijeme partije in Treseta

The only genuinely new code in the whole transfer. Bela's `_lib/gameTime.ts` comes over with two changes:

```ts
export const GAME_MINUTES_DEFAULT = 45;   // Bela: 35
export const TARGET_RAISE_MINUTES = 5;    // Treseta only: one raise of the target, five more minutes
```

The rule: a match's deadline is its start plus its minutes, plus five minutes for every raise of the target. Treseta
raises the target by `TARGET_RAISE` (10) each time the teams are level at or above it (41 → 51 → 61 …,
`matchState` in `_lib/game/scoring.ts`), so a match that goes to 51 lasts 50 minutes, one that goes to 61 lasts 55.

```ts
export function matchDeadline(startedAt: Date, minutes: number, raises = 0): Date {
  return new Date(startedAt.getTime() + (minutes + raises * TARGET_RAISE_MINUTES) * 60_000);
}
```

`raises` is never stored: it is `(state.target - threshold) / TARGET_RAISE` from the hands the match already has, so
`ends_at` is **recomputed on every hand saved, corrected or deleted** and an edit of an old hand can only move the
deadline to where the hands say it belongs. `OngoingMatch.ends_at` keeps the value for the clock and for the readers
that close a match nobody is finishing (`expireDueMatches`, the pages, `/api/cron/tick`).

Where the time rule and Treseta's rules meet, at the moment the time runs out:

| The score then | What happens |
|---|---|
| Not level | The match ends at once, the team with more points wins it, `Match.time_expired = true`. A hand being entered is not taken (`handTiming` → `too_late`) |
| Level, below the target | One more hand is played and the match ends after it (`handTiming` → `extra_hand`, `closesAfterHand`); still level after it, one more again |
| Level, at or above the target | The target goes up by 10 and the deadline with it, by 5 minutes — the match plays on under the new deadline, and the extra-hand rule does not apply |

The rest comes as Bela has it: `GAME_MINUTES_MIN` 5, `GAME_MINUTES_MAX` 180, `TIME_WARNING_MS` five minutes ("Još
5:00 do kraja partije" and the red timer), `timeWinner`, `clockLabel`, `MatchClock.tsx` on the scorepad,
`gameMinutesOf` reading the table's minutes before its tournament's and its league's, and Otključaj partiju choosing
new minutes for one table.

Vrijeme partije on a league night means Nova liga and Postavke lige get the field on both screens
(`league/new/page.tsx`, `league/[leagueId]/manage/LeagueDetailsView.tsx`, `_ui/admin/NewLeaguePhone.tsx`,
`_ui/admin/LeaguePhone.tsx`), and a league match can now end by time — the first change this work makes to a Treseta
league night, and the one to watch on the first night after it deploys.

`/api/cron/tick` needs `CRON_SECRET` in the Vercel project and a scheduler calling it every minute (Vercel Cron in
`vercel.json`, which has none today, or a pinger such as cron-job.org). Without it the clock still runs whenever
anyone reads a tournament page or a scorepad — the tick is only the backup for the minutes nobody has the app open.

## Work order

One branch off `master` (`turniri`), which the nightly sync leaves alone — it works on `bela-sync`. The steps are a
reviewable order inside one branch, not separate merges: a half-transferred tournament is not usable.

1. ~~**Schema and migrations.**~~ Done 10 Nov 2026 on the branch `turniri`: the three migrations above and
   `schema.prisma`'s five new models, applied to a fresh local database with no drift, every new CHECK probed, and
   the unit tests, the db tests, ESLint, `tsc` and `next build` green. Nothing else changed yet.
2. ~~**Roles.**~~ Done 10 Nov 2026: `_lib/auth/**` (`roles`, `permissions`, `ownership`, `forbidden`),
   `RoleEnum.ORGANIZER`, `requireCan` beside `requireAdmin`, `ForbiddenError` → 403 in `errorResponse` and
   `lookupErrorResponse`, `useCan` / `useManages` / `useRole` / `useManagePhone(cap)` in place of `useIsAdmin` and
   `useAdminPhone` (both files gone), `can` on `/api/auth/me` and in the auth store, the capability on every menu item
   and every tab of the phone's bar, the Rola picker on both profile screens, and `RoleTag` beside the name.
   `refuseUnlessMine` / `refuseUnlessMyTable` / `refuseUnlessMyHand` wait for the tournament routes (steps 5–6), as
   does moving `api/admin/tables/**` and `api/admin/hands/**` to `requireCan`: they are league-only until a table can
   belong to a tournament. The one capability without a screen yet is `ban.manage.all` (step 5).
3. ~~**Vrijeme partije.**~~ Done 10 Nov 2026: `_lib/gameTime.ts` (45 minutes, `TARGET_RAISE_MINUTES`, `targetRaises`),
   `_lib/service/match/timeLimit.ts` (`gameMinutesOf`, `matchClock`, `syncDeadline`, `closeByTime`,
   `expireDueMatches`), the clock on both match services, `byTime` and `time_expired` in `finishOngoingMatch.ts`, the
   hand's timing and the deadline in `ongoingResult/create.ts` / `update.ts` and the admin's `hands.ts`, the league's
   `game_minutes` through `_interfaces/league.ts`, `service/league/leagues.ts`, `_hooks/useLeagues.ts` and the four
   screens, `MatchClock.tsx` on the scorepad, and `_lib/cron.ts` with `api/cron/tick/`, which for now closes the
   matches whose time is up and takes the tournament day in step 5. The admin's scorepad also had to read a finished
   match's stored `winner_side` instead of replaying its hands, or a match the time decided showed no winner.
   `gameMinutesOf` reads the table's minutes and its league's; the tournament's line joins it in step 5, and Otključaj
   partiju (the table's own minutes) comes with the tournament screens.
4. ~~**Tournament logic and data access.**~~ Done 10 Nov 2026: `_lib/tournaments.ts`, `tournamentEntries.ts`,
   `tournamentDay.ts` (`NO_SHOW_SCORE` → `[BYE_MATCH_POINTS, 0]` at threshold 41, written as a Match with its
   `winner_side`), `tableState.ts`, `matching/tournamentPairing.ts`, `ui/tableScope.ts` (`roundBackBy` moved back out
   of `_lib/ui/adminEntry.ts`), `_interfaces/tournament.ts`, the eleven files of `_lib/service/tournament/`,
   `_lib/bans.ts` and `_lib/service/bans/`, with their tests. `_lib/leagueOrder.ts` imports `rankTeams` from
   `_lib/tournaments.ts` again instead of carrying a copy. The shared files these needed came with them: `Competition`
   in `_lib/service/admin/tables.ts` (a table belongs to a league's night or a tournament's Kolo, with
   `addCompetitionTable`, `tableCompetition` and `refuseUnlessMyTable`), `insertTeam` out of `service/team/create.ts`,
   a bye table of one match in `insertPairRounds.ts`, `dateTile` in `_lib/nights.ts`, `matchSlots` /
   `currentMatchNumber` for a table of one match, the tournament table in `_lib/ui/lineupPass.ts`, and the rating
   replay skipping a table decided without play (`attendance`). Zvanja stay out: Pravila igre reads `41 · s ovim
   dosta`. Nothing reads any of this yet — no route and no screen.
5. ~~**Routes.**~~ Done 10 Nov 2026: `api/tournaments/**` (9 handlers), `api/admin/tournaments/**` (12),
   `api/admin/bans/**`, `api/rounds/[id]/attendance/`, `api/players/search/` with `_lib/service/players/search.ts`,
   and `_fetchers/tournament.ts` + `_hooks/useTournaments.ts`. The shared routes moved with them:
   `api/admin/tables/[roundId]/**` and `api/admin/hands/[kind]/[resultId]` ask `requireCan("tournament.manage.own")`
   and then `refuseUnlessMyTable` / `refuseUnlessMyHand` (so a league night stays the admin's and a Kolo is its
   organizer's), and closing a table — by Završi meč, by the admin's scorepad or by removing it — makes the next
   Kolo's draft (`afterTableClosed`). `adminGuards.test.ts` now counts `requireCan` as a guard and has a test that
   every handler under `admin/tournaments/[id]`, `admin/tables` and `admin/hands` says whose it is. A tournament's
   Vrijeme partije defaults to 45 minutes, as a league's does. The open table's scope (`api/rounds/open`) waits for
   Početna in step 6.
6. ~~**Screens.**~~ Done 10 Nov 2026: `_ui/tournaments/**` (22 files, `PlayerFrame.tsx` among them), the nine
   `turniri/**` pages, and `_ui/profiles/BanSection.tsx` on a player's and a team's page. The shared screens came with
   them: Turniri in the computer's menu (for everyone) and under Admin (`tournament.manage.own`), the sixth tab of the
   phone's management bar, Početna's Turniri · Liga switch (the league's Home moved into `LeagueHome`, the tab
   remembered in `treseta.homeTab`) and the computer's tournament strip, `tableScope` links on the scorepad, Pregled
   stola, the phone's table and Tko igra (`?turnir=`), a table of one match through `TablePad.matchesPerRound` and
   `ScorePanel`'s `of`, `?scope=` and `tournamentId` on the open table, Novi stol in a Kolo (`RoundAdmin.addTable`,
   `byeWins`, the draft row's "vs"), Obriši ekipu's tournament check, Kraj kola's Poredak i rezultati, and `/turniri`
   in `_lib/publicPaths.ts`, `middleware.ts` and `session.test.ts`. Zvanja are gone from the form, the cards and the
   admin's notes; Pravila igre reads `41 · s ovim dosta`. A tournament's team chips draw no conference dot, and a
   logged-out visitor's Prijavi se goes to `/login` instead of Bela's "Sjedni za stol." sheet. Bela's Otključaj
   partiju (`_ui/admin/UnlockTable.tsx`, `api/admin/tables/[roundId]/unlock`) is not here: it is Bela's own work from
   after the sync point, for the nightly sync to bring.
7. ~~**Branding.**~~ Done: nothing imports `_ui/sp/brand.ts`; the sign-up invitation and the share sheet read `BRAND`,
   and the no-show's score is said as `NO_SHOW_SCORE` (5 : 0) on the day's screens instead of Bela's 1001 : 700.
8. ~~**Ratings.**~~ Done in step 4: the replay and `isRatedRound` leave out a table decided without play.
9. ~~**Tests and the click-through.**~~ Done 10 Nov 2026, below. The seed now makes a tournament of today with six
   teams signed up, its Okupljanje half an hour and its Početak an hour from the moment it runs, so Potvrda dolaska
   is open while the seed is being used. `_bootstrap/TournamentAttention.tsx` came with it (mounted in `layout.tsx`):
   the question "Jesu li … za stolom?" was the one screen the earlier steps had copied nothing for.

## Tests

Bela's six test files come over with Treseta's numbers: `tournaments.test.ts` (513 lines) and `tournamentDay.test.ts`
on 41, `BYE_MATCH_POINTS` and the new no-show score instead of 1001 : 700 and 301 : 0; `gameTime.test.ts` on 45
minutes, with new cases for the +5 of a raised target (41 → 51 → 61, and a raise that happens after the time is
already up); `tableScope.test.ts`, `lineupPass.test.ts`, `cron.test.ts` as they are. Treseta's own
`adminGuards.test.ts`, `roundPublication.test.ts`, `session.test.ts` and `tableOverview.test.ts` get back their
tournament routes, reads, paths and `TablePad` fields, and `adminGuards` gains the organizer: an organizer reaching
their own tournament, refused on someone else's, refused on the league.

New `db/` tests on a real database, in the shape of the existing ones: a no-show scoring 5 : 0 per match and the team
out of the rest, a skipped table counting for nobody, a match closed by time with the score entered then, a match
whose target rose twice lasting 55 minutes, a table unlocked with its own minutes, and the next Kolo's draft when a
Kolo's last table closes.

## Checks before it merges

The nightly sync's checks, plus the day itself: unit tests, ESLint, `tsc` with no new errors, `next build`, and
`prisma migrate diff` against the schema on a fresh local database. Then, on `bela_sync_check` at `localhost:5433`
with the seed, the app on port 3100 (`.claude/launch.json`), clicked through as **admin**, as **organizer** and as
**player**:

- make a tournament, sign two teams up (one finding a partner by search), fill the waiting list past the limit;
- confirm arrival with Tu smo, let the start time's switch run (sign-ups closed, unconfirmed inactive, the waiting
  list moved up);
- publish Kolo 1, play a table to 41, play one to a raised target and check it got five more minutes, let a match run
  out of time, answer "Jesu li … za stolom?" with Ne — 5 : 0 and the team out — and let another table be skipped;
- unlock a locked table with its own minutes, delete a Kolo mid-tournament, let Automatska kola make the next one,
  watch the full-screen Kolo with the standings;
- finish the tournament, check the standings, the prizes and that no-show and skipped tables stayed out of the
  ratings;
- as organizer: only Turniri · Ekipe · Igrači in the bottom bar, their own tournament manageable, someone else's
  refused with 403, the league untouched;
- a league night, unchanged except that a match can now end on its 45 minutes.

Last, the league as it is today: a night created, a Skica published, two matches at a table, Tu smo, the standings —
nothing about it may change except Vrijeme partije.

## What this does to the sync

[BELA_SYNC.md](BELA_SYNC.md)'s whole **Bela's tournaments** section goes, along with the tournament rows of the
shared-file tables, the Vrijeme partije and Zabrana prijava bullets, and the `api/cron/tick` line under what isn't
copied. What stays a difference is Bela's game (zvanja, štiglja, the trump caller, 1001), the hand tables, Treseta's
Conferences, Gost i poziv for now, and the three decisions above that differ in a constant: 45 minutes, the five
minutes of a raised target, and the no-show's 5 : 0. Those belong in `_lib/gameTime.ts` and `_lib/game/scoring.ts` —
one constant each, which is the cheapest kind of difference to keep.

Two carried copies go back to being imports, which is the point of doing this: `_lib/leagueOrder.ts`'s `rankTeams`
comes from `_lib/tournaments.ts` again, and `roundBackBy` from `_lib/ui/tableScope.ts` instead of
`_lib/ui/adminEntry.ts`. After that the nightly sync stops skipping tournament commits — 33 of Bela's last commits
(`a0686e1..d2a0b98`) are mostly tournament work, and 181 shared files currently differ between the repos, a good part
of that from tournament code having been stripped out commit by commit.
