#!/bin/sh
# Prepares the installation of one new club on a server that may already run
# other clubs and other software, without touching them. Run it from the
# backend repository, on your own machine:
#
#   deploy/new-club.sh <ssh-host> <slug> --domain <domain> --admin-email <e-mail> --plan club|ecole
#       [--max-aircraft N] [--max-members N] [--port P] [--backend X.Y.Z] [--frontend X.Y.Z]
#       [--alert-webhook URL] [--no-start] [--dry-run]
#
#   slug            short name of the club: lower-case letters, digits and dashes (e.g. aeroclub-vexin)
#   --domain        address of the club, without https:// (e.g. vexin.skycrew.fr)
#   --admin-email   e-mail of the club's first administrator
#   --plan          club (everything except instruction) or ecole (everything)
#   --max-aircraft, --max-members   limits of the plan; left out: no limit
#   --port          local port of the club on the server; left out: the first free one from 8101
#   --backend, --frontend   versions to run; left out: the ones of /opt/skycrew on the server
#   --alert-webhook chat webhook told when the club stops answering (Discord, Slack...)
#   --no-start      prepares everything but does not start the club
#   --dry-run       shows every file and command, contacts nothing, changes nothing
#
# On the server it creates /opt/skycrew-<slug> (its own Compose project,
# database, files and port), the daily backup and the watcher of that club,
# and an nginx site file that it does NOT enable: you check it, then enable it.
# It refuses to run when anything of that club already exists.
# Settings, through the environment (for tests):
#   SSH          command used to reach the server   (default ssh)
#   SERVER_ROOT  prefix of every path on the server (default none)
#   REGISTRY     name of the images (default ghcr.io/skycrew-app); another one
#                is written to the club's .env (BACKEND_IMAGE, FRONTEND_IMAGE)
set -eu

usage() { sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 64; }
fail() { printf '\nÉCHEC : %s\nRien de plus n’a été fait.\n' "$*" >&2; exit 1; }

HOST=""; SLUG=""; DOMAIN=""; ADMIN_EMAIL=""; PLAN=""; MAX_AIRCRAFT=""; MAX_MEMBERS=""
PORT=""; BACKEND_VERSION=""; FRONTEND_VERSION=""; ALERT_WEBHOOK=""; START=1; DRY_RUN=0
while [ $# -gt 0 ]; do
  case $1 in
    --domain) [ $# -ge 2 ] || usage; DOMAIN=$2; shift 2 ;;
    --admin-email) [ $# -ge 2 ] || usage; ADMIN_EMAIL=$2; shift 2 ;;
    --plan) [ $# -ge 2 ] || usage; PLAN=$2; shift 2 ;;
    --max-aircraft) [ $# -ge 2 ] || usage; MAX_AIRCRAFT=$2; shift 2 ;;
    --max-members) [ $# -ge 2 ] || usage; MAX_MEMBERS=$2; shift 2 ;;
    --port) [ $# -ge 2 ] || usage; PORT=$2; shift 2 ;;
    --backend) [ $# -ge 2 ] || usage; BACKEND_VERSION=$2; shift 2 ;;
    --frontend) [ $# -ge 2 ] || usage; FRONTEND_VERSION=$2; shift 2 ;;
    --alert-webhook) [ $# -ge 2 ] || usage; ALERT_WEBHOOK=$2; shift 2 ;;
    --no-start) START=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -*) usage ;;
    *) if [ -z "$HOST" ]; then HOST=$1; elif [ -z "$SLUG" ]; then SLUG=$1; else usage; fi; shift ;;
  esac
done

# --- Checks of what was given, before anything else ---------------------------
[ -n "$HOST" ] && [ -n "$SLUG" ] || usage
matches() { printf '%s' "$1" | grep -Eq "$2"; }
matches "$SLUG" '^[a-z][a-z0-9-]{1,29}[a-z0-9]$' ||
  fail "le nom court « $SLUG » doit faire 3 à 31 caractères : lettres minuscules, chiffres et tirets, en commençant par une lettre"
# clubs.sh names the historic installation in /opt/skycrew "skycrew".
[ "$SLUG" != skycrew ] || fail "le nom court « skycrew » est réservé au premier club installé : choisissez-en un autre"
matches "$DOMAIN" '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' ||
  fail "--domain : donnez l’adresse du club sans https:// (par exemple vexin.skycrew.fr)"
matches "$ADMIN_EMAIL" '^[^@[:space:]'"'"'"]+@[^@[:space:]'"'"'"]+\.[a-zA-Z]{2,}$' ||
  fail "--admin-email : adresse e-mail du premier administrateur manquante ou invalide"
case $PLAN in club|ecole) ;; *) fail "--plan doit valoir club ou ecole" ;; esac
for limit in "$MAX_AIRCRAFT" "$MAX_MEMBERS"; do
  [ -z "$limit" ] || matches "$limit" '^[1-9][0-9]{0,4}$' || fail "les limites doivent être des nombres entiers positifs"
done
[ -z "$PORT" ] || { matches "$PORT" '^[0-9]{4,5}$' && [ "$PORT" -ge 1024 ] && [ "$PORT" -le 65535 ]; } ||
  fail "--port doit être un numéro de port entre 1024 et 65535"
for version in "$BACKEND_VERSION" "$FRONTEND_VERSION"; do
  [ -z "$version" ] || matches "$version" '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "les versions s’écrivent comme 2.17.1"
done
[ -z "$ALERT_WEBHOOK" ] || matches "$ALERT_WEBHOOK" '^https://[^[:space:]'"'"'"]+$' ||
  fail "--alert-webhook doit être une adresse https://"

DEPLOY_DIR=$(cd "$(dirname "$0")" && pwd)
SSH=${SSH:-ssh}
SERVER_ROOT=${SERVER_ROOT:-}

# --- Secrets, generated here and sent over SSH (never on a command line) ---------
secret() { openssl rand -hex 32; }
password() { openssl rand -base64 24 | tr -d '/+=' | cut -c1-20; }
if [ $DRY_RUN -eq 1 ]; then
  JWT_SECRET='<64 caractères aléatoires>'; DB_PASSWORD='<64 caractères aléatoires>'
  ADMIN_PASSWORD='<20 caractères aléatoires>'
else
  command -v openssl >/dev/null 2>&1 || fail "openssl est nécessaire pour générer les secrets"
  JWT_SECRET=$(secret); DB_PASSWORD=$(secret); ADMIN_PASSWORD=$(password)
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
BUNDLE=$WORK/bundle
mkdir -p "$BUNDLE/files"
for file in docker-compose.yml docker-compose.behind-proxy.yml Caddyfile skycrew-backup.sh skycrew-watch.sh; do
  [ -f "$DEPLOY_DIR/$file" ] || fail "fichier du kit manquant : deploy/$file"
  cp "$DEPLOY_DIR/$file" "$BUNDLE/files/$file"
done

q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
{
  echo "SLUG=$(q "$SLUG")"
  echo "DOMAIN=$(q "$DOMAIN")"
  echo "ADMIN_EMAIL=$(q "$ADMIN_EMAIL")"
  echo "ADMIN_PASSWORD=$(q "$ADMIN_PASSWORD")"
  echo "JWT_SECRET=$(q "$JWT_SECRET")"
  echo "DB_PASSWORD=$(q "$DB_PASSWORD")"
  echo "PLAN=$(q "$PLAN")"
  echo "MAX_AIRCRAFT=$(q "$MAX_AIRCRAFT")"
  echo "MAX_MEMBERS=$(q "$MAX_MEMBERS")"
  echo "PORT=$(q "$PORT")"
  echo "BACKEND_VERSION=$(q "$BACKEND_VERSION")"
  echo "FRONTEND_VERSION=$(q "$FRONTEND_VERSION")"
  echo "ALERT_WEBHOOK=$(q "$ALERT_WEBHOOK")"
  echo "START=$START"
  echo "DRY_RUN=$DRY_RUN"
  echo "ROOT=$(q "$SERVER_ROOT")"
  echo "REGISTRY=$(q "${REGISTRY:-ghcr.io/skycrew-app}")"
} >"$BUNDLE/club.conf"

# --- What runs on the server, as root --------------------------------------------
cat >"$BUNDLE/remote.sh" <<'REMOTE'
set -eu
BUNDLE=$1
. "$BUNDLE/club.conf"

NAME=skycrew-$SLUG
DIR=/opt/$NAME
REFERENCE_DIR=/opt/skycrew
BACKUP_DIR=/var/backups/$NAME
BACKUP_CMD=/usr/local/sbin/skycrew-backup-$SLUG
BACKUP_CRON=/etc/cron.d/skycrew-backup-$SLUG
WATCH_ENV=/etc/skycrew-watch-$SLUG.env
WATCH_CRON=/etc/cron.d/skycrew-watch-$SLUG
NGINX_FILE=$DIR/nginx-$DOMAIN.conf

fail() { printf '\nÉCHEC : %s\n' "$*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }
# In a dry run, commands are shown instead of being run.
run() { if [ "$DRY_RUN" -eq 1 ]; then printf '   $ %s\n' "$*"; else "$@"; fi; }
# Writes a file (from stdin) under ROOT, or shows it in a dry run; secrets are masked there.
put() { # <path> <mode>
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\n--- %s (droits %s) ---\n' "$1" "$2"
    sed -E 's/^((JWT_SECRET|DB_PASSWORD|ADMIN_PASSWORD|ALERT_WEBHOOK_URL)=).+$/\1<secret>/'
    printf -- '--- fin ---\n'
  else
    mkdir -p "$(dirname "$ROOT$1")"
    ( umask 077; cat >"$ROOT$1.new" )
    chmod "$2" "$ROOT$1.new"
    mv "$ROOT$1.new" "$ROOT$1"
  fi
}
env_value() { [ -f "$ROOT$1" ] && grep "^$2=" "$ROOT$1" | tail -n 1 | cut -d= -f2- | tr -d "\"'" || true; }

say "Vérifications"
# Nothing of this club may exist already: the script never overwrites.
if [ "$DRY_RUN" -eq 0 ]; then
  for path in "$DIR" "$BACKUP_CMD" "$BACKUP_CRON" "$WATCH_ENV" "$WATCH_CRON"; do
    [ ! -e "$ROOT$path" ] || fail "le club « $SLUG » existe déjà sur ce serveur ($path) : rien n’a été modifié"
  done
  command -v docker >/dev/null 2>&1 || fail "Docker n’est pas installé sur ce serveur"
  docker compose version >/dev/null 2>&1 || fail "le module Compose de Docker manque sur ce serveur"
  if docker compose ls -a --format json 2>/dev/null | grep -q "\"Name\":\"$NAME\""; then
    fail "un projet Docker Compose « $NAME » existe déjà : rien n’a été modifié"
  fi
  for env in "$ROOT"/opt/skycrew/.env "$ROOT"/opt/skycrew-*/.env; do
    [ -f "$env" ] || continue
    [ "$(env_value "${env#"$ROOT"}" PUBLIC_URL)" != "https://$DOMAIN" ] ||
      fail "l’adresse $DOMAIN est déjà celle d’une autre installation ($env)"
  done
fi

# Versions: the ones asked for, otherwise those of the first installation.
[ -n "$BACKEND_VERSION" ] || BACKEND_VERSION=$(env_value "$REFERENCE_DIR/.env" BACKEND_VERSION)
[ -n "$FRONTEND_VERSION" ] || FRONTEND_VERSION=$(env_value "$REFERENCE_DIR/.env" FRONTEND_VERSION)
if [ "$DRY_RUN" -eq 1 ]; then
  BACKEND_VERSION=${BACKEND_VERSION:-<celle de /opt/skycrew>}
  FRONTEND_VERSION=${FRONTEND_VERSION:-<celle de /opt/skycrew>}
else
  [ -n "$BACKEND_VERSION" ] && [ -n "$FRONTEND_VERSION" ] ||
    fail "versions inconnues : donnez --backend et --frontend"
  missing=""
  for image in "backend:$BACKEND_VERSION" "frontend:$FRONTEND_VERSION"; do
    docker image inspect "$REGISTRY/$image" >/dev/null 2>&1 || missing="$missing $image"
  done
  if [ -n "$missing" ] && [ "$START" -eq 1 ]; then
    fail "image(s) absente(s) du serveur :$missing. Relancez avec --no-start, puis chargez-les et démarrez le club avec : BACKUP_CMD=none deploy/release-to-server.sh <serveur> --club $SLUG --backend $BACKEND_VERSION --frontend $FRONTEND_VERSION"
  fi
fi

# A local port nobody listens on and no other installation has taken.
port_taken() {
  [ "$1" = 8100 ] && return 0 # the first installation, whether its .env says so or not
  for env in "$ROOT"/opt/skycrew/.env "$ROOT"/opt/skycrew-*/.env; do
    [ -f "$env" ] && [ "$(env_value "${env#"$ROOT"}" LOCAL_PORT)" = "$1" ] && return 0
  done
  if command -v ss >/dev/null 2>&1; then
    [ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ] && return 0
  elif command -v netstat >/dev/null 2>&1; then
    netstat -an 2>/dev/null | grep -Eq "[.:]$1[[:space:]].*LISTEN" && return 0
  fi
  return 1
}
if [ -n "$PORT" ]; then
  [ "$DRY_RUN" -eq 1 ] || ! port_taken "$PORT" || fail "le port $PORT est déjà pris sur ce serveur"
elif [ "$DRY_RUN" -eq 1 ]; then
  PORT='<premier libre à partir de 8101>'
else
  PORT=8101
  while port_taken "$PORT"; do
    PORT=$((PORT + 1))
    [ "$PORT" -le 8199 ] || fail "aucun port libre entre 8101 et 8199"
  done
fi
echo "club $SLUG : dossier $DIR, projet $NAME, port local $PORT, formule $PLAN"

say "Fichiers du club"
run mkdir -p "$ROOT$DIR"
run chmod 750 "$ROOT$DIR"
for file in docker-compose.yml docker-compose.behind-proxy.yml Caddyfile; do
  put "$DIR/$file" 644 <"$BUNDLE/files/$file"
done
for file in skycrew-backup.sh skycrew-watch.sh; do
  put "$DIR/$file" 755 <"$BUNDLE/files/$file"
done

put "$DIR/.env" 600 <<EOF
# Club $SLUG, written by new-club.sh on $(date +%F). Every value is explained
# in .env.example and README.md of the deployment kit.
COMPOSE_PROJECT_NAME=$NAME
COMPOSE_FILE=docker-compose.yml:docker-compose.behind-proxy.yml
LOCAL_PORT=$PORT
SITE_ADDRESS=:80
PUBLIC_URL=https://$DOMAIN

BACKEND_VERSION=$BACKEND_VERSION
FRONTEND_VERSION=$FRONTEND_VERSION
$(if [ "$REGISTRY" != ghcr.io/skycrew-app ]; then printf 'BACKEND_IMAGE=%s/backend\nFRONTEND_IMAGE=%s/frontend\n' "$REGISTRY" "$REGISTRY"; fi)

DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET

# First administrator. Once they have signed in and changed the password,
# empty ADMIN_PASSWORD (it is only read to create the account).
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Plan of the club: club (everything except instruction) or ecole (everything).
SKYCREW_PLAN=$PLAN
SKYCREW_MAX_AIRCRAFT=$MAX_AIRCRAFT
SKYCREW_MAX_MEMBERS=$MAX_MEMBERS
# 1: suspended by the provider (members see "service suspendu", no change accepted).
SKYCREW_SUSPENDED=

# Outgoing e-mail of the club (activation, password reset, notifications):
# to fill in, then run: docker compose up -d
MAIL_HOST=
MAIL_PORT=587
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM=

# Online payments of the club's members, to the club's own accounts: to fill
# in with the club's keys, then run: docker compose up -d
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
OPENWEATHERMAP_API_KEY=
API_NINJAS_KEY=

DEMO_MODE=false
EOF

put "$NGINX_FILE" 644 <<EOF
# nginx site of the club $SLUG, written by new-club.sh. Not enabled: check it,
# then follow "Mettre en service un nouveau club" in the README of the kit.
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    access_log /var/log/nginx/$NAME.access.log;
    error_log  /var/log/nginx/$NAME.error.log;

    # Uploads are limited to 10 files of 1 MB by the API.
    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Live notifications use a WebSocket.
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 300s;
    }
}
EOF

say "Sauvegarde quotidienne et surveillance"
put "$BACKUP_CMD" 755 <<EOF
#!/bin/sh
# Backup of the club $SLUG only (written by new-club.sh).
exec $ROOT$DIR/skycrew-backup.sh $ROOT$DIR $ROOT$BACKUP_DIR 14
EOF
# A minute of its own for each club, so that two backups do not run together.
case $PORT in *[!0-9]* | '') minute=40 ;; *) minute=$((PORT % 50 + 5)) ;; esac
put "$BACKUP_CRON" 644 <<EOF
# Daily backup of the SkyCrew club $SLUG (written by new-club.sh).
$minute 3 * * * root $ROOT$BACKUP_CMD >/dev/null 2>&1
EOF
put "$WATCH_ENV" 600 <<EOF
HEALTH_URL=http://127.0.0.1:$PORT/health/ready
STATE_FILE=/var/tmp/skycrew-watch-$SLUG.state
ALERT_WEBHOOK_URL=$ALERT_WEBHOOK
MESSAGE_DOWN='SkyCrew ($SLUG, $DOMAIN) ne répond plus'
MESSAGE_UP='SkyCrew ($SLUG, $DOMAIN) répond de nouveau'
EOF
put "$WATCH_CRON" 644 <<EOF
# Checks every two minutes that the SkyCrew club $SLUG answers (written by new-club.sh).
*/2 * * * * root set -a; . $ROOT$WATCH_ENV; set +a; $ROOT$DIR/skycrew-watch.sh
EOF

if [ "$START" -eq 0 ]; then
  say "Club préparé, pas démarré (--no-start)"
elif [ "$DRY_RUN" -eq 1 ]; then
  say "Démarrage"
  printf '   $ cd %s && docker compose up -d\n' "$DIR"
  printf '   (attente que l’API et l’application soient en bonne santé, 3 minutes au plus)\n'
else
  say "Démarrage du club (première fois : création de la base et de l’administrateur)"
  cd "$ROOT$DIR"
  docker compose config -q || fail "la configuration du club n’est pas valide : lisez les lignes ci-dessus"
  docker compose up -d >/dev/null 2>&1 || true
  i=0; ok=0
  while [ $i -lt 60 ]; do
    ok=1
    for service in backend frontend; do
      id=$(docker compose ps -q "$service")
      [ "$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" = healthy ] || ok=0
    done
    [ $ok -eq 0 ] || break
    i=$((i + 1)); sleep 3
  done
  if [ $ok -eq 0 ]; then
    docker compose logs --tail 40 backend frontend >&2 || true
    fail "le club ne démarre pas correctement. Ses fichiers sont restés en place ; pour tout retirer : cd $DIR && docker compose down -v && rm -rf $DIR $BACKUP_CMD $BACKUP_CRON $WATCH_ENV $WATCH_CRON"
  fi
  curl -fs -m 10 -o /dev/null "http://127.0.0.1:$PORT/health/ready" ||
    echo "attention : http://127.0.0.1:$PORT/health/ready ne répond pas encore" >&2
  echo "le club répond sur http://127.0.0.1:$PORT"
fi

say "Site nginx à vérifier puis activer (non activé)"
if [ "$DRY_RUN" -eq 0 ]; then cat "$ROOT$NGINX_FILE"; fi
cat <<EOF

Pour l’activer (voir README, « Mettre en service un nouveau club ») :
  sudo cp $NGINX_FILE /etc/nginx/sites-available/$NAME.conf
  sudo ln -s /etc/nginx/sites-available/$NAME.conf /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot --nginx -d $DOMAIN
EOF
REMOTE

# --- Dry run: everything is shown here, the server is never contacted -----------
if [ $DRY_RUN -eq 1 ]; then
  printf 'Simulation (--dry-run) : rien n’est envoyé au serveur %s, rien n’est modifié.\n' "$HOST"
  printf '\nCommande envoyée au serveur :\n   %s %s sudo sh remote.sh   (fichiers du kit, réglages et secrets par l’entrée standard)\n' "$SSH" "$HOST"
  sh "$BUNDLE/remote.sh" "$BUNDLE"
  printf '\nMot de passe provisoire de %s : généré au vrai lancement, affiché une seule fois.\n' "$ADMIN_EMAIL"
  exit 0
fi

printf 'Installation du club %s (%s) sur %s\n' "$SLUG" "$DOMAIN" "$HOST"
# shellcheck disable=SC2016
COPYFILE_DISABLE=1 tar -cf - -C "$BUNDLE" . | $SSH "$HOST" 'sudo sh -c '\''d=$(mktemp -d) && trap "rm -rf \"$d\"" EXIT && tar -xf - -C "$d" && sh "$d/remote.sh" "$d"'\''' ||
  fail "l’installation sur $HOST n’est pas allée au bout : lisez les lignes ci-dessus"

cat <<EOF

== Terminé
Premier administrateur : $ADMIN_EMAIL
Mot de passe provisoire : $ADMIN_PASSWORD
  (affiché une seule fois : transmettez-le à l’administrateur du club par un
  canal sûr ; il le change dans son profil dès sa première connexion. Il reste
  dans /opt/skycrew-$SLUG/.env jusqu’à ce que vous vidiez ADMIN_PASSWORD.)
Suite : README du kit, « Mettre en service un nouveau club », étapes 4 à 7.
EOF
