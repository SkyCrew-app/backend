#!/bin/sh
# Puts released versions of SkyCrew on a server, in one command, and goes back
# to the previous versions by itself if the new ones do not come up healthy.
#
#   deploy/release-to-server.sh <ssh-host> [--backend 2.13.0] [--frontend 2.10.0]
#
# The images are built here from the version tags and copied over SSH, so the
# server needs no access to the registry. Run it from the backend repository.
# Settings, through the environment:
#   FRONTEND_DIR   checkout of the frontend repository   (default ../frontend)
#   FRONTEND_ENV   file holding the NEXT_PUBLIC_* keys    (default $FRONTEND_DIR/.env)
#   DEPLOY_DIR     folder of the deployment on the server (default /opt/skycrew)
#   BACKUP_CMD     backup run on the server first         (default /usr/local/sbin/skycrew-backup; set to `none` to go without)
#   PLATFORM       platform of the server                 (default linux/amd64)
set -eu

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 64; }

[ $# -ge 1 ] || usage
HOST=$1; shift
BACKEND_VERSION=""; FRONTEND_VERSION=""
while [ $# -gt 0 ]; do
  case $1 in
    --backend) BACKEND_VERSION=${2:?version missing}; shift 2 ;;
    --frontend) FRONTEND_VERSION=${2:?version missing}; shift 2 ;;
    *) usage ;;
  esac
done
[ -n "$BACKEND_VERSION$FRONTEND_VERSION" ] || usage

BACKEND_DIR=$(cd "$(dirname "$0")/.." && pwd)
FRONTEND_DIR=${FRONTEND_DIR:-$BACKEND_DIR/../frontend}
FRONTEND_ENV=${FRONTEND_ENV:-$FRONTEND_DIR/.env}
DEPLOY_DIR=${DEPLOY_DIR:-/opt/skycrew}
BACKUP_CMD=${BACKUP_CMD:-/usr/local/sbin/skycrew-backup}
PLATFORM=${PLATFORM:-linux/amd64}
REGISTRY=ghcr.io/skycrew-app

WORK=$(mktemp -d)
cleanup() {
  for repo in "$BACKEND_DIR" "$FRONTEND_DIR"; do
    [ -d "$repo/.git" ] || [ -f "$repo/.git" ] || continue
    git -C "$repo" worktree remove --force "$WORK/$(basename "$repo")" 2>/dev/null || true
  done
  rm -rf "$WORK"
}
trap cleanup EXIT

say() { printf '\n== %s\n' "$*"; }

# Reads one NEXT_PUBLIC_* value from the frontend environment file.
public_key() { [ -f "$FRONTEND_ENV" ] && grep "^$1=" "$FRONTEND_ENV" | cut -d= -f2- | tr -d '"' || true; }

build() { # <name> <repository> <version> [docker build arguments]
  name=$1; repo=$2; version=$3; shift 3
  git -C "$repo" fetch -q --tags
  git -C "$repo" rev-parse -q --verify "refs/tags/$version" >/dev/null ||
    { echo "$name: no tag $version" >&2; exit 1; }
  say "Building $name $version"
  git -C "$repo" worktree add -q --detach "$WORK/$(basename "$repo")" "$version"
  docker build -q --platform "$PLATFORM" -t "$REGISTRY/$name:$version" "$@" "$WORK/$(basename "$repo")" >/dev/null
}

[ -z "$BACKEND_VERSION" ] || build backend "$BACKEND_DIR" "$BACKEND_VERSION"
[ -z "$FRONTEND_VERSION" ] || build frontend "$FRONTEND_DIR" "$FRONTEND_VERSION" \
  --build-arg NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="$(public_key NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)" \
  --build-arg NEXT_PUBLIC_OPENWEATHERMAP_API_KEY="$(public_key NEXT_PUBLIC_OPENWEATHERMAP_API_KEY)" \
  --build-arg NEXT_PUBLIC_OPENAIP_API_KEY="$(public_key NEXT_PUBLIC_OPENAIP_API_KEY)"

say "Backing up on $HOST"
# shellcheck disable=SC2029
# The backup command belongs to root: its presence is checked as root too.
if [ "$BACKUP_CMD" = none ]; then
  echo "skipped on request"
else
  ssh "$HOST" "if sudo test -x '$BACKUP_CMD'; then sudo '$BACKUP_CMD' && echo 'backup done'; else echo 'no backup command at $BACKUP_CMD: stopping' >&2; exit 1; fi"
fi

for image in ${BACKEND_VERSION:+backend:$BACKEND_VERSION} ${FRONTEND_VERSION:+frontend:$FRONTEND_VERSION}; do
  say "Copying $image"
  docker save "$REGISTRY/$image" | gzip | ssh "$HOST" 'gunzip | sudo docker load'
done

say "Switching versions"
# shellcheck disable=SC2029
ssh "$HOST" "sudo sh -s -- '$DEPLOY_DIR' '$BACKEND_VERSION' '$FRONTEND_VERSION'" <<'REMOTE'
set -eu
cd "$1"; new_backend=$2; new_frontend=$3

current() { grep "^$1=" .env | cut -d= -f2-; }
old_backend=$(current BACKEND_VERSION); old_frontend=$(current FRONTEND_VERSION)

set_versions() {
  [ -z "$1" ] || sed -i "s/^BACKEND_VERSION=.*/BACKEND_VERSION=$1/" .env
  [ -z "$2" ] || sed -i "s/^FRONTEND_VERSION=.*/FRONTEND_VERSION=$2/" .env
}

healthy() { # waits up to two minutes for both services
  i=0
  while [ $i -lt 40 ]; do
    ok=1
    for service in backend frontend; do
      id=$(docker compose ps -q "$service")
      [ "$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" = healthy ] || ok=0
    done
    [ $ok -eq 1 ] && return 0
    i=$((i + 1)); sleep 3
  done
  return 1
}

set_versions "$new_backend" "$new_frontend"
docker compose config -q
docker compose up -d >/dev/null 2>&1 || true

if healthy; then
  echo "running: backend $(current BACKEND_VERSION), frontend $(current FRONTEND_VERSION)"
  exit 0
fi

echo "new versions did not come up healthy, going back to backend $old_backend, frontend $old_frontend" >&2
docker compose logs --tail 40 backend frontend >&2 || true
set_versions "$old_backend" "$old_frontend"
docker compose up -d >/dev/null 2>&1 || true
healthy && echo "previous versions are running again" >&2 || echo "previous versions are NOT healthy either: check the server" >&2
exit 1
REMOTE

say "Done"
