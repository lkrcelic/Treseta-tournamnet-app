# Section B

**Area:** `e2e/tests/dozvole/b-*.spec.ts` · **helper file:** `e2e/helpers/b.ts` · **app id:** `b`

Every API route answers each role as `_lib/auth/permissions.ts` says: on the live server, not only statically.

Read `e2e/sekcije/README.md` first: where you work, how tests are written here, what "done" means and the report.

## Flows to cover
- Build the table of routes × roles (guest, player, organizer, admin) and the expected status from the code: `src/app/_lib/auth/permissions.ts`, the guards (`adminGuards.test.ts` checks them statically), the route handlers. About 95 routes.
- For each row: call the route with the role's session (`request` with the role's cookies) and a harmless body; assert the status (401/403 refusal, or not refused). For routes that change data, an allowed role is checked with a request that fails validation (400/422), so nothing changes.
- Data-driven like A: one table, one generated test per row.
