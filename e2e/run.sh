#!/bin/sh
# e2e/run.sh [--sha <sha>] [--data seed]
# The whole suite on one target, for the nightly run (rutine/treseta-e2e-nightly.md). Run it from a worktree checked
# out at the target, outside the Claude sandbox (podman, localhost). It
#   1. builds the app there, as Vercel does (next build, with the suite's made-up env from e2e/local/env.e2e);
#   2. starts it on a fresh database with the generated world: e2e/local/app.sh, id "nightly", port 4040,
#      database treseta_e2e_nightly, so it never meets a section's server or Bela's suite;
#   3. runs every test of both projects (mobitel, racunalo) with one retry, so a test that passes only on its retry is
#      flaky, not failed;
#   4. takes the server and the database down again, also when something fails.
# The report is e2e/report/: run.log (Playwright's list, its last lines the counts: passed, failed, flaky), html/
# (Playwright's report), results/ (a failed test's screenshot, trace and error), build.log and server.log.
# It needs node_modules with the Prisma client generated for this checkout's schema, and Chromium for Playwright
# (npx playwright install chromium). Exit code: Playwright's, 0 when every test passed (a test.fail() that fails as
# expected counts as passed), 1 when a test failed or the build or the world couldn't be made.
set -eu

SHA=""
DATA=seed
while [ $# -gt 0 ]; do
  case "$1" in
    --sha) SHA=${2:-}; shift 2 ;;
    --data) DATA=${2:-}; shift 2 ;;
    *) echo "usage: e2e/run.sh [--sha <sha>] [--data seed]" >&2; exit 2 ;;
  esac
done
# the generated world is the only data the suite knows (e2e/seed/)
[ "$DATA" = seed ] || { echo "run.sh: --data $DATA: only seed (the generated world) is supported" >&2; exit 2; }

HERE=$(git rev-parse --show-toplevel)
cd "$HERE"
HEAD=$(git rev-parse HEAD)
if [ -n "$SHA" ]; then
  case "$HEAD" in
    "$SHA"*) ;;
    *) echo "run.sh: this checkout is at $(git rev-parse --short HEAD), not $SHA" >&2; exit 2 ;;
  esac
fi

ID=nightly
RUN=$HERE/e2e/local/run/$ID
REPORT=$HERE/e2e/report
rm -rf "$REPORT"
mkdir -p "$REPORT"

echo "run.sh: building $(git rev-parse --short HEAD)"
if ! (set -a; . "$HERE/e2e/local/env.e2e"; set +a; npx next build) > "$REPORT/build.log" 2>&1; then
  echo "run.sh: the build failed, see $REPORT/build.log" >&2
  exit 1
fi

down() {
  E2E_APP_DIR=$HERE "$HERE/e2e/local/app.sh" stop "$ID" > /dev/null 2>&1 || true
  podman exec bela-e2e-pg psql -U postgres -q -c "DROP DATABASE IF EXISTS treseta_e2e_$ID WITH (FORCE)" > /dev/null 2>&1 || true
  [ -f "$RUN/server.log" ] && cp "$RUN/server.log" "$REPORT/server.log" || true
}
trap down EXIT INT TERM

E2E_APP_DIR=$HERE "$HERE/e2e/local/app.sh" start "$ID"

status=0
E2E_ID=$ID E2E_RETRIES=1 npx playwright test -c e2e > "$REPORT/run.log" 2>&1 || status=$?
[ -d "$RUN/report" ] && cp -R "$RUN/report" "$REPORT/html"
[ -d "$RUN/results" ] && cp -R "$RUN/results" "$REPORT/results"
tail -n 25 "$REPORT/run.log"
echo "run.sh: report in $REPORT (exit $status)"
exit "$status"
