#!/bin/sh
# Checks a built image of the API: what it must hold, then that it starts.
#
#   .github/scripts/image-smoke.sh <image> [--no-start]
#
# Run from the root of the repository (the image is compared with the
# sources). The start-up test runs the image against a throwaway PostgreSQL
# and Redis, on a Docker network of its own, and removes everything after.
set -eu

IMAGE=${1:?image to check}
START=1
[ "${2:-}" != "--no-start" ] || START=0

fail() { echo "FAILED: $*" >&2; exit 1; }
inside() { docker run --rm --entrypoint sh "$IMAGE" -c "$1"; }

echo "== Content of $IMAGE"
inside 'test -f dist/src/main.js' || fail "dist/src/main.js is missing (the entry point of the image)"
inside 'test -f dist/src/db/run-seeders.js' || fail "dist/src/db/run-seeders.js is missing (the seeders)"

expected=$(find src/migrations -name '*.ts' | wc -l | tr -d ' ')
found=$(inside 'find dist/src/migrations -name "*.js" | wc -l' | tr -d ' ')
[ "$expected" -gt 0 ] || fail "no migration in src/migrations: run this from the root of the repository"
[ "$found" -eq "$expected" ] || fail "$found migrations in the image, $expected in the sources"
echo "migrations: $found"

expected=$(find src/modules/templates -name '*.hbs' | wc -l | tr -d ' ')
found=$(inside 'find dist/src/modules/templates -name "*.hbs" | wc -l' | tr -d ' ')
[ "$expected" -gt 0 ] || fail "no e-mail template in src/modules/templates"
[ "$found" -eq "$expected" ] || fail "$found e-mail templates in the image, $expected in the sources"
echo "e-mail templates: $found"

inside 'test -s dist/src/modules/flights/data/airports.json' || fail "the aerodrome data is missing"
inside 'test -s dist/src/modules/navdata/data/navdata-baseline.json.gz' ||
  fail "the baseline navigation data of the flight preparation is missing (dist/src/modules/navdata/data)"
[ "$(inside 'find dist -name "*.spec.js" | wc -l' | tr -d ' ')" -eq 0 ] || fail "test files were built into the image"
[ "$(inside 'id -u')" != 0 ] || fail "the image runs as root"

# Every module resolves with the production dependencies alone.
inside 'node -e "require(\"./dist/src/app.module.js\")"' || fail "the compiled application does not load"
echo "the compiled application loads"

[ $START -eq 1 ] || exit 0

echo "== Start-up of $IMAGE"
ID=skycrew-smoke-$$
cleanup() {
  status=$?
  trap - EXIT
  docker rm -f "$ID-api" "$ID-db" "$ID-redis" >/dev/null 2>&1 || true
  docker network rm "$ID" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker network create "$ID" >/dev/null
docker run -d --name "$ID-db" --network "$ID" \
  -e POSTGRES_USER=skycrew -e POSTGRES_PASSWORD=smoke -e POSTGRES_DB=skycrew postgres:16-alpine >/dev/null
docker run -d --name "$ID-redis" --network "$ID" redis:7-alpine >/dev/null

i=0
until docker exec "$ID-db" pg_isready -q -U skycrew -d skycrew; do
  i=$((i + 1)); [ $i -lt 30 ] || fail "the database did not start"
  sleep 2
done

# As the deployment kit runs it: production mode, an empty database, the
# migrations and the first administrator created at start-up.
docker run -d --name "$ID-api" --network "$ID" \
  -e NODE_ENV=production -e PORT=3000 \
  -e BASE_URL=http://localhost:3000 -e FRONTEND_URL=http://localhost:3000 -e ALLOWED_ORIGINS=http://localhost:3000 \
  -e DATABASE_URL="postgresql://skycrew:smoke@$ID-db:5432/skycrew" \
  -e DB_HOST="$ID-db" -e DB_PORT=5432 -e DB_NAME=skycrew -e DB_USER=skycrew -e DB_PASSWORD=smoke \
  -e DB_SYNCHRONIZE=false -e REDIS_HOST="$ID-redis" -e REDIS_PORT=6379 \
  -e JWT_SECRET=smoke-test-secret-not-for-production-0123456789 -e DEMO_MODE=false -e ENABLE_SWAGGER=false \
  -e SEED_ON_START=true -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD='Smoke-test-1234!' \
  "$IMAGE" >/dev/null

i=0
while :; do
  state=$(docker inspect -f '{{.State.Status}}' "$ID-api")
  if [ "$state" = running ] && docker exec "$ID-api" wget -q -O /dev/null http://localhost:3000/health/ready 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  if [ "$state" != running ] || [ $i -ge 40 ]; then
    docker logs --tail 60 "$ID-api" >&2 || true
    fail "the API did not answer on /health/ready (container: $state)"
  fi
  sleep 3
done

applied=$(docker exec "$ID-db" psql -At -U skycrew -d skycrew -c 'SELECT count(*) FROM migrations')
[ "$applied" -gt 0 ] || fail "no migration was applied to the empty database"
echo "the API answers on /health/ready (database reached), $applied migrations applied to an empty database"

# The flight preparation needs its aerodromes: the baseline is imported at start-up.
i=0
until [ "$(docker exec "$ID-db" psql -At -U skycrew -d skycrew -c "SELECT count(*) FROM navdata_cycles WHERE status = 'ACTIVE'" 2>/dev/null)" = 1 ]; do
  i=$((i + 1))
  if [ $i -ge 20 ]; then
    docker logs --tail 40 "$ID-api" >&2 || true
    fail "no active navigation data after start-up: the baseline aerodromes were not imported"
  fi
  sleep 3
done
points=$(docker exec "$ID-db" psql -At -U skycrew -d skycrew -c "SELECT count(*) FROM nav_points")
echo "navigation data imported at start-up: $points points"
