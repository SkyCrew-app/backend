# Server side of clubs.sh: sent over SSH and run as root by
#   sudo sh -s -- <action> <root> [arguments]
# Never run by hand. Every club is found here, never listed by hand: the
# folders /opt/skycrew (the first club) and /opt/skycrew-<slug> that hold a
# .env and a docker-compose.yml.
#   list                   one line per club: slug, folder, versions, backup command
#   status                 what the dashboard shows, read only
#   backup <slug>          runs the backup of that club
#   logs <slug> <lines>    last lines of its API and web application
# Only the settings listed in env_value calls are read from the .env files:
# no password, key or webhook address ever leaves the server.
set -eu

ROOT=""
TAB=$(printf '\t')

env_value() { # <file> <key>: the value, quotes and tabs removed
  [ -f "$1" ] || return 0
  grep "^$2=" "$1" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d "\"'$TAB\r" || true
}

club_dirs() {
  for dir in "$ROOT"/opt/skycrew "$ROOT"/opt/skycrew-*; do
    [ -f "$dir/.env" ] && [ -f "$dir/docker-compose.yml" ] || continue
    printf '%s\n' "$dir"
  done
}

# Names of the files of a club: the first one has no slug in them.
club_names() { # <folder>
  base=${1##*/}
  if [ "$base" = skycrew ]; then slug=skycrew; suffix=""; else slug=${base#skycrew-}; suffix=-$slug; fi
  project=$(env_value "$1/.env" COMPOSE_PROJECT_NAME); project=${project:-skycrew}
  backup_cmd=/usr/local/sbin/skycrew-backup$suffix
  backup_dir=/var/backups/skycrew$suffix
  watch_cron=/etc/cron.d/skycrew-watch$suffix
  watch_env=/etc/skycrew-watch$suffix.env
  backup_cron=/etc/cron.d/skycrew-backup$suffix
}

find_club() { # <slug>: sets dir and the names, or stops
  for dir in $(club_dirs); do
    club_names "$dir"
    [ "$slug" = "$1" ] && return 0
  done
  echo "aucun club « $1 » sur ce serveur" >&2
  exit 3
}

do_list() {
  for dir in $(club_dirs); do
    club_names "$dir"
    cmd=none; [ -x "$ROOT$backup_cmd" ] && cmd=$ROOT$backup_cmd
    printf '%s\t%s\t%s\t%s\t%s\n' "$slug" "$dir" \
      "$(env_value "$dir/.env" BACKEND_VERSION)" "$(env_value "$dir/.env" FRONTEND_VERSION)" "$cmd"
  done
}

# --- status ---------------------------------------------------------------------
out() { printf 'C\t%s\t%s\t%s\n' "$slug" "$1" "$(printf '%s' "$2" | tr '\t\n' '  ')"; }
srv() { printf 'S\t%s\t%s\n' "$1" "$(printf '%s' "$2" | tr '\t\n' '  ')"; }

# Memory of a docker stats line ("123.4MiB / 1GiB") in MiB.
to_mib() {
  printf '%s\n' "$1" | awk '{ v = $1; u = v; gsub(/[0-9.]/, "", u); v += 0
    if (u == "B") v /= 1048576; else if (u == "KiB" || u == "kB") v /= 1024
    else if (u == "GiB" || u == "GB") v *= 1024; printf "%d", v + 0.5 }'
}

# Age of a file: fresh (under 26 h), stale (under 50 h) or old.
age_of() {
  if [ -n "$(find "$1" -mmin -1560 2>/dev/null)" ]; then echo fresh
  elif [ -n "$(find "$1" -mmin -3000 2>/dev/null)" ]; then echo stale
  else echo old; fi
}

club_status() {
  env=$dir/.env
  out dir "${dir#"$ROOT"}"
  out project "$project"
  port=$(env_value "$env" LOCAL_PORT); port=${port:-8100}
  out port "$port"
  url=$(env_value "$env" PUBLIC_URL)
  out url "$url"
  out plan "$(env_value "$env" SKYCREW_PLAN)"
  out max_aircraft "$(env_value "$env" SKYCREW_MAX_AIRCRAFT)"
  out max_members "$(env_value "$env" SKYCREW_MAX_MEMBERS)"
  out env_backend "$(env_value "$env" BACKEND_VERSION)"
  out env_frontend "$(env_value "$env" FRONTEND_VERSION)"

  # Containers of its Compose project, whatever their state.
  db_id=""; backend_id=""; mem=0; cpu=0
  docker ps -a --filter "label=com.docker.compose.project=$project" \
    --format '{{.ID}} {{.Label "com.docker.compose.service"}}' >"$WORK/ids" 2>/dev/null || true
  while read -r id service; do
    [ -n "$id" ] || continue
    info=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}} {{.Config.Image}}' "$id" 2>/dev/null || echo "absent - -")
    set -- $info
    out "svc_$service" "$1 $2"
    case $service in
      backend) out run_backend "${3##*:}"; [ "$1" = running ] && backend_id=$id ;;
      frontend) out run_frontend "${3##*:}" ;;
      db) [ "$1" = running ] && db_id=$id ;;
    esac
    usage=$(grep "^$id$TAB" "$WORK/stats" 2>/dev/null | head -n 1 || true)
    if [ -n "$usage" ]; then
      mem=$((mem + $(to_mib "$(printf '%s' "$usage" | cut -f2)")))
      cpu=$(printf '%s %s' "$cpu" "$(printf '%s' "$usage" | cut -f3)" | awk '{ gsub(/%/, "", $2); printf "%.1f", $1 + $2 }')
    fi
  done <"$WORK/ids"
  out mem_mb "$mem"
  out cpu_pct "$cpu"

  code=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/health/ready" 2>/dev/null || true)
  out local_ready "${code:-000}"

  # Activity, read only, counts only: nothing personal leaves the database.
  if [ -n "$db_id" ]; then
    out db_kb "$(docker exec "$db_id" du -sk /var/lib/postgresql/data 2>/dev/null | cut -f1)"
    counts=$(docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$db_id" \
      psql -U skycrew -d skycrew -At -F ' ' -v ON_ERROR_STOP=1 -c "SELECT
        (SELECT count(*) FROM users WHERE is_active),
        (SELECT count(*) FROM aircraft WHERE availability_status::text <> 'UNAVAILABLE'),
        (SELECT count(*) FROM reservations WHERE start_time >= now() - interval '30 days'
           AND start_time < now() AND status::text <> 'cancelled')" 2>/dev/null || true)
    set -- $counts
    if [ $# -eq 3 ]; then out members "$1"; out aircraft "$2"; out bookings30 "$3"; fi
  fi
  if [ -n "$backend_id" ]; then
    out uploads_kb "$(docker exec "$backend_id" du -sk /usr/src/app/dist/src/uploads 2>/dev/null | cut -f1)"
  fi

  # Backups: the newest database dump, whatever its name.
  [ -x "$ROOT$backup_cmd" ] && out backup_installed yes || out backup_installed no
  [ -f "$ROOT$backup_cron" ] && out backup_cron yes || out backup_cron no
  last=$(ls -t "$ROOT$backup_dir"/*.sql.gz 2>/dev/null | head -n 1 || true)
  if [ -n "$last" ]; then
    out backup_last "$(date -r "$last" '+%Y-%m-%d %H:%M' 2>/dev/null || echo '?')"
    out backup_age "$(age_of "$last")"
    out backup_db_kb "$(du -k "$last" | cut -f1)"
    out backups_total_kb "$(du -sk "$ROOT$backup_dir" | cut -f1)"
  else
    out backup_age none
  fi

  # Watcher: installed, does its message name the club, last alert.
  if [ -f "$ROOT$watch_cron" ]; then out watch_installed yes; else out watch_installed no; fi
  if [ -f "$ROOT$watch_env" ]; then
    down=$(env_value "$ROOT$watch_env" MESSAGE_DOWN)
    host=${url#*://}; host=${host%%/*}
    named=no
    case $down in *"$slug"*) [ "$slug" = skycrew ] || named=yes ;; esac
    [ -z "$host" ] || case $down in *"$host"*) named=yes ;; esac
    out watch_named "$named"
    [ -n "$(env_value "$ROOT$watch_env" ALERT_WEBHOOK_URL)$(env_value "$ROOT$watch_env" ALERT_EMAIL)" ] &&
      out watch_target yes || out watch_target no
    state=$(env_value "$ROOT$watch_env" STATE_FILE); state=${state:-/var/tmp/skycrew-watch.state}
    health=$(env_value "$ROOT$watch_env" HEALTH_URL); health=${health:-http://127.0.0.1:8100/health/ready}
    threshold=$(env_value "$ROOT$watch_env" FAILURES_BEFORE_ALERT)
    out watch_threshold "${threshold:-2}"
    out watch_failures "$(cat "$ROOT$state" 2>/dev/null || echo 0)"
    if [ -s "$ROOT$state.alert" ]; then
      out watch_last "$(tail -n 1 "$ROOT$state.alert")"
    elif command -v journalctl >/dev/null 2>&1; then
      # Watchers older than the .alert file only wrote to the system log.
      line=$(journalctl -q -t skycrew-watch -o short-iso --no-pager --since=-90d 2>/dev/null |
        grep -F "($health)" | tail -n 1 || true)
      if [ -n "$line" ]; then
        up=$(env_value "$ROOT$watch_env" MESSAGE_UP)
        kind=down; case $line in *"${up:-answers again}"*) kind=up ;; esac
        out watch_last "$(printf '%s' "$line" | cut -c1-16 | tr T ' ') $kind"
      fi
    fi
  else
    out watch_named no
    out watch_target no
  fi
}

do_status() {
  WORK=$(mktemp -d)
  trap 'rm -rf "$WORK"' EXIT
  docker stats --no-stream --format '{{.ID}}\t{{.MemUsage}}\t{{.CPUPerc}}' >"$WORK/stats" 2>/dev/null || true

  srv hostname "$(hostname 2>/dev/null || echo '?')"
  srv time "$(date '+%Y-%m-%d %H:%M')"
  if [ -r /proc/meminfo ]; then
    srv mem_total_mb "$(awk '/^MemTotal:/ { printf "%d", $2 / 1024 }' /proc/meminfo)"
    srv mem_avail_mb "$(awk '/^MemAvailable:/ { printf "%d", $2 / 1024 }' /proc/meminfo)"
  else
    # No /proc (a test machine): the memory of the Docker machine.
    total=$(docker info --format '{{.MemTotal}}' 2>/dev/null | awk '{ printf "%d", $1 / 1048576 }')
    used=0
    while IFS="$TAB" read -r _ usage _; do used=$((used + $(to_mib "$usage"))); done <"$WORK/stats"
    srv mem_total_mb "$total"
    srv mem_avail_mb "$((total - used))"
    srv mem_source docker
  fi
  srv cpus "$(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || echo 1)"
  if [ -r /proc/loadavg ]; then srv load1 "$(cut -d' ' -f1 /proc/loadavg)"
  else srv load1 "$(sysctl -n vm.loadavg 2>/dev/null | awk '{ print $2 }')"; fi
  disk=/var/lib/docker; [ -d "$disk" ] || disk=/
  df -Pk "$disk" | awk 'NR == 2 { printf "S\tdisk_total_mb\t%d\nS\tdisk_avail_mb\t%d\n", $2 / 1024, $4 / 1024 }'

  for dir in $(club_dirs); do
    club_names "$dir"
    out found yes
    club_status
  done
}

do_backup() {
  find_club "$1"
  [ -x "$ROOT$backup_cmd" ] || { echo "pas de commande de sauvegarde $backup_cmd" >&2; exit 1; }
  "$ROOT$backup_cmd"
  last=$(ls -t "$ROOT$backup_dir"/*.sql.gz 2>/dev/null | head -n 1 || true)
  [ -z "$last" ] || echo "base : $(du -h "$last" | cut -f1), dossier des sauvegardes : $(du -sh "$ROOT$backup_dir" | cut -f1)"
}

do_logs() {
  find_club "$1"
  cd "$dir"
  docker compose logs --no-color --tail "$2" backend frontend
}

main() {
  action=$1; ROOT=$2; shift 2
  case $action in
    list) do_list ;;
    status) do_status ;;
    backup) do_backup "$1" ;;
    logs) do_logs "$1" "$2" ;;
    *) echo "action inconnue : $action" >&2; exit 64 ;;
  esac
}

# Nothing below may read the standard input: it holds this script.
main "$@" </dev/null
