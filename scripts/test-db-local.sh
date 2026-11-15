#!/bin/sh
# npm run test:db:local — the db tests (npm run test:db) on a fresh database in the local podman Postgres
# `bela-e2e-pg` (127.0.0.1:55432), dropped again at the end, also when a test fails. Never touches Neon.
# Runs outside the Claude sandbox: it starts podman and talks to localhost.
set -eu

CONTAINER=bela-e2e-pg
podman machine start >/dev/null 2>&1 || true

if ! podman container exists "$CONTAINER"; then
  # postgres:17 like production; data on tmpfs, so nothing survives a stop
  podman run -d --name "$CONTAINER" -p 127.0.0.1:55432:5432 \
    -e POSTGRES_PASSWORD="$(openssl rand -hex 12)" -e POSTGRES_DB=bela_e2e \
    --tmpfs /var/lib/postgresql/data docker.io/library/postgres:17 >/dev/null
fi
podman start "$CONTAINER" >/dev/null

i=0
until podman exec "$CONTAINER" pg_isready -U postgres -q; do
  i=$((i + 1))
  [ "$i" -ge 30 ] && { echo "test:db:local: $CONTAINER doesn't answer after 30 s" >&2; exit 1; }
  sleep 1
done

PW=$(podman inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')
NAME="bela_testdb_$$"
URL="postgresql://postgres:$PW@127.0.0.1:55432/$NAME"

drop() { podman exec "$CONTAINER" psql -U postgres -q -c "DROP DATABASE IF EXISTS $NAME WITH (FORCE)" >/dev/null 2>&1 || true; }
trap drop EXIT INT TERM

podman exec "$CONTAINER" psql -U postgres -q -c "CREATE DATABASE $NAME"
DATABASE_URL=$URL DATABASE_URL_UNPOOLED=$URL npx prisma migrate deploy >/dev/null
DATABASE_URL=$URL DATABASE_URL_UNPOOLED=$URL npm run test:db
