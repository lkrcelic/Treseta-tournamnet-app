# Trešeta Liga

The Trešeta league app: rounds and pairings, the scorepad at the table, daily and season standings, player ratings,
and the admin screens to run a league night. Next.js 14 (App Router), Prisma on Postgres, MUI.

## Running it locally

```bash
cp .env.example .env    # then point DATABASE_URL and DATABASE_URL_UNPOOLED at a local Postgres
npm install
npm run dev:reset       # migrates, seeds the users admin / player (password: sifra) and a league, starts the app
```

- `npm run dev` applies new migrations and starts the app, keeping the data.
- `npm test` runs the unit tests (`src/app/_lib/__tests__`).
- `npm run ratings:replay` recomputes every player's rating (dry run; add `-- --apply` to write).

## Shared code with the Bela app

Most of the code is the Bela app's (`../Bela-Treseta-Tournamnet-app`, "Piatnik Bela Liga"), with Treseta's game rules:
11 points a hand (or a custom hand), matches to 41, two matches a round.

The Bela app is primary. A scheduled Claude Code task brings its new commits here every night at 04:00, onto the branch
`bela-sync`, and keeps what Treseta does differently. [BELA_SYNC.md](BELA_SYNC.md) has the Bela commit it has
reached, how to take a night's sync, and the full list of differences. A new difference goes there too.
