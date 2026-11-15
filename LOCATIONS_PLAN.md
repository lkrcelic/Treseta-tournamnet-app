# Liga na dvije lokacije — the plan

Written 14 Nov 2026, against Treseta `master` at `627021f`. The screens are in the Claude Design canvas
[Liga na dvije lokacije](https://claude.ai/code/artifact/e6e7ca8b-5c7f-4f55-b669-5f33a271de57) (option A of every
screen); each screen below is named by its board there (`01 A` … `11 A`).

A league night can be played at two places at once. Places stop being three text fields copied onto the league, the
night and the tournament, and become one shared list, **Lokacije**. A night picks one or two of them. On a night with
two, the admin splits the teams between them (**Podjela**), and each place then runs its own Tu smo, Kola, Skice and
tables, while the night's table and the season stay one league. A night with one place looks exactly as it does
today.

- **Branch:** `feat/locations` from `origin/master` at `467ea59`, in its own worktree (`.claude/worktrees/locations`),
  because other sessions work in the main checkout. The worktree has its own copy of `node_modules` (an APFS clone,
  not a link), so `prisma generate` here doesn't change the Prisma client of the main checkout.
- **Treseta only.** Bela doesn't need it (decided 14 Nov 2026, Bela's DECISIONS #95): it is never brought to Bela,
  and it goes under *Differences from Bela* in [BELA_SYNC.md](BELA_SYNC.md) (step 14).
- **Status (15 Nov 2026):** built and verified (steps 1–15), not committed. Ship it in two deploys: steps 1–11 and
  13–14 first, then step 12's `20261115120000_locations_drop_text` once that release is live (the build migrates before
  `next build`, and the old deployment still reads the dropped columns until the new one is promoted).

## Decisions

Settled in the questions of 12–13 Nov, on the canvas, and in the answers to the plan's questions on 14 Nov 2026.

**Lokacije (the shared list)**

1. **One list for leagues and tournaments.** A place is a name, an address and a Google Maps link. Changing it
   changes it everywhere it is used, past nights included. Nothing else is stored for now (tables, smoking tables and
   people may come later).
2. **Own admin page "Lokacije"**, built like Sponzori: list on the left, editor on the right, *Dodaj lokaciju*. A place
   in use can't be deleted (03 A).
3. **Every place field becomes one "Lokacija" field** with search, *Nova lokacija* and *Sve lokacije*: Podaci lige,
   Uredi večer, Nova liga and the tournament form (10 A).
4. **Existing places move into the list automatically**; the same name (ignoring case and spaces) becomes one place.
5. **A tournament still has one place**; only the field changes. Its cards look as today. An organizer can pick a
   place and add a new one from the tournament form; editing and deleting places stay with the admin.

**The night**

6. **A night has one or two places**, with the same Okupljanje and Početak for both (04 A). The league's place is only
   the default for the first one, as "Zadano lige" today; the second is added per night under *Druga lokacija*.
7. **No home place for a team.** Teams are split for each night, by hand, before or during the night. No
   notifications: the team sees its place on the home card when it has one.

**Podjela (05 A)**

8. **A new tab "Podjela" in Upravljanje ligom**, always in the bar after Novo kolo. It edits the next night (tonight
   first) and opens only when that night has two places; with one place it is grey and doesn't open. Three columns
   (Neraspoređene | place 1 | place 2), drag and drop, each column alphabetical, inactive teams folded under
   Neraspoređene, *Traži ekipu* always shown, no arrival times. *Podijeli po konferencijama* puts the first
   conference at place 1 and the second at place 2; *Zamijeni lokacije* swaps the two groups of teams; *Kopiraj
   raspored* copies plain text (place, its teams one per line with "• ", a blank line, the next place; Neraspoređene
   left out). No other helpers: keep it simple.
9. **Phone:** a place picker under Neraspoređene with drag down into it, **and** a move arrow on every team that opens
   "X idu na: place 1 / place 2 (/ Neraspoređene)".
10. **Only the admin moves a team.** A move during the night counts from the next Kolo: a published table stays where
    it is, and the team's Tu smo stays confirmed. A team in an unpublished Skica of its old place is not taken out;
    the admin gets a warning.
11. **Only an assigned team can press Tu smo.** An unassigned or inactive team on a two-place night sees *Javi se
    adminu* instead (01 A, card 11). An inactive team that the admin assigns can press it.

**Kola**

12. **Each place has its own Novo kolo, Skice A/B/C and Objavi**, and goes at its own pace: its own number of Kola,
    window, smoking tables and teams who sit out (06 A, 07 A). Pairs are made only within a place, and an odd
    number of teams there gets a bye as today.
13. **Tables are numbered from Stol 1 at each place.**
14. **Kolo numbers are shared by the night:** both places' first published Kolo of the night gets the same number
    (Kartaš 7, 8, 9; Lanterna 7, 8). The next night starts after the highest.
15. **Kola tab stays exactly as today** (no Lokacija column), grouped as today by night and Kolo number: both places'
    Kolo 7 is one row with all its tables, and Obriši removes that Kolo at both places (the question names both).
16. **Kola before Ekipe** in the Upravljanje ligom tab bar, on the computer and on the phone.

**What players and viewers see**

17. **Dnevni poredak** (08 A, 09 A): on a two-place night one switch *Sve | place 1 | place 2* above Tablica
    okupljanja and the Kolo tabs, for both; no conference split that night. A place's view ranks from 1. In *Sve*, the
    Kolo tab groups the tables under each place, each from Stol 1. A one-place night keeps today's *Sve + konferencije*.
18. **Ukupni poredak, rejting, Burza and the desktop Home stay one league**, with no switch. A place that plays fewer
    Kola gives its teams fewer rounds in Ukupni poredak, as a missed night does today.
19. **Raspored (02 A):** both places on the night card, the team's own marked "Vi"; list rows "19:30 · Kartaš ·
    Lanterna"; before the split "Još niste raspoređeni.". A viewer without a team, or not logged in, sees no place.
20. **Početna, Liga (01 A):** the team's place in a "Vaša lokacija" box with Karta, the address always on its own line.
    Započni igru and Nastavi igru show no place; next to the table they say which Kolo of the night it is, "Kolo 1/3":
    k counts the place's Kola tonight, N is how many the admin has made for that place tonight (it grows when the
    admin adds one). Also on a one-place night. Sljedeći stol says "Kolo 1/3 · 2 : 0", Pauza "Kolo 2/3".
21. **New home cards** (01 A, top section *Nove kartice*), on every league night, one place or two:
    - *Sljedeći stol* (card 14): the team played its table and the next isn't published; the table, its score, an
      hourglass, Odlazimo under it. Card 7 (*Tu ste · večer je počela*) is now only for a team that hasn't played yet.
    - *Pauza* (card 15): the team sits out a Kolo (odd number of teams) that isn't the last.
    - *Kraj večeri* (card 16): only after the place's last Kolo, or a bye in the last Kolo. Shown until the day ends,
      then the next night's card.
    - *Nema zakazane večeri* (card 17): replaces the grey locked Započni igru when there is no table and no night.
    - Turniri: *Nema nadolazećih turnira* in the same style.
22. **Every admin sees and changes both places**; there is no admin per place.

## Database

```prisma
// A place where a league night or a tournament is played (Lokacije)
model Location {
  location_id Int      @id @default(autoincrement())
  name        String   @db.VarChar(100)
  address     String?  @db.VarChar(200)
  url         String?  @db.VarChar(500) // a Google Maps share link
  created_at  DateTime @default(now())

  leagues      League[]      @relation("LeagueLocation")
  nights       LeagueNight[] @relation("NightLocation")
  secondNights LeagueNight[] @relation("NightSecondLocation")
  tournaments  Tournament[]
}

model League {
  // location_name / location_address / location_url go (step 12)
  location_id Int? // the default first place of a new night
}

model LeagueNight {
  // location_name / location_address / location_url go (step 12)
  location_id        Int? // null: the league's place ("Zadano lige"), as today
  second_location_id Int? // null: a one-place night
}

model Tournament {
  // location_name / location_address / location_url go (step 12)
  location_id Int?
}

// The team's place on one night (Podjela); no row = Neraspoređena
model LeagueNightTeam {
  league_id Int
  night     DateTime @db.Date
  team_id   Int
  slot      Int      @db.SmallInt // 1 or 2: LeagueNight.location_id or second_location_id
  moved_at  DateTime @default(now())

  @@id([league_id, night, team_id])
  @@index([league_id, night, slot])
}

model Round {
  // ...as now, plus:
  location_slot Int? @db.SmallInt // 1 or 2 on a two-place night, null otherwise (and on every old table)
}

model CreateRoundDraft {
  // ...as now, plus `slot Int @default(0) @db.SmallInt` in the key: @@id([player_id, league_id, slot])
}
```

- **Slots, not place ids, on teams and tables.** A team is at "place 1" or "place 2" of the night, so changing the
  night's second place (Lanterna → Kod Mate) keeps the split and the tables. A one-place night writes no
  `LeagueNightTeam` rows and leaves `location_slot` null, so every query that ignores the slot keeps working.
- `LeagueArrival` gets no place: a team's arrivals count at the place it is assigned to now (decision 10).
- Deleting a `Location` is refused while any league, night or tournament points at it (`ON DELETE RESTRICT`, plus a
  friendly check in the service).
- **Migration `<ts>_locations`** (additive): the table, the new columns and keys, then a data step that inserts one
  `Location` per distinct trimmed, case-folded `location_name` across League, LeagueNight and Tournament (the most
  used spelling, the newest of equals; the newest non-empty address and link) and points the rows at it. A copy of production must come out with the same place
  on every night and tournament as before (checked by a query in step 15).
- **Migration `<ts>_locations_drop_text`** (step 12): drops the nine text columns once nothing reads them. It goes to
  production one deploy after the rest: `npm run build` runs `prisma migrate deploy` before `next build`, and the
  deployment still serving until the new one is live selects these columns.

## Backend

| Change | Where |
|--------|-------|
| `Location` CRUD, `locationInUse`, the view `{location_id, name, address, url}` | new `_lib/service/location/locations.ts` |
| zod: `LocationCreate/Update`, one `locationId` field replacing `locName/locAddress/locUrl` | new `_interfaces/location.ts`; `_interfaces/league.ts`, `_interfaces/tournament.ts` |
| `GET/POST /api/locations`, `PATCH/DELETE /api/locations/[id]` | new routes; capability below |
| `NightLocation` built from `Location`; `effectiveLocation` reads `location_id`; a night's places `[first, second?]` | `_lib/nights.ts`, `_lib/service/league/nights.ts` |
| League create/update, night add/update take `location_id`, `second_location_id` | `_lib/service/league/leagues.ts`, `nights.ts`, their routes |
| Tournament create/update take `location_id`; `TournamentPlace` keeps its shape | `_lib/service/tournament/tournaments.ts`, `views.ts` |
| Podjela: `nightSplit`, `assignTeams`, `swapSlots`, `splitByConference`, the move warning (team in an unpublished Skica of the old place) | new `_lib/service/league/split.ts`; `GET/PUT /api/leagues/[id]/nights/[date]/split` |
| Tu smo refused for an unassigned team on a two-place night ("Javi se adminu", 400 like the other refusals of Tu smo) | `_lib/service/league/arrival.ts` (`teamArrivalAction`) |
| `lastRoundLeagues` and `MyLeagueArrival.last_round` count the team's place only | `arrival.ts` |
| `leagueArrivals(leagueId, slot?)` and `setArrivals` filtered by slot | `arrival.ts`, `api/leagues/[id]/arrivals` |
| `MyLeague` gains `secondPlaces`, `slots` (night → 1/2/null) and `tonight` (below); `places` stays | `_interfaces/burza.ts`, `_lib/service/league/schedule.ts` |
| Novo kolo per slot: `location_slot` in `RoundCreateRequestValidation`; present teams = here **and** in the slot | `_interfaces/round.ts`, `api/rounds/generate-multiple` |
| `tonightDraftTables`, `insertRoundBatch` (slot on every table, `draft_order` per slot) | `_lib/service/round/insertPairRounds.ts` |
| Skica per slot: `nightTables(leagueId, date, slot)` and everything on it (`getDraftNight`, `setRoundApproval`, `approveNight`, `publishNight`, `discardDraft`); routes take `?slot=` | `_lib/service/round/publication.ts`, `api/leagues/[id]/nights/[date]/*` |
| Shared numbering: a place's k-th published Kolo of the night = (highest published number before this night) + k | `_lib/roundStatus.ts` (`publishNumbers`), `publication.ts` |
| Every (date, round_number) grouping also keys on the slot: `sameRound`, `editTablePair`, `addCompetitionTable`/`newTableNumber`, `deleteNightTables`, smoking records | `_lib/service/admin/tables.ts`, `_lib/tableSeats.ts`, `_lib/matching/smokingTables.ts` |
| Kola tab: `listLeagueRounds` keeps grouping by (date, round_number); `deleteLeagueRound` takes an optional slot (none = both places, as the Kola tab sends) | `_lib/service/admin/tables.ts` |
| "Kolo k/N" for a league table: `nightKolo: [k, n]` on the open table (null for a tournament) | `api/rounds/open/route.ts`, `_lib/service/round/getLastOpenByPlayerId.ts`, `_hooks/useOpenTable.ts` |
| `CreateRoundDraft` and the smoking picks per slot | `_lib/service/round/createRoundDraft.ts` |
| `get_league_standings_by_date(league, date, slot default null)`; arrived-not-played rows by slot | new migration; `_lib/service/league/getStandingsByDate.ts` |
| `/api/rounds` returns `location_slot` per table | `api/rounds/route.ts` |

**Capabilities.** `location.manage` (edit, delete) for ADMIN; `location.create` and listing for ADMIN and ORGANIZER,
so an organizer can pick or add a place in the tournament form (`_lib/auth/permissions.ts`).

**The `tonight` block** on `MyLeague` feeds the new home cards and is computed per team on `/api/schedule`, keyed by
`leagueNightString()` (not `schedule.today`, which flips at midnight while the night lasts until 06:00):

```ts
tonight?: {
  slot: 1 | 2 | null;           // null: one-place night, or not assigned
  played: number;               // the team's closed tables tonight (bye included)
  lastTable: {roundNumber: number; table: number; kolo: [number, number]; opponent: string | null; score: [number, number]; bye: boolean} | null;
  placeDone: boolean;           // the place's last Kolo (rounds_per_night) is published and all its tables closed
}
```

A pure `homeCard(openTable, arrival, tonight, next)` in new `_lib/homeCard.ts` picks Započni igru → Kraj večeri →
Pauza / Sljedeći stol → the night card (card 7 when `played === 0`) → Sljedeća večer → Nema zakazane večeri, and is
what the tests pin.

## UI

| Screen | Board | Components |
|--------|-------|-----------|
| Lokacije page `/lokacije` (desktop list + editor; phone list + sheet, opened from *Sve lokacije*) | 03 A | new `_ui/locations/LocationsDesktop.tsx`, `LocationsPhone.tsx`, `LocationForm.tsx`; NAV entry next to Sponzori in `DesktopShell.tsx` (the phone `AdminTabBar` is full, so no tab) |
| `LocationPicker` (search, *Nova lokacija* inline, *Sve lokacije*) replacing `PlaceFields` | 10 A | new `_ui/locations/LocationPicker.tsx`; `GatheringForm.tsx`, `LeagueDetailsView.tsx`, `league/new/page.tsx`, `NewLeaguePhone.tsx`, `TournamentForm.tsx` |
| Uredi večer: *Mjesto* (Zadano lige \| Drugo mjesto, now a picker) and *Druga lokacija* with ×; Datumi rows "Kartaš · Lanterna" | 04 A | `GatheringForm.tsx` (`NightGatheringForm`), `DatesView.tsx`, `LeaguePhone.tsx` (`DatesTab`) |
| Podjela tab (desktop; grey when the next night has one place) and Podjela ekipa (phone `?view=split`) incl. Kopiraj raspored | 05 A | new `_ui/league/split/SplitDesktop.tsx`, `SplitPhone.tsx`, `copyText.ts`; `manage/page.tsx` (`View`, `ViewSwitch`, badge = unassigned), `ManagePhone.tsx` |
| Novo kolo: place picker next to the league picker; the list, settings and *Kreiraj kolo · Kartaš · 5 ekipa* for that place | 06 A | `CreateRound.tsx`, `CreateRoundPhone.tsx` (segment *Kartaš · 8 \| Lanterna · 5*) |
| Skica per place (picker like the league; phone segment); Kola tab unchanged | 07 A | `manage/DraftView.tsx`, `_ui/admin/DraftPhone.tsx`, `useNightDraft.ts`, `RoundsView.tsx`, `LeaguePhone.tsx` (`RoundsTab`) |
| Dnevni poredak: *Sve \| place \| place* above both cards; Kolo tab grouped by place in *Sve* | 08 A, 09 A | `daily-standings/page.tsx`, `ui/RoundTables.tsx`, new `_ui/league/LocationFilter.tsx` and `useLocationFilter` (its own memory, not the conference one shared with `/standings`) |
| Početna · Liga: Vaša lokacija, Javi se adminu, Još niste raspoređeni, address on its own line, "Kolo 1/3" on the table card, the new cards | 01 A | `HomeCards.tsx` (`GatheringRow`, `NextNightCard`), `LeagueArrival.tsx`, `StartCard.tsx`, `PhoneHome.tsx` (`LeagueHome` via `homeCard`), new `_ui/home/TonightCards.tsx` (Sljedeći stol, Pauza, Kraj večeri, Nema zakazane večeri replacing `NoRoundCard`) |
| Početna · Turniri: *Nema nadolazećih turnira* restyled | 01 A | `PlayerParts.tsx` (`NoTournamentCard`) |
| Raspored: two place pills, "Vi", the list line | 02 A | `raspored/page.tsx`, `_ui/gathering/Gathering.tsx` |
| Admin phone Večer: per-place state in the navy card, "N ekipa bez lokacije", *Podjela ekipa* next to *Novo kolo* | 11 A | `AdminTonight.tsx`, `_lib/ui/adminTonight.ts` |
| Kola before Ekipe | — | `manage/page.tsx` (`ViewSwitch` items), `LeaguePhone.tsx` (`TABS`) |

Every place switch and place column shows only on a two-place night.

## Work order

Each step ends with `npm test`, ESLint and `tsc --noEmit` on the touched files, and is committed on its own.

1. [x] **Schema and migration `locations`** (`20261114120000_locations`), with the data step; run on a fresh DB with
       the seed and on a copy of production (`pg_dump` is fine, nothing is written to production).
       *Checked 14 Nov:* `migrate diff` against the schema is empty; `migrate reset` with the seed; production copy
       (2 leagues, 21 nights, 1 tournament, all without a league place) gets one Location and every night and
       tournament reads the same place as before; on the same copy with messy duplicates ("Caffe bar Kartaš" /
       "  caffe  BAR kartaš ", "Lanterna" / " lanterna", an empty name) they merge into one place each, the empty
       one stays without a place. `npm test` (586), `npm run test:db` (38), `tsc --noEmit` and ESLint clean. The
       only code change is `CreateRoundDraft`'s key (`slot`, 0 for now).
2. [x] **Pure logic** with tests: `_lib/locations.ts` (slots, `splitByConference`, `swapSlots`, `copyText`), the
       shared numbering in `roundStatus.ts` (`placeLastPublished`, and `nightKolo` for "Kolo 1/3"), `homeCard.ts`.
       *Checked 14 Nov:* `__tests__/locations.test.ts` (15 tests); `npm test` 601, `tsc` and ESLint clean.
       `homeCard` shows Kraj večeri until the night ends at 06:00, like the arrival window, not at midnight.
3. [x] **Lokacije**: service, routes, capabilities, the page (03 A) and `LocationPicker` (10 A) in Podaci, Nova liga
       and the tournament form; every reader of the text columns switched to `Location`.
       *Checked 14 Nov* on the seed (Kartaš and Lanterna in Lokacije; the league and the tournament at Kartaš) at
       1440 × 900 and 375 × 812: the picker in Podaci (search "ka" finds both, "trenutno", Nova lokacija adds and picks
       a place, the league saved to Lanterna stays after a reload), Uredi večer's Drugo mjesto, Datumi showing each
       night's place, the tournament's place from the list; `/lokacije` on the computer and the phone (usage per
       place, Obriši locked while in use, a place nobody uses deleted). The API refuses an unknown place ("Lokacija ne
       postoji.") and deleting one in use. Writers now send only `location_id`; the old text columns are no longer
       read or written. `npm test` 602, `npm run test:db` 38, `tsc` and ESLint clean. Vrati na zadano in Uredi večer
       stays until step 4 (04 A drops it).
4. [x] **Two places on a night**: Uredi večer and Datumi (04 A), `LeagueNightRow`, `MyLeague.secondPlaces`.
       *Checked 14 Nov* at 1440 × 900 and 375 × 812: Uredi večer has *Druga lokacija* (a dashed *Dodaj drugu
       lokaciju* once the night has a place, then the picker without the first place and a × beside it), the times
       note says they are the same at both places, the Podjela hint under it, and only Spremi (Vrati na zadano is
       gone; the phone keeps Makni večer). Datumi rows read "Lanterna · Caffe bar Kartaš" with the "!" mark
       ("dvije lokacije" to a screen reader); a past night shows both places. The server refuses a second place
       without a first or equal to it (`secondPlaceError`, also checked in the form) and an unknown one; taking the
       second place away deletes the night's Podjela rows (checked on the DB), and a moved night takes them along
       (ON UPDATE CASCADE). `MyLeague.secondPlaces` is filled; Raspored shows it in step 9. `npm test` 605,
       `npm run test:db` 38, `tsc` and ESLint clean.
5. [x] **Podjela**: service, routes, desktop tab and phone screen (05 A), Kopiraj raspored, the move warning.
       `_lib/service/league/split.ts`, `GET/PUT /api/leagues/[id]/nights/[date]/split`, `useNightSplit`,
       `_ui/league/split/` (SplitParts, SplitDesktop, SplitPhone); the phone screen is `?view=split` (its button on the
       admin's Večer comes with step 10). *Checked 14 Nov* at 1440 × 900 and 375 × 812: the tab after Novo kolo, grey
       with a note while the next night has one place, the gold count of teams without a place; dragging onto a
       column (also a quick drag that leaves the card at once), the click / arrow menu "… idu na", the phone's drag
       onto the other place's switch, Po konferencijama, Zamijeni lokacije, Kopiraj raspored (the text of 05 A),
       Neaktivne folded, 50 teams, and the warning for a team that leaves a place where it is in a Skica ("… na
       lokaciji Lanterna …": place names don't decline). Dragging with a real finger (the handle) isn't checked: the
       browser here only sends mouse events. DB test `db/split.test.ts` (5); `npm test` 605, `npm run test:db` 43,
       `tsc` and ESLint clean. New token `color.gold` (the palette's gold, solid) for the count.
6. [x] **Tu smo per place**: the refusal, `slots` on `MyLeague`, last Kolo per place, admin arrivals per slot.
       `asksAdmin` and the `no_place` effect in `_lib/leagueArrival.ts`; `MyLeagueArrival` has `two_places` and `slot`;
       `leagueArrivals(…, slot)` and `?slot=` / `slot` on `/api/leagues/[id]/arrivals` (Novo kolo uses them in step 7).
       The Tu smo card shows *Javi se adminu* (01 A card 11) for a team without a place; a team that came and was
       taken out of the Podjela since can still leave (the server allows it). *Checked 14 Nov* at 375 × 812 as the seed
       `player` with a local two-place night tonight: card 11, the API refusing Tu smo, and Tu smo working once the
       team is placed. The card's place row still shows the night's first place; Početna shows the team's own place in
       step 9. DB test `db/arrivalPlaces.test.ts` (4: the refusal, last Kolo per place, arrivals per place, leaving
       after being taken out); `npm test` 606, `npm run test:db` 47, `tsc` and ESLint clean.
7. [x] **Novo kolo, Skica and Objavi per place** (06 A, 07 A), the slot through every (date, round_number) query, shared
       numbering, smoking tables and the admin's draft per slot.
       Server: `location_slot` on every new table; `insertRoundBatch` refuses a two-place night without a place, a
       place's teams that aren't there (Podjela) and waits only for its own place's Skica; the Skica routes,
       arrivals, Novo kolo's saved choice and the smoking plan take `?slot=`; `publishNight` numbers a place's Kola after
       the league's last before the night or its own (`placeLastPublished`); `sameRound`, `addTable`,
       `listLeagueRounds` (a row per place), the smoking rotation's rounds and Završi meč's "next Kolo" key on the
       place; `deleteLeagueRound` without a place deletes the Kolo at both. A one-place night has no place and behaves
       as before. UI: a place picker beside the league's in the header on Novo kolo and Skica (menu: each place's
       teams and how its Kola go, Podjela ekipa), Novo kolo of the place ("Kreiraj kolo · Lanterna · 4 ekipe", its
       teams only), Skica of the place (eyebrow, "Objava vrijedi samo za lokaciju …", the other place's Skica
       stays); the phone's Novo kolo and Skica kola have a place switch under the title (`useNightPlaces`, `?slot=`).
       Kola tab: a published Kolo is one row with both places' tables and Obriši asks "Briše se na obje lokacije";
       a place's Skica row says its place under the name (`kolaRows`). *Checked 14 Nov* at 1440 × 900 and 375 × 812
       with a local two-place night (Lanterna 4 teams, Kartaš 4): Lanterna made and published Kolo 1–3, then Kartaš
       its own Kolo 1–2 (not stopped by Lanterna); the Kola tab merged Kolo 1 and 2 (4 tables each) and kept Kolo 3 as
       Lanterna's; the phone screens switch place and open on `&slot=`; a one-place night shows no picker. DB test
       `db/placeRounds.test.ts` (4); unit tests for `kolaRows`, `placeStatus`, `draftNight` per place and the smoking
       key; `npm test` 610, `npm run test:db` 51, `tsc` and ESLint clean. Not yet: Dnevni poredak's own table edits on
       a two-place night (step 8, with `location_slot` from `/api/rounds`).
8. [x] **Dnevni poredak** (08 A, 09 A): the SQL function, `/api/rounds`, `LocationFilter`.
       Migration `20261114140000_locations_daily_standings`: `get_league_standings_by_date(league, date, slot DEFAULT
       NULL)` (dropped and made again: a parameter can't be added in place); `getLeagueStandingsByDate(…, slot)` with the
       teams that came to that place; `?slot=` on `/api/leagues/[id]/daily-standings`; `/api/rounds` already returns
       `location_slot` (added to `RoundResponseValidation`). Page: on a two-place night `LocationFilter` (Sve | place |
       place, "8 ekipa · 2 lokacije") over the night's table and the Kola, in place of the conference filter, its pick
       remembered per league and tab (`useLocationFilter`, not the conference's); a place's table ranks from 1 and its
       tabs are its own Kola; Sve's Kolo shows each place's tables under its name from Stol 1 (`DesktopRoundSections`,
       a `PhoneRoundTables` per place). A table is edited from its place's view (Novi stol knows the place); Sve has no
       pencil on a two-place night. *Checked 14 Nov* at 1440 × 900 and 375 × 812 with a local night (Lanterna Kolo 1–2,
       Kartaš Kolo 1): Sve's table with all 8 teams, Kartaš's with its 4 ranked 1–4 and only Kolo 1, Sve's Kolo 1 in
       two sections, the phone's place views; the same night as a one-place night keeps the conference filter. DB test
       `db/dailyPlaces.test.ts` (2); `npm test` 610, `npm run test:db` 53, `tsc` and ESLint clean.
9. [x] **Početna and Raspored** (01 A, 02 A): the place on the card, "Kolo 1/3", `tonight` and the new cards,
       Turniri's empty card.
       Server: `MyLeague.tonight` (`MyLeagueTonight`: the team's last closed table tonight at its place with
       `kolo` [k, n], opponent, score and bye; `lastKoloOut`; `kola`) in `schedule.ts`; `nightKolo` on
       `/api/rounds/open` (`OpenTable.kolo`). Početna · Liga picks its card with `homeCard`: Započni / Nastavi igru
       with "Kolo 1/3" and no place, Kraj večeri (the night's card with its box and Dnevni poredak), Pauza and
       Sljedeći stol (`_ui/home/TonightCards.tsx`, Odlazimo under them), the night's card, or Nema zakazane večeri in
       place of the grey Započni igru. The night's card: "Vaša lokacija" over the team's place on a two-place night,
       "Kartaš ili Lanterna" with "Još niste raspoređeni." before Podjela, no place row with Javi se adminu, and the
       address on its own line. Raspored: both places as pills on the night card ("Vi" on the team's, white), "Još
       niste raspoređeni.", list rows "Kartaš (vi) · Lanterna", and no place on a two-place night for a viewer without
       a team. Turniri's Nema nadolazećih turnira is the same white card (`QuietCard`). Place names don't decline, so
       Pauza says "Neparan broj ekipa na lokaciji Lanterna." and the Tu smo texts keep today's wording (the place is in
       the box above them). *Checked 14 Nov* at 375 × 812 as the seed `player` with local data: cards 1, 2, 12, 14,
       15, 16 and 17 and Raspored before and after Podjela; Kraj večeri's "Sljedeća večer je …" fixed to one full stop.
       Turniri's empty card not seen (the seed has a tournament). DB test `db/homeTonight.test.ts` (2); `npm test`
       610, `npm run test:db` 55, `tsc` and ESLint clean.
10. [x] **Admin phone Večer** (11 A).
        Tonight at two places the navy card is `PlacesCard`: a box per place (its teams from Podjela and how many are
        here; "kola čekaju objavu" with Skica kola · place; "kolo 2 od 3 · u tijeku" with its own tables done and
        Dnevni poredak · place, which opens on that place; "večer je odigrana"; or Novo kolo · place once the other
        place has started), "2 ekipe bez lokacije vide „Javi se adminu”" (opens Podjela), and before any Kolo
        "Kola još nisu kreirana" with Podjela ekipa next to Novo kolo; the subtitle adds "2 lokacije", Još igraju names
        each table's place, and the cream Skica card isn't repeated for tonight. `placesTonight` in
        `_lib/ui/adminTonight.ts` counts each place's own Kola ("kolo 2 od 3", "3 / 3 kola odigrano"); the one-place
        card is as before (its "Kolo 8 od 9" still uses the league's numbers, as today). *Checked 14 Nov* at 375 × 812 as
        admin with a local night: both states of 11 A, Podjela ekipa opening `?view=split`, Skica kola · Caffe bar Kartaš
        opening that place's Skica, Dnevni poredak · Lanterna opening on Lanterna. Unit test for `placesTonight`;
        `npm test` 611, `tsc` and ESLint clean.
11. [x] **Kola before Ekipe.**
        `manage/page.tsx` (`ViewSwitch`) and `LeaguePhone.tsx` (`TABS`). *Checked 14 Nov:* the computer's bar reads Novo
        kolo · Podjela · Kola · Ekipe · Datumi · Podaci · Sponzori (05 A) and the phone's Kola · Ekipe · Datumi ·
        Postavke · Sponzori. The phone still opens on Ekipe without `?view=` (only the order was decided).
12. [x] **Migration `locations_drop_text`** and the last references to `location_name/address/url`.
        `20261115120000_locations_drop_text` drops the nine columns from League, LeagueNight and Tournament; nothing in
        the code read them any more, so only the schema changed (its comments now speak of `location_id` alone). No
        constraint, index or function used them. **Deploy it after the release with steps 1–11 is live**: the build
        migrates before `next build`, so shipped together the deployment still serving would fail on every league,
        night and tournament query until the new one is promoted (and a rollback would too). *Checked 15 Nov:* applied
        to `treseta_locations` and `treseta_locations_dbtest`, `prisma migrate diff` against the schema empty; Lokacije,
        Podaci (Lokacija Lanterna), Raspored, a tournament's page (Caffe bar Kartaš with its address) and the nights
        API load with no server errors. `npm test` 611, `npm run test:db` 55, `tsc` clean.
13. [x] **Seed:** Kartaš and Lanterna in Lokacije; next Thursday on both, the seed teams split, so `npm run dev:reset`
        shows every screen. The seed has 8 teams (not the canvas's 15), so the split is Sjever's four at Kartaš (the
        `player` login's Alen Kitasović among them), three of Jug at Lanterna and Lavovi not assigned (`nika`, `stipe`).
        The night is the first Thursday from today (today itself on a Thursday). *Checked 15 Nov* after
        `prisma migrate reset` on `treseta_locations`: Podjela · čet 19. 11. (Neraspoređene 1, Kartaš 4 ekipe, Lanterna
        3 ekipe, 1 on the tab), Raspored with both places and Vi on Kartaš, Početna · Liga "Vaša lokacija · Caffe bar
        Kartaš" for `player` and "Caffe bar Kartaš ili Lanterna · Još niste raspoređeni." for `nika`; no server errors.
14. [x] **BELA_SYNC.md:** a *Lokacije* section under Differences from Bela — the new files as Treseta only, and the
        shared files listed per area (schema, nights, GatheringForm, schedule, HomeCards, Raspored, TournamentForm,
        publication, insertPairRounds, admin tables, daily standings, CreateRound, DraftView, AdminTonight), with the
        rule that Bela's changes to place fields come over as `location_id`. Say there that Bela doesn't need it
        (Bela's DECISIONS #95), so unlike Vrati stol or Uredi ishod it isn't marked "worth building in Bela too".
        *Done 15 Nov:* the *Lokacije* section sits after *Tu smo without the bans*: what it is, Bela's DECISIONS #95,
        how a Bela change comes over (a place field as `location_id`, a Bela text field for a place as
        `LocationPicker`, a new place field stops the sync; `get_league_standings_by_date` keeps `p_slot`; a night's
        rounds stay per place, else the sync stops), the new files, and the shared ones in nine areas. Database's
        schema and seed rows and Repository files (`LOCATIONS_PLAN.md`) name it too. Every file the branch changes is in
        it, checked against `git diff --name-only` and the untracked files.
15. [x] **Verify** (below) and fill in the status line at the top.
        *Checked 15 Nov.* **Migrations** on a fresh copy of production (`pg_dump`, read only; 2 leagues, 21 nights, 1
        tournament): all three apply, `migrate diff` against the schema is empty, and every night, tournament and league
        reads the same name, address and link as before (24 rows, before/after query); the 14 played nights' Dnevni
        poredak (`get_league_standings_by_date`, 544 rows) is the same before and after, called with two arguments and
        with a NULL place; on a second copy with messy duplicates ("  klub  ZADARSKIH studenata ", "Lanterna" /
        " lanterna", a blank name) they became one place each and the blank one kept the league's place. **Checks:**
        `npm test` 611, `npm run test:db` 55, `tsc`, ESLint on the 117 changed files and `next build` clean. **Browser**
        with the seed, the two-place night moved to today and a Početak: `nika` (Lavovi, not placed) gets Javi se
        adminu with Tu smo locked and the server refuses it (400); `player` presses Tu smo at Kartaš; the admin's
        arrivals per place; Novo kolo → Skica A/B/C → Odobri sva → Objavi at Kartaš on the computer (Kolo 1–3) and at
        Lanterna on the phone (Kolo 1–2, a bye), so both places count from Kolo 1 and go at their own pace; the phone's
        Večer with a box per place and "1 ekipa bez lokacije"; `player`'s "Stol 1 · Kolo 1/3 · Započni igru"; Dnevni
        poredak's Sve / Kartaš / Lanterna (Lanterna ranks its 3 teams, Kolo 1–2); Kola with Kolo 3 · Caffe bar Kartaš
        and Kolo 1–2 merged. **One-place nights** on the production copy (a local test admin): 11. 11.'s Dnevni poredak
        with its conference filter and no place switch, Kola without places, the tournament's Podaci with Klub
        Zadarskih Studenata. No server errors. The copy and the test admin are gone and `treseta_locations` is back to
        the seed. Inactive teams (decision 11): Lavovi, inactive and not placed, is refused with Javi se adminu;
        Barcelona, inactive and placed at Lanterna, presses Tu smo and sees Vaša lokacija · Lanterna. Podjela with 50
        teams was checked in step 5 and not again here.

## Tests and verification

- **Unit tests:** the migration's name folding; `splitByConference` (two conferences, none, more than two);
  `swapSlots`; `copyText` (order, blank line, Neraspoređene out); shared numbering (Kartaš 7–9 and Lanterna 7–8 on one
  night, the next night from 10, a place that publishes second); `homeCard` (every card of 01 A, including a bye in a
  middle and in the last Kolo, a move during the night, the minutes after midnight); last Kolo per place; "Kolo k/N"
  (two places at different paces, a Kolo added later).
- **DB tests** (`src/app/_lib/__tests__/db/`, real Postgres on :5433): Tu smo refused for an unassigned team; a move
  keeps the published table and Tu smo; two places' Novo kolo, Skica and Objavi don't touch each other; deleting a
  place in use is refused; the standings function per slot.
- **Migration:** on a copy of production, every night and tournament shows the same name, address and link as before
  (a before/after query), and duplicate names became one place.
- **In the browser** at 375 × 812 and 1440 × 900, with the seed, against each board of the canvas: Lokacije and the
  picker; a night with two places; Podjela (drag, arrows, conferences, swap, copy, 50 teams); Tu smo for an assigned,
  an unassigned and an inactive team; Novo kolo → Skica → Objavi at both places, numbers 7… at both; Dnevni poredak
  switch; every home card of 01 A; Raspored; the admin's Večer; and a one-place night unchanged.

## Still to look at

Not reviewed on the canvas yet: 03 A Lokacije, 10 A Odabir lokacije, 11 A Večer lige (admin), 07 A Skica and the rest
of 06 A. Each is built as drawn unless a comment there changes it.

## Out of scope

A team's home place; different Okupljanje or Početak per place; more than two places on a night (the data allows it
later with a child table instead of `second_location_id`); an admin per place; notifications about the split;
places in Bela; tables or smoking tables stored per place.
