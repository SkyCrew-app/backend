#!/bin/sh
# Puts released versions of SkyCrew on a server, in one command, and goes back
# to the previous versions by itself if the new ones do not come up healthy.
#
#   deploy/release-to-server.sh <ssh-host> [--backend 2.13.0] [--frontend 2.10.0]
#   deploy/release-to-server.sh --dry-run  [--backend 2.13.0] [--frontend 2.10.0]
#
# The images are built here from the version tags and copied over SSH, so the
# server needs no access to the registry. Run it from the backend repository.
# With --dry-run the images are built and nothing else happens: the server is
# never contacted. The script stops at the first step that fails, shows the
# end of what that step printed and exits with a status other than 0.
# Settings, through the environment:
#   FRONTEND_DIR   checkout of the frontend repository   (default ../frontend)
#   FRONTEND_ENV   file holding the NEXT_PUBLIC_* keys    (default $FRONTEND_DIR/.env)
#   DEPLOY_DIR     folder of the deployment on the server (default /opt/skycrew)
#   BACKUP_CMD     backup run on the server first         (default /usr/local/sbin/skycrew-backup; set to `none` to go without)
#   PLATFORM       platform of the server                 (default linux/amd64)
#   LOG_LINES      lines shown of a step that failed      (default 40)
set -eu

usage() { sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 64; }

HOST=""; BACKEND_VERSION=""; FRONTEND_VERSION=""; DRY_RUN=0
while [ $# -gt 0 ]; do
  case $1 in
    --backend) [ $# -ge 2 ] || usage; BACKEND_VERSION=$2; shift 2 ;;
    --frontend) [ $# -ge 2 ] || usage; FRONTEND_VERSION=$2; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -*) usage ;;
    *) [ -z "$HOST" ] || usage; HOST=$1; shift ;;
  esac
done
[ -n "$BACKEND_VERSION$FRONTEND_VERSION" ] || usage
[ -n "$HOST" ] || [ $DRY_RUN -eq 1 ] || usage

BACKEND_DIR=$(cd "$(dirname "$0")/.." && pwd)
FRONTEND_DIR=${FRONTEND_DIR:-$BACKEND_DIR/../frontend}
FRONTEND_ENV=${FRONTEND_ENV:-$FRONTEND_DIR/.env}
DEPLOY_DIR=${DEPLOY_DIR:-/opt/skycrew}
BACKUP_CMD=${BACKUP_CMD:-/usr/local/sbin/skycrew-backup}
PLATFORM=${PLATFORM:-linux/amd64}
LOG_LINES=${LOG_LINES:-40}
REGISTRY=ghcr.io/skycrew-app

WORK=$(mktemp -d)
# Leaves with the status of what failed, whatever the tidying up returns.
cleanup() {
  status=$?
  trap - EXIT
  for repo in "$BACKEND_DIR" "$FRONTEND_DIR"; do
    [ -d "$repo/.git" ] || [ -f "$repo/.git" ] || continue
    git -C "$repo" worktree remove --force "$WORK/$(basename "$repo")" 2>/dev/null || true
  done
  rm -rf "$WORK"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

say() { printf '\n== %s\n' "$*"; }

# Stops everything: the message goes last, where it is read first.
fail() { printf '\nFAILED: %s\nNothing further was done.\n' "$*" >&2; exit 1; }

# Reads one NEXT_PUBLIC_* value from the frontend environment file.
public_key() {
  [ -f "$FRONTEND_ENV" ] || return 0
  grep "^$1=" "$FRONTEND_ENV" | cut -d= -f2- | tr -d '"' || true
}

build() { # <name> <repository> <version> [docker build arguments]
  name=$1; repo=$2; version=$3; shift 3
  [ -d "$repo/.git" ] || [ -f "$repo/.git" ] || fail "$name: no git repository at $repo"
  git -C "$repo" fetch -q --tags ||
    echo "$name: the tags could not be fetched, using the ones already here" >&2
  git -C "$repo" rev-parse -q --verify "refs/tags/$version" >/dev/null ||
    fail "$name: no tag $version in $repo"

  say "Building $name $version"
  source_dir=$WORK/$(basename "$repo")
  git -C "$repo" worktree add -q --detach "$source_dir" "$version" ||
    fail "$name: the sources of $version could not be checked out"

  # The whole output is kept in a file; only a failure shows it.
  log=$WORK/build-$name.log
  build_status=0
  docker build --progress=plain --platform "$PLATFORM" -t "$REGISTRY/$name:$version" "$@" "$source_dir" \
    >"$log" 2>&1 || build_status=$?
  if [ "$build_status" -ne 0 ]; then
    tmp=${TMPDIR:-/tmp}; kept=${tmp%/}/skycrew-build-$name-$version.log
    cp "$log" "$kept" 2>/dev/null || kept=""
    {
      printf '\n-- last %s lines of the build of %s %s --\n' "$LOG_LINES" "$name" "$version"
      tail -n "$LOG_LINES" "$log"
      printf -- '-- end --\n'
      [ -z "$kept" ] || printf 'Whole build output: %s\n' "$kept"
    } >&2
    fail "the image of $name $version did not build (docker build ended with status $build_status)"
  fi
  docker image inspect "$REGISTRY/$name:$version" >/dev/null 2>&1 ||
    fail "the image of $name $version is missing after its build"
  echo "built $REGISTRY/$name:$version"
}

[ -z "$BACKEND_VERSION" ] || build backend "$BACKEND_DIR" "$BACKEND_VERSION"
[ -z "$FRONTEND_VERSION" ] || build frontend "$FRONTEND_DIR" "$FRONTEND_VERSION" \
  --build-arg NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="$(public_key NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)" \
  --build-arg NEXT_PUBLIC_OPENWEATHERMAP_API_KEY="$(public_key NEXT_PUBLIC_OPENWEATHERMAP_API_KEY)" \
  --build-arg NEXT_PUBLIC_OPENAIP_API_KEY="$(public_key NEXT_PUBLIC_OPENAIP_API_KEY)"

if [ $DRY_RUN -eq 1 ]; then
  say "Dry run: the images build, the server was not contacted"
  exit 0
fi

say "Backing up on $HOST"
# The backup command belongs to root: its presence is checked as root too.
if [ "$BACKUP_CMD" = none ]; then
  echo "skipped on request"
else
  # shellcheck disable=SC2029
  ssh "$HOST" "if sudo test -x '$BACKUP_CMD'; then sudo '$BACKUP_CMD' && echo 'backup done'; else echo 'no backup command at $BACKUP_CMD: stopping' >&2; exit 1; fi" ||
    fail "the backup on $HOST did not complete: the versions were not changed"
fi

for image in ${BACKEND_VERSION:+backend:$BACKEND_VERSION} ${FRONTEND_VERSION:+frontend:$FRONTEND_VERSION}; do
  say "Copying $image"
  # Written to a file first: in a pipe, a failed export would go unnoticed.
  archive=$WORK/image.tar.gz
  docker save "$REGISTRY/$image" >"$WORK/image.tar" || fail "the image $image could not be exported"
  gzip -c "$WORK/image.tar" >"$archive" || fail "the image $image could not be compressed"
  rm -f "$WORK/image.tar"
  ssh "$HOST" 'gunzip | sudo docker load' <"$archive" ||
    fail "the image $image could not be loaded on $HOST: the versions were not changed"
  rm -f "$archive"
done

say "Switching versions"
# shellcheck disable=SC2029
ssh "$HOST" "sudo sh -s -- '$DEPLOY_DIR' '$BACKEND_VERSION' '$FRONTEND_VERSION'" <<'REMOTE' || fail "the new versions are not running on the server: read the lines above"
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
if ! docker compose config -q; then
  set_versions "$old_backend" "$old_frontend"
  echo "the configuration is not valid with the new versions: nothing was restarted" >&2
  exit 1
fi
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
