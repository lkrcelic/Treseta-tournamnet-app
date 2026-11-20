#!/bin/sh
# e2e/local/app.sh start|restart|stop|status <id>
# One app server and one database per suite section (E2E_SUITE_PLAN.md), so sections run side by side without
# touching each other's data: a fresh database treseta_e2e_<id> in the podman Postgres bela-e2e-pg (shared with Bela)
# with the generated world, and `next start` of the shared production build (the e2e-suite worktree) on the section's
# port. Treseta's ports (4000 …) and databases never meet Bela's (3900 …, bela_e2e_*), so both suites can run at once.
# The app's environment is e2e/local/env.e2e (made-up values; Treseta doesn't track .env).
# `restart` starts the server again on the database as it is (no new world), e.g. to pick up a change to this script.
# Its run folder (e2e/local/run/<id>/ in the caller's worktree) holds app.json, the manifest and the logs.
# Run it outside the Claude sandbox: it starts podman and talks to localhost.
set -eu

CMD=${1:-}
ID=${2:-}
[ -n "$CMD" ] && [ -n "$ID" ] || { echo "usage: e2e/local/app.sh start|restart|stop|status <id>" >&2; exit 2; }
case "$ID" in
  smoke) PORT=4000 ;;
  a) PORT=4010 ;;
  b) PORT=4011 ;;
  c[1-9]) PORT=$((4020 + ${ID#c})) ;;
  # Treseta's own sections: conferences and places
  k) PORT=4031 ;;
  l) PORT=4032 ;;
  # the whole suite on one target (e2e/run.sh, the nightly run)
  nightly) PORT=4040 ;;
  *) echo "app.sh: unknown section id '$ID' (smoke, a, b, c1 … c9, k, l, nightly)" >&2; exit 2 ;;
esac

HERE=$(git rev-parse --show-toplevel)
REPO=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
APP_DIR=${E2E_APP_DIR:-$REPO/.claude/worktrees/e2e-suite}
RUN=$HERE/e2e/local/run/$ID
CONTAINER=bela-e2e-pg
DB=treseta_e2e_$ID
mkdir -p "$RUN"

pg() { podman exec "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

# Every section's server and tests share one Postgres with Bela's suite (max_connections 100 in the running
# container), so each Prisma client gets a small pool instead of Prisma's default (2 × CPUs + 1, ~21 here): the server
# 3, the tests' `db` 2, the seed 5. A query waits up to 30 s for a free connection instead of failing at once.
urls() {
  PW=$(podman inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')
  URL="postgresql://postgres:$PW@127.0.0.1:55432/$DB"
  SERVER_URL="$URL?connection_limit=3&pool_timeout=30"
  TEST_URL="$URL?connection_limit=2&pool_timeout=30"
  SEED_URL="$URL?connection_limit=5&pool_timeout=60"
}

# `next start` of the shared build on the section's port, with the env from env.e2e; waits for /login, then writes
# app.json
serve() {
  # a plain background command (no subshell around it), so $! is the server itself and nothing keeps this
  # script's output open after it exits
  cd "$APP_DIR"
  set -a; . "$APP_DIR/e2e/local/env.e2e"; set +a
  NODE_ENV=production DATABASE_URL=$SERVER_URL DATABASE_URL_UNPOOLED=$SERVER_URL CRON_SECRET=e2e-cron NEXTAUTH_URL=http://localhost:$PORT \
    nohup "$APP_DIR/node_modules/.bin/next" start -p "$PORT" < /dev/null > "$RUN/server.log" 2>&1 &
  echo $! > "$RUN/pid"
  cd "$HERE"
  i=0
  until [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/login")" = "200" ]; do
    i=$((i + 1)); [ "$i" -ge 60 ] && { echo "app.sh: the server on $PORT doesn't answer, see $RUN/server.log" >&2; exit 1; }; sleep 1
  done
  cat > "$RUN/app.json" <<JSON
{"id": "$ID", "baseURL": "http://localhost:$PORT", "databaseUrl": "$TEST_URL", "manifest": "$RUN/seed-manifest.json"}
JSON
}

stop() {
  if [ -f "$RUN/pid" ]; then
    kill "$(cat "$RUN/pid")" 2>/dev/null || true
    rm -f "$RUN/pid"
  fi
  # a server started some other way on this port
  for p in $(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null); do kill "$p" 2>/dev/null || true; done
}

case "$CMD" in
  stop)
    stop
    echo "$ID stopped"
    ;;

  restart)
    [ -f "$RUN/seed-manifest.json" ] || { echo "app.sh: $ID has no world yet: use start" >&2; exit 1; }
    stop
    urls
    serve
    echo "$ID restarted · http://localhost:$PORT · database $DB as it was"
    ;;

  status)
    if [ -f "$RUN/pid" ] && kill -0 "$(cat "$RUN/pid")" 2>/dev/null; then state="running (pid $(cat "$RUN/pid"))"; else state="stopped"; fi
    echo "$ID: $state · http://localhost:$PORT · database $DB · run folder $RUN"
    ;;

  start)
    [ -f "$APP_DIR/.next/BUILD_ID" ] || { echo "app.sh: no production build in $APP_DIR (the lead builds it once: npx prisma generate && npx next build there)" >&2; exit 1; }
    stop

    podman machine start >/dev/null 2>&1 || true
    if ! podman container exists "$CONTAINER"; then
      podman run -d --name "$CONTAINER" -p 127.0.0.1:55432:5432 \
        -e POSTGRES_PASSWORD="$(openssl rand -hex 12)" -e POSTGRES_DB=bela_e2e \
        --tmpfs /var/lib/postgresql/data docker.io/library/postgres:17 -c max_connections=300 >/dev/null
    fi
    podman start "$CONTAINER" >/dev/null
    i=0
    until podman exec "$CONTAINER" pg_isready -U postgres -q; do
      i=$((i + 1)); [ "$i" -ge 30 ] && { echo "app.sh: $CONTAINER doesn't answer" >&2; exit 1; }; sleep 1
    done
    urls

    pg -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)"
    pg -c "CREATE DATABASE $DB"
    (cd "$APP_DIR" && DATABASE_URL=$URL DATABASE_URL_UNPOOLED=$URL npx prisma migrate deploy > "$RUN/migrate.log" 2>&1) \
      || { echo "app.sh: migrations failed, see $RUN/migrate.log" >&2; exit 1; }
    (cd "$APP_DIR" && DATABASE_URL=$SEED_URL DATABASE_URL_UNPOOLED=$SEED_URL E2E_SEED_OUT=$RUN npm run --silent seed:e2e > "$RUN/seed.log" 2>&1) \
      || { echo "app.sh: seed failed, see $RUN/seed.log" >&2; exit 1; }

    serve
    echo "$ID ready · http://localhost:$PORT · database $DB · $(tail -1 "$RUN/seed.log")"
    ;;

  *)
    echo "usage: e2e/local/app.sh start|restart|stop|status <id>" >&2; exit 2 ;;
esac
