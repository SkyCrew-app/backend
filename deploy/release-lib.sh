# Shared by release-to-server.sh and clubs.sh: builds the images from the
# version tags, copies them to a server, backs a club up and switches its
# versions, going back by itself when the new ones do not come up healthy.
# Sourced, not run. The caller defines say() and fail(), sets BACKEND_DIR,
# then calls release_init.
# Settings, through the environment:
#   FRONTEND_DIR   checkout of the frontend repository   (default ../frontend)
#   FRONTEND_ENV   file holding the NEXT_PUBLIC_* keys    (default $FRONTEND_DIR/.env)
#   SSH            command used to reach the server       (default ssh)
#   PLATFORM       platform of the server                 (default linux/amd64)
#   LOG_LINES      lines shown of a step that failed      (default 40)
#   HEALTH_WAIT    seconds given to the new versions to come up healthy (default 120)
#   REGISTRY       name of the images                     (default ghcr.io/skycrew-app)
#   SKIP_BUILD     1: use the images already built on this machine (for
#                  instance by a --dry-run just before) instead of building them
#   COPY_IMAGES    always: copy the images even when the server already has them

release_init() {
  FRONTEND_DIR=${FRONTEND_DIR:-$BACKEND_DIR/../frontend}
  FRONTEND_ENV=${FRONTEND_ENV:-$FRONTEND_DIR/.env}
  SSH=${SSH:-ssh}
  PLATFORM=${PLATFORM:-linux/amd64}
  LOG_LINES=${LOG_LINES:-40}
  HEALTH_WAIT=${HEALTH_WAIT:-120}
  REGISTRY=${REGISTRY:-ghcr.io/skycrew-app}
  SKIP_BUILD=${SKIP_BUILD:-0}
  COPY_IMAGES=${COPY_IMAGES:-}
  WORK=$(mktemp -d)
  trap release_cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

# Leaves with the status of what failed, whatever the tidying up returns.
release_cleanup() {
  status=$?
  trap - EXIT
  for repo in "$BACKEND_DIR" "$FRONTEND_DIR"; do
    [ -d "$repo/.git" ] || [ -f "$repo/.git" ] || continue
    git -C "$repo" worktree remove --force "$WORK/$(basename "$repo")" 2>/dev/null || true
  done
  rm -rf "$WORK"
  exit "$status"
}

# Reads one NEXT_PUBLIC_* value from the frontend environment file.
public_key() {
  [ -f "$FRONTEND_ENV" ] || return 0
  grep "^$1=" "$FRONTEND_ENV" | cut -d= -f2- | tr -d '"' || true
}

# Checks that a version tag exists, after fetching the tags. <name> <repository> <version>
check_tag() {
  [ -d "$2/.git" ] || [ -f "$2/.git" ] || fail "$1: no git repository at $2"
  git -C "$2" fetch -q --tags ||
    echo "$1: the tags could not be fetched, using the ones already here" >&2
  git -C "$2" rev-parse -q --verify "refs/tags/$3" >/dev/null ||
    fail "$1: no tag $3 in $2"
}

build_image() { # <name> <repository> <version> [docker build arguments]
  name=$1; repo=$2; version=$3; shift 3
  if [ "$SKIP_BUILD" = 1 ]; then
    docker image inspect "$REGISTRY/$name:$version" >/dev/null 2>&1 ||
      fail "$name: SKIP_BUILD=1 but there is no image $REGISTRY/$name:$version on this machine"
    echo "using $REGISTRY/$name:$version already built here"
    return 0
  fi
  check_tag "$name" "$repo" "$version"

  say "Building $name $version"
  source_dir=$WORK/$(basename "$repo")
  git -C "$repo" worktree add -q --detach "$source_dir" "$version" ||
    fail "$name: the sources of $version could not be checked out"

  # The whole output is kept in a file; only a failure shows it.
  log=$WORK/build-$name.log
  build_status=0
  docker build --progress=plain --platform "$PLATFORM" -t "$REGISTRY/$name:$version" "$@" "$source_dir" \
    >"$log" 2>&1 || build_status=$?
  git -C "$repo" worktree remove --force "$source_dir" 2>/dev/null || true
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

build_images() { # <backend version or ""> <frontend version or "">
  [ -z "$1" ] || build_image backend "$BACKEND_DIR" "$1"
  [ -z "$2" ] || build_image frontend "$FRONTEND_DIR" "$2" \
    --build-arg NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="$(public_key NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)" \
    --build-arg NEXT_PUBLIC_OPENWEATHERMAP_API_KEY="$(public_key NEXT_PUBLIC_OPENWEATHERMAP_API_KEY)" \
    --build-arg NEXT_PUBLIC_OPENAIP_API_KEY="$(public_key NEXT_PUBLIC_OPENAIP_API_KEY)"
}

# Exported and compressed once, whatever the number of servers. Prints the path.
image_archive() { # <name:version>
  archive=$WORK/$(printf '%s' "$1" | tr ':/' '__').tar.gz
  if [ ! -s "$archive" ]; then
    # Written to a file first: in a pipe, a failed export would go unnoticed.
    docker save "$REGISTRY/$1" >"$WORK/image.tar" || fail "the image $1 could not be exported"
    gzip -c "$WORK/image.tar" >"$archive.part" || fail "the image $1 could not be compressed"
    rm -f "$WORK/image.tar"
    mv "$archive.part" "$archive"
  fi
  printf '%s\n' "$archive"
}

# Sends a file in small pieces, each one retried, then checks the whole file on
# the server. A connection that drops large uploads at random (a phone's shared
# connection, a weak link) then only costs the pieces that failed.
# Sets REMOTE_DIR and REMOTE_FILE.
CHUNK_SIZE=${CHUNK_SIZE:-4m}
CHUNK_TRIES=${CHUNK_TRIES:-8}
send_file() { # <host> <local file>
  sum=$(shasum -a 256 "$2" 2>/dev/null || sha256sum "$2")
  sum=${sum%% *}
  REMOTE_DIR=/tmp/skycrew-upload-$sum
  REMOTE_FILE=$REMOTE_DIR/file
  # shellcheck disable=SC2029
  $SSH "$1" "mkdir -p '$REMOTE_DIR'" </dev/null || return 1
  rm -rf "$WORK/chunks" && mkdir "$WORK/chunks" || return 1
  split -b "$CHUNK_SIZE" "$2" "$WORK/chunks/part." || return 1
  total=$(ls "$WORK/chunks" | wc -l | tr -d ' ')
  n=0
  for chunk in "$WORK"/chunks/part.*; do
    n=$((n + 1))
    name=${chunk##*/}
    size=$(wc -c <"$chunk" | tr -d ' ')
    try=1
    while :; do
      # shellcheck disable=SC2029
      got=$(cat "$chunk" | $SSH "$1" "cat > '$REMOTE_DIR/$name' && wc -c < '$REMOTE_DIR/$name'" 2>/dev/null | tr -d ' ') || got=""
      [ "$got" = "$size" ] && break
      [ "$try" -lt "$CHUNK_TRIES" ] || { echo "piece $n of $total failed $try times" >&2; return 1; }
      try=$((try + 1))
      sleep 2
    done
    printf '\rsent %s/%s' "$n" "$total" >&2
  done
  printf '\n' >&2
  # shellcheck disable=SC2029
  $SSH "$1" "cd '$REMOTE_DIR' && cat part.* > file && rm -f part.* && echo '$sum  file' | sha256sum -c --quiet -" </dev/null ||
    { echo "the file arrived damaged on $1" >&2; return 1; }
}

copy_images() { # <host> <backend version or ""> <frontend version or "">
  host=$1
  for image in ${2:+backend:$2} ${3:+frontend:$3}; do
    say "Copying $image to $host"
    if [ "$COPY_IMAGES" != always ]; then
      here=$(docker image inspect -f '{{.Id}}' "$REGISTRY/$image" 2>/dev/null || true)
      # shellcheck disable=SC2029
      there=$($SSH "$host" "sudo docker image inspect -f '{{.Id}}' '$REGISTRY/$image' 2>/dev/null" </dev/null || true)
      if [ -n "$here" ] && [ "$here" = "$there" ]; then
        echo "already on $host"
        continue
      fi
    fi
    archive=$(image_archive "$image") || exit 1
    send_file "$host" "$archive" ||
      fail "the image $image could not be sent to $host: the versions were not changed"
    # shellcheck disable=SC2029
    $SSH "$host" "gunzip -c '$REMOTE_FILE' | sudo docker load; rc=\$?; rm -rf '$REMOTE_DIR'; exit \$rc" </dev/null ||
      fail "the image $image could not be loaded on $host: the versions were not changed"
  done
}

backup_club() { # <host> <backup command on the server, or none>
  say "Backing up on $1"
  # The backup command belongs to root: its presence is checked as root too.
  if [ "$2" = none ]; then
    echo "skipped on request"
  else
    # shellcheck disable=SC2029
    $SSH "$1" "if sudo test -x '$2'; then sudo '$2' && echo 'backup done'; else echo 'no backup command at $2: stopping' >&2; exit 1; fi" </dev/null
  fi
}

# Switches the versions of the installation in <folder> and waits for it to
# be healthy; otherwise puts the previous versions back. Returns 0 when the new
# versions run, 1 when they did not and the previous ones run again, 2 when
# the previous ones are not healthy either, 3 when nothing was changed.
switch_club() { # <host> <folder on the server> <backend version or ""> <frontend version or "">
  say "Switching versions on $1 ($2)"
  # shellcheck disable=SC2029
  $SSH "$1" "sudo sh -s -- '$2' '$3' '$4' '$HEALTH_WAIT'" <<'REMOTE'
set -eu
[ -f "$1/.env" ] || { echo "no installation in $1 (no .env there)" >&2; exit 3; }
cd "$1"; new_backend=$2; new_frontend=$3; wait_seconds=$4

current() { grep "^$1=" .env | cut -d= -f2-; }
old_backend=$(current BACKEND_VERSION); old_frontend=$(current FRONTEND_VERSION)

# Rewrites .env in place: same file, same owner, same rights.
set_versions() {
  sed -e "${1:+s/^BACKEND_VERSION=.*/BACKEND_VERSION=$1/}" \
      -e "${2:+s/^FRONTEND_VERSION=.*/FRONTEND_VERSION=$2/}" .env >.env.switch
  cat .env.switch >.env
  rm -f .env.switch
}

healthy() { # waits for both services
  i=0
  while [ $i -lt $((wait_seconds / 3)) ]; do
    ok=1
    for service in backend frontend; do
      id=$(docker compose ps -q "$service" </dev/null)
      [ "$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" = healthy ] || ok=0
    done
    [ $ok -eq 1 ] && return 0
    i=$((i + 1)); sleep 3
  done
  return 1
}

set_versions "$new_backend" "$new_frontend"
if ! docker compose config -q </dev/null; then
  set_versions "$old_backend" "$old_frontend"
  echo "the configuration is not valid with the new versions: nothing was restarted" >&2
  exit 3
fi
docker compose up -d </dev/null >/dev/null 2>&1 || true

if healthy; then
  echo "running: backend $(current BACKEND_VERSION), frontend $(current FRONTEND_VERSION)"
  exit 0
fi

echo "new versions did not come up healthy, going back to backend $old_backend, frontend $old_frontend" >&2
docker compose logs --tail 40 backend frontend </dev/null >&2 || true
set_versions "$old_backend" "$old_frontend"
docker compose up -d </dev/null >/dev/null 2>&1 || true
if healthy; then
  echo "previous versions are running again" >&2
  exit 1
fi
echo "previous versions are NOT healthy either: check the server" >&2
exit 2
REMOTE
}
