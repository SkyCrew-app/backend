#!/bin/sh
# Puts released versions of SkyCrew on a server, in one command, and goes back
# to the previous versions by itself if the new ones do not come up healthy.
#
#   deploy/release-to-server.sh <ssh-host> [--club <slug>] [--backend 2.13.0] [--frontend 2.10.0]
#   deploy/release-to-server.sh --dry-run  [--backend 2.13.0] [--frontend 2.10.0]
#
# The images are built here from the version tags and copied over SSH, so the
# server needs no access to the registry. Run it from the backend repository.
# With --dry-run the images are built and nothing else happens: the server is
# never contacted. The script stops at the first step that fails, shows the
# end of what that step printed and exits with a status other than 0.
# With --club, the installation of that club (made by new-club.sh) is updated,
# and only it: /opt/skycrew-<slug>, backed up by skycrew-backup-<slug>. The
# images are shared by the clubs of a server; each club keeps its versions.
# Settings, through the environment:
#   FRONTEND_DIR   checkout of the frontend repository   (default ../frontend)
#   FRONTEND_ENV   file holding the NEXT_PUBLIC_* keys    (default $FRONTEND_DIR/.env)
#   DEPLOY_DIR     folder of the deployment on the server (default /opt/skycrew, or /opt/skycrew-<slug> with --club)
#   BACKUP_CMD     backup run on the server first         (default /usr/local/sbin/skycrew-backup, or
#                  /usr/local/sbin/skycrew-backup-<slug> with --club; set to `none` to go without)
#   SSH            command used to reach the server       (default ssh)
#   PLATFORM       platform of the server                 (default linux/amd64)
#   LOG_LINES      lines shown of a step that failed      (default 40)
#   HEALTH_WAIT, REGISTRY, SKIP_BUILD, COPY_IMAGES: see release-lib.sh
# To update every club of every server at once, see clubs.sh.
set -eu

usage() { sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'; exit 64; }

HOST=""; BACKEND_VERSION=""; FRONTEND_VERSION=""; DRY_RUN=0; CLUB=""
while [ $# -gt 0 ]; do
  case $1 in
    --club) [ $# -ge 2 ] || usage; CLUB=$2; shift 2 ;;
    --backend) [ $# -ge 2 ] || usage; BACKEND_VERSION=$2; shift 2 ;;
    --frontend) [ $# -ge 2 ] || usage; FRONTEND_VERSION=$2; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -*) usage ;;
    *) [ -z "$HOST" ] || usage; HOST=$1; shift ;;
  esac
done
[ -n "$BACKEND_VERSION$FRONTEND_VERSION" ] || usage
[ -n "$HOST" ] || [ $DRY_RUN -eq 1 ] || usage
[ -z "$CLUB" ] || printf '%s' "$CLUB" | grep -Eq '^[a-z][a-z0-9-]{1,29}[a-z0-9]$' || usage

BACKEND_DIR=$(cd "$(dirname "$0")/.." && pwd)
DEPLOY_DIR=${DEPLOY_DIR:-/opt/skycrew${CLUB:+-$CLUB}}
BACKUP_CMD=${BACKUP_CMD:-/usr/local/sbin/skycrew-backup${CLUB:+-$CLUB}}

say() { printf '\n== %s\n' "$*"; }

# Stops everything: the message goes last, where it is read first.
fail() { printf '\nFAILED: %s\nNothing further was done.\n' "$*" >&2; exit 1; }

# shellcheck source=deploy/release-lib.sh
. "$BACKEND_DIR/deploy/release-lib.sh"
release_init

build_images "$BACKEND_VERSION" "$FRONTEND_VERSION"

if [ $DRY_RUN -eq 1 ]; then
  say "Dry run: the images build, the server was not contacted"
  exit 0
fi

backup_club "$HOST" "$BACKUP_CMD" ||
  fail "the backup on $HOST did not complete: the versions were not changed"

copy_images "$HOST" "$BACKEND_VERSION" "$FRONTEND_VERSION"

switch_club "$HOST" "$DEPLOY_DIR" "$BACKEND_VERSION" "$FRONTEND_VERSION" ||
  fail "the new versions are not running on the server: read the lines above"

say "Done"
