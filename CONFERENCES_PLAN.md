# Plan: conferences

A league can split its teams into conferences (e.g. "Sjever" and "Jug"), each with a name and a color. Wherever the
league's teams are listed, the color shows as a small dot before the team's name. The standings also get a view per
conference.

- **Branch:** `feat/conferences`, from `feat/scorepad` at `f7e57a4`, because every screen involved exists only there.
  It's checked out in its own worktree (`.claude/worktrees/conferences`), since other sessions work in the main
  checkout.
- **Status (12 Oct 2026):** built and verified locally (see [Steps](#steps)), committed on `feat/conferences` and
  pushed, with `feat/scorepad` (the nightly Bela sync) merged in.

## What it does

- **Create League:** a "Conferences" switch. When it's on, two conference rows appear, each with a name and a color.
  More rows can be added, for 2–6 conferences.
- **Manage League · Details:** the same editor for an existing league: rename, recolor, add, remove. A league gets
  conferences later by adding them here, and loses them when all are removed.
- **Manage League · Teams:** once the league has conferences, each team gets a conference picker. The list gets a
  conference filter that counts unassigned teams, and a "Distribute evenly" button.
- **Dots:** an 8 px dot in the conference's color before the team's name. It's drawn like the team dots on the Start
  Game card (`src/app/_ui/home/PhoneHome.tsx:240`). It appears on the Start Game card, Daily (the night table and the
  round tabs), the pairings page, League standings and the desktop Home.
- **Per-conference views:** League standings and Daily's night table get a filter: `Sve · ● Sjever · ● Jug`. A
  conference's view lists only its teams, ranked from 1, with its own podium. The filter chips double as the color
  legend.
- **Create Round:** when the new pairs put two teams of the same conference at one table, the admin gets a notice
  listing those tables before anything is created, like the notice for teams that would meet twice today.
- A league without conferences looks exactly as it does today.

## Decisions

**D1. Pairing.** *Decided:* the pairing doesn't change. After pairing, Create Round checks the new tables, and if a
table has two teams from the same conference it shows a notice listing them, in the same dialog as the "Some teams
will play twice today" notice. "Continue" creates the rounds anyway.

**D2. What does a conference table count?** *Decided:* the same table, showing only the conference's teams (same
numbers, ranked within the conference).

**D3. On/off.** *Taken as recommended:* no separate flag in the database. A league has conferences when it has any,
and it may have 0 or 2–6. The switch on Create League only shows or hides the editor.

**D4. Colors.** *Taken as recommended:* a palette of 6:

| Color | Hex |
|-------|-----|
| plava | `#2E6DB4` |
| narančasta | `#C2410C` |
| tirkizna | `#0F766E` |
| ljubičasta | `#7A4BA8` |
| maslinasta | `#5F7A1F` |
| smeđa | `#8B5A2B` |

Each has at least 3.6 : 1 contrast on white, on the cream "my team" row and on the podium tints; graphics need
3 : 1. The palette has no red, because the live dot is red and the same size, and no navy, because that's the "my
team" bar. The database stores the hex, so the palette can change later.

**D5. Where the dots go.** *Decided:* the "tables view" is the pairings page shown after Create Round
(`/round/pairings/[n]`). The Start Game card shows the two teams' conference colors (green and red when the league has
none). The scoreboard, the lineup step and the admin table scorepad keep green and red, since there the colors mean
the two sides of the board.

**D6. The Bela app.** *Decided:* Bela doesn't get conferences for now. They are listed under Differences from Bela in
[BELA_SYNC.md](BELA_SYNC.md): the new files as Treseta only, and the 27 shared files with conference code, around
which the nightly sync merges a Bela change.

**D7. Branch.** *Decided:* a new branch from `feat/scorepad`. It merges after the cutover (Phase 6 of
[TRANSITION_PLAN.md](TRANSITION_PLAN.md)), as a merge of its own, so the cutover goes out exactly as tested. The
migration only adds things, so it could also go with the cutover if the new season needs conferences on day one.

## Database

```prisma
// A group of a league's teams, shown as a colored dot before the team's name and as its own standings
model Conference {
  conference_id Int    @id @default(autoincrement())
  league_id     Int
  name          String @db.VarChar(40)
  // #RRGGBB from the palette in _lib/conferences.ts; CHECK constraint added in the migration script
  color         String @db.VarChar(7)
  // order in the editor, the filters and the pickers
  position      Int    @default(0)

  league      League       @relation(fields: [league_id], references: [league_id], onDelete: Cascade)
  leagueTeams LeagueTeam[]

  @@index([league_id])
}

model LeagueTeam {
  // ...as now, plus:
  // null: no conference (or the league has none)
  conference_id Int?
  conference    Conference? @relation(fields: [conference_id], references: [conference_id], onDelete: SetNull)

  @@index([conference_id])
}
// League gets `conferences Conference[]`
```

- A team has one conference per league, stored on `LeagueTeam`. Past nights show the team's current conference; no
  history of changes is kept.
- Deleting a conference unassigns its teams (`SET NULL`). Deleting a league deletes its conferences. Taking a team
  out of a league drops its assignment along with the `LeagueTeam` row.
- A plain foreign key can't make sure a team's conference belongs to the same league, so the service checks it.
- Names (in any case) and colors are unique within a league. The editor always saves the whole list, so zod checks
  the submitted list instead of a unique index. A unique index would refuse swapping two names in one save.
- Migration `<timestamp>_conferences`: a new table, one nullable column and a CHECK on the color format. It has no
  data step. Production leagues start with no conferences, so nothing changes until an admin adds some.

## Backend

| Change | Where |
|--------|-------|
| The palette, `MIN`/`MAX` (2/6), validation helpers, `distributeEvenly` | new `_lib/conferences.ts` (pure, tested) |
| zod: `conferences` on create, a conferences request, and `LeagueTeamUpdateRequestValidation` takes `active` and/or `conference_id` | `_interfaces/league.ts` |
| `getLeagueConferences`, `setLeagueConferences` (one transaction: update by id, create new, delete missing), `setTeamConference`, `setTeamConferences` (bulk) | new `_lib/service/league/conferences.ts` |
| `createLeague` creates the conferences; `listLeagueTeams` returns `conference_id` | `_lib/service/league/leagues.ts` |
| `GET` (public, like `/standings`) and `PUT` (admin) on `/api/leagues/[id]/conferences` | new route |
| `PUT /api/leagues/[id]/conferences/teams` (admin, bulk assignment for "Distribute evenly") | new route |
| `PATCH /api/leagues/[id]/teams/[teamId]` also takes `conference_id` | existing route |
| Create Round: after pairing, the tables with two teams of one conference; refused (409, with the list) unless `allowSameConference`, in the same response as the repeats | `api/rounds/generate-multiple`, `_interfaces/round.ts` |
| Start Game: the two teams' conferences (team1 first), when the round's league has conferences | `api/rounds/open` |

The standings services, the SQL function and the rounds API stay as they are. They already return `team_id`, so the
screens look up each team's conference.

```json
{"conferences": [{"conference_id": 1, "name": "Sjever", "color": "#2E6DB4"}], "teams": [{"team_id": 4, "conference_id": 1}]}
```

## UI

### Shared pieces

- `TeamDot` and `TeamLabel` in `_ui/sp`: the Start Game card's `TeamName` moves into the kit (8 px dot, 8 px gap, name
  with ellipsis). A team without a conference in a league that has them gets a hollow ring, so the names still line
  up. The dot has a thin white ring so it still shows on navy (the Start Game card, a selected chip).
- `useConferences(leagueId)` returns `{conferences, of(teamId)}`. It makes one small request per page, and Manage
  League updates it in place after an edit.
- `StandingsRow.conference` and `TableRow.conferenceA` / `conferenceB`, filled by `toStandingsRows(…, conferenceOf)`
  and `toTableRows(…, conferenceOf)`.
- `inConference(rows, id)` returns a conference's rows ranked 1…n, so `splitPodium` gives its podium.
- `ConferenceEditor` (new `_ui/league/ConferenceEditor.tsx`): name and color swatches per row, plus add and remove.
  Create League and Manage League both use it.

### Create League (`league/new/page.tsx`)

After "Rounds per night" comes a `SwitchRow`, "Conferences". When it's on, the editor appears with two rows (plava,
narančasta) and room for up to 6. Create sends `conferences`. The success note says how many conferences were made
and links to Manage League · Teams to assign the teams.

### Manage League (`league/[leagueId]/manage/`)

- **Details, desktop:** a "Conferences" card in the empty second column of `LeagueDetailsView`. Save replaces the
  list (`PUT`). Removing a conference that has teams asks first: "4 teams lose their conference".
- **Phone:** the same card goes in the side panel, under the league name card.
- **Teams, desktop:** a "Conference" column in `TEAM_GRID`. Its picker shows `● Sjever ▾`, or "—" for no conference,
  and opens a menu with each conference and "No conference". It saves optimistically, like the Active switch. The
  toolbar gets a second `Segmented`: All / ● Sjever 8 / ● Jug 8 / Unassigned 0.
- **Teams, phone:** a conference chip under the team's name. Tapping it opens a `BottomSheet` with the choices.
- **Distribute evenly:** deals the teams out in snake order of the league table (1→A, 2→B, 3→B, 4→A …), or
  alphabetically if nobody has played yet. A summary to confirm comes first ("Sjever 8 · Jug 8"), then one bulk
  request. It assigns every team, replacing earlier assignments.

### Create Round (`_ui/round/CreateRound.tsx`)

The "Some teams will play twice today" dialog becomes a pairing notice with up to two lists: the pairs that would
meet twice, and the tables with two teams of one conference (each row with the conference's dot). "Expand the window"
shows only when there are repeats; "Continue" creates the rounds with both allowed.

### Dots

| Screen | Component | Where the dot goes |
|--------|-----------|--------------------|
| Start Game card | `StartCard` (`_ui/home/PhoneHome.tsx`) | The conference colors instead of green/red |
| Daily · Tablica okupljanja | phone: `StandingsRows` / `StandingsLine`; desktop: `Podium`, `StandingsGrid` (`_ui/sp/Standings.tsx`) | Before the name |
| Daily · Round N | `PhoneRoundTables`, `DesktopTableRow` (`daily-standings/ui/RoundTables.tsx`) | Phone: before each name. Desktop: `Team A ● 2 : 0 ● Team B`, so the dots line up beside the score |
| Pairings (`round/pairings/[roundNumber]/page.tsx:79`) | The page | Conference color instead of green/red; green/red stays for leagues without conferences |
| League standings | Same components as Daily's table | Before the name |
| Desktop Home | `_ui/home/DesktopHome.tsx` (same components) | Before the name |

Optional, for admins: dots in Create Round's team list and in the re-pair dialog.

### Per-conference views

- **League standings:** on phone, `PillTabs` under the title; on desktop, a `Segmented` next to the league menu. The
  items are `Sve`, then each conference (dot and name).
- **Daily:** the same chips above the night table ("Tablica okupljanja"). On phone they go under the round tabs; on
  desktop, above the podium. They show the conference's teams ranked from 1. The round tabs have no filter: they show
  every table, with the dots.
- The choice is remembered per league for the browser tab (`useConferenceFilter`, like the league picker), so Daily and
  League standings show the same conference, and the date arrows and a visit to a table's scorepad keep it. (Planned
  as `?conf=<id>`; the tab-wide memory needs no parameter passed through every link.) The default is `Sve`.
- The filter shows only when the league has conferences.

## Steps

1. [x] Schema, migration (`20261011232000_conferences`), `_lib/conferences.ts` with its tests.
2. [x] Services and routes, checked against the running app: validation errors (400), logged-out writes (401), a
       conference from another league refused, the bye refused, a missing league or team (404).
3. [x] `TeamDot`, `useConferences` and the row helpers, with tests.
4. [x] Create League and Manage League: the editor, assignment and "Distribute evenly".
5. [x] Dots on the Start Game card, Daily, pairings, League standings and the desktop Home (also Create Round's team
       list).
6. [x] Per-conference views.
7. [x] Create Round's same-conference notice.
8. [x] Seed: the seed league gets "Sjever" and "Jug", 4 teams each, so `npm run dev:reset` shows the feature.
9. [x] Verify (below). Recorded in BELA_SYNC.md for D6.

**Verified (11 Oct 2026):** `npm test` (115 tests, 7 new), ESLint, `next build`, and `tsc --noEmit` with only the two
errors that were there before (`googleAuth.ts`, `players/getAll.ts`). The migration applied to a copy of production (1
league, 51 teams, nothing assigned) and to an empty database with the seed. In the browser at 1440 × 900 and
375 × 812: Create League with three conferences (duplicate name refused, color swap), Manage League (assigning on
desktop and in the phone sheet, the filter, Distribute evenly, deleting a conference with teams after the warning),
Create Round's notice, the dots on Daily (night table and round tabs), League standings, pairings, the desktop Home and
the Start Game card, the conference views on Daily's night table and League standings, and a league without
conferences unchanged.

## Tests and verification

- **Unit tests** (`src/app/_lib/__tests__/conferences.test.ts`):
  - validation: 0 or 2–6 conferences, names unique in any case, colors unique and from the palette;
  - `inConference` ranks and podium;
  - `toTableRows` with conferences;
  - `distributeEvenly` balance.
- **Checks:** `npm test`, `npm run lint` and `next build`, and `tsc --noEmit` clean on the touched files.
- **In the browser** at 375 × 812 and 1440 × 900, with the seed:
  - create a league with 3 conferences, and check the refusals;
  - assign, filter, distribute, and rename, recolor and delete a conference;
  - dots on every screen in the table above;
  - per-conference views: ranks start at 1, the podium, and the picked conference carries over between Daily and
    League standings;
  - a league without conferences is unchanged;
  - League standings still shows the dots when logged out.

## Out of scope

Pairing that takes conferences into account (D1 only adds the notice), records that count only rounds within a
conference (D2), a history of conference changes, playoffs between conferences, and conferences in the Bela app (D6).
