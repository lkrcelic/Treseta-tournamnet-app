# Section A

**Area:** `e2e/tests/smoke/a-*.spec.ts` · **helper file:** `e2e/helpers/a.ts` · **app id:** `a`

Every page as guest, player, organizer and admin, on the phone and the desktop, is healthy.

Read `e2e/sekcije/README.md` first: where you work, how tests are written here, what "done" means and the report.

## Flows to cover
- List the app's pages from `src/app/**/page.tsx` (about 40), with real ids from the world for the dynamic ones.
- For each page × role × project (`mobitel`, `racunalo`): no 5xx, no error screen, no console error or page error, no horizontal scroll on the phone, and no `undefined`, `NaN` or `Invalid Date` in the page text. A page a role may not open redirects or says so, the same way every time.
- Record each page's response time; the report lists the 10 slowest (information only, never a failure).
- Data-driven: one table of pages and roles, one generated test per row, so a new page is one line.

## Notes
You own `e2e/helpers/health.ts` from the start: extend it (scroll check, text check) for everyone.
