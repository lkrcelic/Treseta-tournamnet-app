# Trešeta Liga

The Trešeta league app: rounds and pairings, the scorepad at the table, daily and season standings, player ratings,
and the admin screens to run a league night. Next.js 14 (App Router), Prisma on Postgres, MUI.

## Running it locally

```bash
cp .env.example .env    # then point DATABASE_URL at a local Postgres
npm install
npm run dev:reset       # migrates, seeds the users admin / player (password: sifra) and a league, starts the app
```

- `npm run dev` applies new migrations and starts the app, keeping the data.
- `npm test` runs the unit tests (`src/app/_lib/__tests__`).
- `npm run ratings:replay` recomputes every player's rating (dry run; add `-- --apply` to write).

## Shared code with the Bela app

Most of the code is the Bela app's (`../Bela-Treseta-Tournamnet-app`, "Piatnik Bela Liga"), with Treseta's game rules:
11 points a hand (or a custom hand), matches to 41, two matches a round. **Synced from the Bela app at `4bf68ad`
(8 Oct 2026).**

What differs from the Bela app:

- **Game rules:** `src/app/_lib/game/scoring.ts`, used by the keypad and by the API.
- **Hands:** the `Result` / `OngoingResult` tables, their services, routes and stores, and the one-step hand entry
  (`ongoing-match/…`). See the game-layer table in [TRANSITION_PLAN.md](TRANSITION_PLAN.md).
- **Branding:** `src/app/_lib/brand.ts`, `public/manifest.webmanifest`, `public/icons/`.
- **Data:** this app's own migrations in `prisma/migrations`.

Everything else is meant to stay identical to the Bela app. To bring over a Bela fix that touches only shared files:

```bash
git remote add bela ../Bela-Treseta-Tournamnet-app   # once
git fetch bela && git cherry-pick <commit>
```

Then update the commit above.
