#!/bin/sh
# One entry point for every club of every server. Run it from the backend
# repository, on your own machine:
#
#   deploy/clubs.sh status [--html FILE]
#   deploy/clubs.sh update-all [--backend X.Y.Z] [--frontend X.Y.Z] [--only a,b] [--except c]
#                              [--continue-on-error] [--dry-run] [--yes]
#   deploy/clubs.sh backup-all [--only a,b] [--except c]
#   deploy/clubs.sh logs <club> [--lines N]
#
# The servers are listed in deploy/servers.conf, one SSH host per line (copy
# servers.conf.example). The clubs are never listed by hand: they are found on
# each server, /opt/skycrew (the first club, named "skycrew") and every
# /opt/skycrew-<slug> holding a .env and a docker-compose.yml. A club is named
# by its slug, or <server>:<slug> when two servers have the same one.
#
#   status       state of each club and of each server, read only; --html also
#                writes a dashboard in one file (and opens it on a Mac)
#   update-all   builds the images once, copies them once to each server, then
#                updates the clubs one by one (backup, switch, health wait,
#                automatic return to the previous versions); stops at the first
#                club that fails unless --continue-on-error; shows the plan and
#                asks first unless --yes; --dry-run shows the plan and changes nothing
#   backup-all   runs the backup of each club now
#   logs         last lines of the API and of the web application of one club
# Settings, through the environment (besides those of release-lib.sh):
#   SERVERS_FILE   list of the servers   (default deploy/servers.conf)
#   SSH            command used to reach the servers (default ssh)
#   SERVER_ROOT    prefix of every path on the servers, for tests; {host} is
#                  replaced by the name of the server (default none)
set -eu

usage() { sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 64; }
say() { printf '\n== %s\n' "$*"; }
fail() { printf '\nÉCHEC : %s\n' "$*" >&2; exit 1; }

DEPLOY=$(cd "$(dirname "$0")" && pwd)
BACKEND_DIR=$(cd "$DEPLOY/.." && pwd)
SERVERS_FILE=${SERVERS_FILE:-$DEPLOY/servers.conf}
SSH=${SSH:-ssh}
SERVER_ROOT=${SERVER_ROOT:-}
TAB=$(printf '\t')

q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }

servers() {
  [ -f "$SERVERS_FILE" ] ||
    fail "pas de liste de serveurs : copiez deploy/servers.conf.example en deploy/servers.conf et mettez-y vos serveurs"
  list=$(sed -e 's/#.*//' -e 's/[[:space:]]//g' "$SERVERS_FILE" | grep -v '^$' || true)
  [ -n "$list" ] || fail "aucun serveur dans $SERVERS_FILE"
  printf '%s\n' "$list"
}

# Runs one action of clubs-remote.sh on a server, as root.
remote() { # <host> <action> [arguments]
  host=$1; action=$2; shift 2
  root=$(printf '%s' "$SERVER_ROOT" | sed "s/{host}/$host/g")
  args=""
  for arg in "$@"; do args="$args $(q "$arg")"; done
  # shellcheck disable=SC2029
  $SSH "$host" "sudo sh -s -- $action $(q "$root")$args" <"$DEPLOY/clubs-remote.sh"
}

# --only / --except: a club is named by its slug or by <server>:<slug>.
ONLY=""; EXCEPT=""
in_list() { # <list a,b> <host> <slug>
  case ",$1," in *",$3,"* | *",$2:$3,"*) return 0 ;; esac
  return 1
}
selected() { # <host> <slug>
  [ -z "$ONLY" ] || in_list "$ONLY" "$1" "$2" || return 1
  [ -z "$EXCEPT" ] || ! in_list "$EXCEPT" "$1" "$2" || return 1
  return 0
}
# Every name given to --only and --except must be a club found on a server.
check_names() { # <file host\tslug...>
  for name in $(printf '%s,%s' "$ONLY" "$EXCEPT" | tr ',' ' '); do
    awk -F '\t' -v n="$name" '$2 == n || $1 ":" $2 == n { found = 1 } END { exit !found }' "$1" ||
      fail "aucun club « $name » sur les serveurs. Clubs trouvés : $(awk -F '\t' '{ printf "%s%s:%s", (NR > 1 ? ", " : ""), $1, $2 }' "$1")"
  done
}

# All clubs of all servers: host, slug, folder, backend, frontend, backup command.
discover() { # <output file>; stops when a server cannot be read
  : >"$1"
  for host in $(servers); do
    remote "$host" list >"$WORK/list" ||
      fail "le serveur $host ne répond pas ou refuse la commande : rien n’a été fait"
    awk -v h="$host" '{ print h "\t" $0 }' "$WORK/list" >>"$1"
  done
}

# --- status -----------------------------------------------------------------------
cmd_status() {
  HTML=""
  while [ $# -gt 0 ]; do
    case $1 in
      --html) [ $# -ge 2 ] || usage; HTML=$2; shift 2 ;;
      *) usage ;;
    esac
  done
  data=$WORK/status.tsv
  : >"$data"
  for host in $(servers); do
    if remote "$host" status >"$WORK/part" 2>"$WORK/err"; then
      awk -v h="$host" '{ print h "\t" $0 }' "$WORK/part" >>"$data"
    else
      printf '%s\tS\tunreachable\t%s\n' "$host" "$(tr '\t\n' '  ' <"$WORK/err" | cut -c1-200)" >>"$data"
    fi
  done

  # The public address of each club is checked from here, as a member would.
  n=0
  awk -F '\t' '$2 == "C" && $4 == "url" { print $1 "\t" $3 "\t" $5 }' "$data" >"$WORK/urls"
  while IFS="$TAB" read -r host slug url; do
    n=$((n + 1))
    [ -n "$url" ] || continue
    (
      code=$(curl -s -m 8 -o /dev/null -w '%{http_code}' "${url%/}/health/ready" 2>/dev/null || true)
      printf '%s\tC\t%s\tdomain_ready\t%s\n' "$host" "$slug" "${code:-000}" >"$WORK/domain.$n"
    ) &
  done <"$WORK/urls"
  wait
  cat "$WORK"/domain.* >>"$data" 2>/dev/null || true

  now=$(date '+%Y-%m-%d %H:%M')
  color=0; [ -t 1 ] && color=1
  LC_ALL=C awk -F '\t' -v mode=term -v now="$now" -v color="$color" -f "$DEPLOY/clubs-report.awk" "$data"
  if [ -n "$HTML" ]; then
    LC_ALL=C awk -F '\t' -v mode=html -v now="$now" -f "$DEPLOY/clubs-report.awk" "$data" >"$HTML.part"
    mv "$HTML.part" "$HTML"
    printf '\nTableau de bord écrit dans %s\n' "$HTML"
    if [ "$(uname -s)" = Darwin ] && [ "${OPEN_HTML:-1}" = 1 ]; then open "$HTML" || true; fi
  fi
}

# --- update-all -------------------------------------------------------------------
cmd_update_all() {
  BACKEND_VERSION=""; FRONTEND_VERSION=""; DRY_RUN=0; YES=0; CONTINUE=0
  while [ $# -gt 0 ]; do
    case $1 in
      --backend) [ $# -ge 2 ] || usage; BACKEND_VERSION=$2; shift 2 ;;
      --frontend) [ $# -ge 2 ] || usage; FRONTEND_VERSION=$2; shift 2 ;;
      --only) [ $# -ge 2 ] || usage; ONLY=$2; shift 2 ;;
      --except) [ $# -ge 2 ] || usage; EXCEPT=$2; shift 2 ;;
      --continue-on-error) CONTINUE=1; shift ;;
      --dry-run) DRY_RUN=1; shift ;;
      --yes) YES=1; shift ;;
      *) usage ;;
    esac
  done
  [ -n "$BACKEND_VERSION$FRONTEND_VERSION" ] || usage
  for version in "$BACKEND_VERSION" "$FRONTEND_VERSION"; do
    [ -z "$version" ] || printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' ||
      fail "les versions s’écrivent comme 2.18.0"
  done

  say "Clubs trouvés sur les serveurs"
  discover "$WORK/clubs"
  check_names "$WORK/clubs"

  # The plan: host, slug, folder, backup command, what to do, versions now.
  : >"$WORK/plan"
  while IFS="$TAB" read -r host slug dir backend frontend cmd <&3; do
    selected "$host" "$slug" || continue
    todo=update
    if { [ -z "$BACKEND_VERSION" ] || [ "$backend" = "$BACKEND_VERSION" ]; } &&
      { [ -z "$FRONTEND_VERSION" ] || [ "$frontend" = "$FRONTEND_VERSION" ]; }; then todo=current; fi
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$host" "$slug" "$dir" "$cmd" "$todo" "$backend" "$frontend" >>"$WORK/plan"
  done 3<"$WORK/clubs"
  [ -s "$WORK/plan" ] || fail "aucun club ne correspond à --only / --except"

  printf '\nMise à jour prévue :%s%s\n' "${BACKEND_VERSION:+ backend $BACKEND_VERSION}" \
    "${FRONTEND_VERSION:+${BACKEND_VERSION:+,} frontend $FRONTEND_VERSION}"
  awk -F '\t' -v B="$BACKEND_VERSION" -v F="$FRONTEND_VERSION" '
    $1 != last { printf "  serveur %s\n", $1; last = $1 }
    $5 == "current" { printf "     -  %-24s déjà en backend %s, frontend %s : rien à faire\n", $2, $6, $7; next }
    {
      n++; what = ""
      if (B != "") what = "backend " $6 " -> " B
      if (F != "") what = what (what != "" ? ", " : "") "frontend " $7 " -> " F
      printf "    %2d. %-24s %s%s\n", n, $2, what, ($4 == "none" ? "   (AUCUNE SAUVEGARDE INSTALLÉE)" : "")
    }' "$WORK/plan"
  todo=$(awk -F '\t' '$5 == "update"' "$WORK/plan" | wc -l | tr -d ' ')
  if [ "$todo" -eq 0 ]; then printf '\nTous ces clubs sont déjà dans ces versions : rien à faire.\n'; exit 0; fi
  if awk -F '\t' '$5 == "update" && $4 == "none" { found = 1 } END { exit !found }' "$WORK/plan"; then
    fail "un club sans sauvegarde installée ne peut pas être mis à jour : installez-la ou retirez-le avec --except"
  fi
  cat <<EOF

Pour chaque club, l’un après l’autre : sauvegarde, bascule, attente de bonne
santé ($HEALTH_WAIT s au plus), retour tout seul aux versions précédentes sinon.
$(if [ $CONTINUE -eq 1 ]; then echo "Un club en échec n’arrête pas les suivants (--continue-on-error)."; else echo "Arrêt au premier club en échec (--continue-on-error pour continuer quand même)."; fi)
EOF

  if [ $DRY_RUN -eq 1 ]; then
    if [ "$SKIP_BUILD" != 1 ]; then
      [ -z "$BACKEND_VERSION" ] || check_tag backend "$BACKEND_DIR" "$BACKEND_VERSION"
      [ -z "$FRONTEND_VERSION" ] || check_tag frontend "$FRONTEND_DIR" "$FRONTEND_VERSION"
      echo "Les étiquettes de version existent."
    fi
    printf '\nSimulation (--dry-run) : rien n’a été construit, copié ni modifié.\n'
    exit 0
  fi
  if [ $YES -eq 0 ]; then
    printf '\nMettre à jour ces %s club(s) ? Tapez oui pour continuer : ' "$todo"
    answer=""
    read -r answer 2>/dev/null </dev/tty || [ -n "$answer" ] ||
      fail "pas de terminal pour confirmer : relancez avec --yes"
    [ "$answer" = oui ] || { echo "Abandon : rien n’a été modifié."; exit 1; }
  fi

  say "Construction des images (une seule fois)"
  build_images "$BACKEND_VERSION" "$FRONTEND_VERSION"

  : >"$WORK/done"; copied=""; stop=0; failures=0
  while IFS="$TAB" read -r host slug dir cmd todo backend frontend <&3; do
    [ "$todo" = update ] || continue
    if [ $stop -eq 1 ]; then printf '%s\t%s\tskipped\t\n' "$host" "$slug" >>"$WORK/done"; continue; fi
    say "Club $slug sur $host"
    if ! printf ' %s ' "$copied" | grep -q " $host "; then
      if ( copy_images "$host" "$BACKEND_VERSION" "$FRONTEND_VERSION" ); then
        copied="$copied $host"
      else
        printf '%s\t%s\tfailed\timages non copiées sur le serveur, versions inchangées\n' "$host" "$slug" >>"$WORK/done"
        failures=$((failures + 1)); [ $CONTINUE -eq 1 ] || stop=1
        continue
      fi
    fi
    if ! ( backup_club "$host" "$cmd" ); then
      printf '%s\t%s\tfailed\tsauvegarde échouée, versions inchangées\n' "$host" "$slug" >>"$WORK/done"
      failures=$((failures + 1)); [ $CONTINUE -eq 1 ] || stop=1
      continue
    fi
    rc=0
    ( switch_club "$host" "$dir" "$BACKEND_VERSION" "$FRONTEND_VERSION" ) || rc=$?
    case $rc in
      0) printf '%s\t%s\tupdated\tbackend %s, frontend %s\n' "$host" "$slug" \
           "${BACKEND_VERSION:-$backend}" "${FRONTEND_VERSION:-$frontend}" >>"$WORK/done" ;;
      1) reason="nouvelles versions pas en bonne santé : revenu tout seul à backend $backend, frontend $frontend, qui tournent" ;;
      2) reason="ni les nouvelles ni les anciennes versions ne sont en bonne santé : À VÉRIFIER TOUT DE SUITE (deploy/clubs.sh logs $slug)" ;;
      3) reason="configuration refusée, rien n’a été redémarré" ;;
      *) reason="la connexion au serveur s’est interrompue (code $rc) : vérifiez l’état avec deploy/clubs.sh status" ;;
    esac
    if [ $rc -ne 0 ]; then
      printf '%s\t%s\tfailed\t%s\n' "$host" "$slug" "$reason" >>"$WORK/done"
      failures=$((failures + 1)); [ $CONTINUE -eq 1 ] || stop=1
    fi
  done 3<"$WORK/plan"

  say "Bilan"
  awk -F '\t' '
    $3 == "updated" { u = u sprintf("  %-24s %-14s %s\n", $2, $1, $4) }
    $3 == "failed"  { f = f sprintf("  %-24s %-14s %s\n", $2, $1, $4) }
    $3 == "skipped" { s = s sprintf("  %-24s %s\n", $2, $1) }
    END {
      printf "Mis à jour :\n%s", (u == "" ? "  aucun\n" : u)
      printf "En échec :\n%s", (f == "" ? "  aucun\n" : f)
      printf "Pas tentés (arrêt après l’échec) :\n%s", (s == "" ? "  aucun\n" : s)
    }' "$WORK/done"
  if awk -F '\t' '$5 == "current" { found = 1 } END { exit !found }' "$WORK/plan"; then
    printf 'Déjà à jour, laissés tels quels :\n'
    awk -F '\t' '$5 == "current" { printf "  %-24s %s\n", $2, $1 }' "$WORK/plan"
  fi
  if [ $failures -gt 0 ]; then
    printf '\nRelancer la même commande reprend là où c’était : les clubs déjà à jour sont passés.\n'
    exit 1
  fi
}

# --- backup-all -------------------------------------------------------------------
cmd_backup_all() {
  while [ $# -gt 0 ]; do
    case $1 in
      --only) [ $# -ge 2 ] || usage; ONLY=$2; shift 2 ;;
      --except) [ $# -ge 2 ] || usage; EXCEPT=$2; shift 2 ;;
      *) usage ;;
    esac
  done
  discover "$WORK/clubs"
  check_names "$WORK/clubs"
  ok=""; ko=""
  while IFS="$TAB" read -r host slug _ <&3; do
    selected "$host" "$slug" || continue
    say "Sauvegarde de $slug sur $host"
    if remote "$host" backup "$slug"; then ok="$ok $slug"; else ko="$ko $slug"; fi
  done 3<"$WORK/clubs"
  say "Bilan"
  echo "Sauvegardés :${ok:- aucun}"
  echo "En échec :${ko:- aucun}"
  [ -z "$ko" ]
}

# --- logs -------------------------------------------------------------------------
cmd_logs() {
  [ $# -ge 1 ] || usage
  name=$1; shift; lines=100
  while [ $# -gt 0 ]; do
    case $1 in
      --lines) [ $# -ge 2 ] || usage; lines=$2; shift 2 ;;
      *) usage ;;
    esac
  done
  printf '%s' "$lines" | grep -Eq '^[1-9][0-9]{0,4}$' || fail "--lines attend un nombre"
  discover "$WORK/clubs"
  ONLY=$name
  check_names "$WORK/clubs"
  matches=$(awk -F '\t' -v n="$name" '$2 == n || $1 ":" $2 == n { print $1 "\t" $2 }' "$WORK/clubs")
  [ "$(printf '%s\n' "$matches" | wc -l)" -eq 1 ] ||
    fail "« $name » existe sur plusieurs serveurs : écrivez <serveur>:$name"
  host=${matches%%"$TAB"*}; slug=${matches#*"$TAB"}
  echo "== $slug sur $host : $lines dernières lignes de l’API et de l’application"
  remote "$host" logs "$slug" "$lines"
}

[ $# -ge 1 ] || usage
command=$1; shift
# shellcheck source=deploy/release-lib.sh
. "$DEPLOY/release-lib.sh"
release_init
case $command in
  status) cmd_status "$@" ;;
  update-all) cmd_update_all "$@" ;;
  backup-all) cmd_backup_all "$@" ;;
  logs) cmd_logs "$@" ;;
  -h | --help | help) usage ;;
  *) usage ;;
esac
