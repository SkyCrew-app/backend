#!/bin/sh
# Installs (or updates) the SkyCrew console on the server that runs the clubs.
# Run it on the server, as root, from a copy of the backend repository:
#
#   sudo console/deploy/install.sh --domain console.example.fr [--dry-run]
#   sudo console/deploy/install.sh --helper-only --authorized-key console.pub [--dry-run]
#
#   --domain           address of the console (written in its nginx site and settings)
#   --helper-only      on another server run by the console over SSH: installs only the
#                      helper, its kit, a user skycrew-console allowed in by that key, and sudoers
#   --authorized-key   public SSH key of the console (file), with --helper-only
#   --dry-run          shows every file and command, changes nothing
#
# What it does (the console): a system user skycrew-console (not in the docker
# group), the application in /opt/skycrew-console/app (owned by root), the
# deployment kit in /usr/local/lib/skycrew-console/kit, the helper in
# /usr/local/sbin/skycrew-console-helper, /etc/sudoers.d/skycrew-console (checked
# with visudo), settings in /etc/skycrew-console/ (kept if present), the
# database folder /var/lib/skycrew-console, the systemd service (started), the
# command skycrew-console, and the nginx site, written but NOT enabled.
# It never touches the clubs, nginx's enabled sites, or other software.
set -eu

usage() { sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 64; }
say() { printf '\n== %s\n' "$*"; }
fail() { printf '\nÉCHEC : %s\n' "$*" >&2; exit 1; }

DOMAIN=""; HELPER_ONLY=0; KEY_FILE=""; DRY_RUN=0
while [ $# -gt 0 ]; do
  case $1 in
    --domain) [ $# -ge 2 ] || usage; DOMAIN=$2; shift 2 ;;
    --helper-only) HELPER_ONLY=1; shift ;;
    --authorized-key) [ $# -ge 2 ] || usage; KEY_FILE=$2; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) usage ;;
  esac
done

CONSOLE=$(cd "$(dirname "$0")/.." && pwd)
DEPLOY=$(cd "$CONSOLE/../deploy" && pwd)
USER_NAME=skycrew-console
APP=/opt/skycrew-console/app
KIT=/usr/local/lib/skycrew-console/kit
HELPER=/usr/local/sbin/skycrew-console-helper
ETC=/etc/skycrew-console
DATA=/var/lib/skycrew-console
KIT_FILES="clubs-remote.sh release-lib.sh new-club.sh docker-compose.yml docker-compose.behind-proxy.yml Caddyfile skycrew-backup.sh skycrew-watch.sh"

run() { if [ $DRY_RUN -eq 1 ]; then printf '   $ %s\n' "$*"; else "$@"; fi; }
# Writes a file from the standard input with an owner and rights; shown in a dry run.
put() { # <path> <owner:group> <mode>
  if [ $DRY_RUN -eq 1 ]; then
    printf '\n--- %s (%s, %s) ---\n' "$1" "$2" "$3"; cat; printf -- '--- fin ---\n'
  else
    mkdir -p "$(dirname "$1")"
    cat >"$1.new"; chown "$2" "$1.new"; chmod "$3" "$1.new"; mv "$1.new" "$1"
  fi
}
# Same, but a dry run names the file without showing it (program files).
put_file() { # <path> <owner:group> <mode>
  if [ $DRY_RUN -eq 1 ]; then cat >/dev/null; printf '   fichier %s (%s, %s)\n' "$1" "$2" "$3"; else put "$@"; fi
}
# Settings written once: a second install keeps what the owner filled in.
put_once() { # <path> <owner:group> <mode>
  if [ -f "$1" ] && [ $DRY_RUN -eq 0 ]; then cat >/dev/null; echo "gardé tel quel : $1"; else put "$@"; fi
}

# --- Checks ---------------------------------------------------------------------------
say "Vérifications"
if [ $DRY_RUN -eq 0 ]; then
  [ "$(id -u)" = 0 ] || fail "à lancer en root : sudo $0 ..."
  command -v docker >/dev/null 2>&1 || fail "Docker n’est pas installé"
  command -v sudo >/dev/null 2>&1 || fail "sudo n’est pas installé"
  command -v visudo >/dev/null 2>&1 || fail "visudo n’est pas installé"
fi
for file in $KIT_FILES; do [ -f "$DEPLOY/$file" ] || fail "fichier du kit manquant : deploy/$file"; done
grep -q SKYCREW_SUSPENDED "$DEPLOY/docker-compose.yml" || fail "deploy/docker-compose.yml ne connaît pas SKYCREW_SUSPENDED : copie du dépôt trop ancienne"
if [ $HELPER_ONLY -eq 1 ]; then
  [ -n "$KEY_FILE" ] && [ -f "$KEY_FILE" ] || fail "--helper-only demande --authorized-key <fichier de la clé publique de la console>"
  grep -Eq '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-[a-z0-9-]+) [A-Za-z0-9+/=]+( .*)?$' "$KEY_FILE" || fail "$KEY_FILE n’est pas une clé publique SSH"
else
  [ -n "$DOMAIN" ] || fail "--domain : l’adresse de la console (par exemple console.skycrew.fr)"
  printf '%s\n' "$DOMAIN" | grep -Eq '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' || fail "--domain : une adresse sans https://"
  if [ $DRY_RUN -eq 0 ]; then
    command -v node >/dev/null 2>&1 || fail "Node.js 24 n’est pas installé (voir le README de la console)"
    major=$(node -p 'process.versions.node.split(".")[0]')
    [ "$major" -ge 24 ] || fail "Node.js $major trouvé, il faut la version 24 ou plus"
    [ "$(command -v node)" = /usr/bin/node ] || echo "attention : node est $(command -v node), le service lance /usr/bin/node" >&2
    command -v npm >/dev/null 2>&1 || fail "npm n’est pas installé"
  fi
fi
echo "ok"

# --- User -----------------------------------------------------------------------------
say "Utilisateur $USER_NAME (sans accès direct à Docker)"
if id "$USER_NAME" >/dev/null 2>&1; then
  echo "existe déjà"
  if [ $DRY_RUN -eq 0 ] && id -nG "$USER_NAME" | tr ' ' '\n' | grep -qx docker; then
    fail "$USER_NAME est dans le groupe docker : retirez-le (gpasswd -d $USER_NAME docker), il n’en a pas besoin"
  fi
elif [ $HELPER_ONLY -eq 1 ]; then
  run useradd --system --create-home --home-dir "$DATA" --shell /bin/sh "$USER_NAME"
else
  run useradd --system --create-home --home-dir "$DATA" --shell /usr/sbin/nologin "$USER_NAME"
fi
run chmod 700 "$DATA"

# --- Kit and helper ---------------------------------------------------------------------
say "Kit de déploiement et outil privilégié"
run mkdir -p "$KIT"
for file in $KIT_FILES; do
  case $file in *.sh) mode=755 ;; *) mode=644 ;; esac
  put_file "$KIT/$file" root:root "$mode" <"$DEPLOY/$file"
done
put_file "$KIT/local-ssh" root:root 755 <"$CONSOLE/helper/local-ssh"
put_file "$HELPER" root:root 750 <"$CONSOLE/helper/skycrew-console-helper"
put_once "$ETC/helper.conf" root:root 644 <"$CONSOLE/deploy/helper.conf.example"
run mkdir -p /run/lock/skycrew-console

say "Droit sudo limité à l’outil"
if [ $DRY_RUN -eq 1 ]; then
  put /etc/sudoers.d/skycrew-console root:root 440 <"$CONSOLE/deploy/sudoers"
else
  cp "$CONSOLE/deploy/sudoers" /etc/sudoers.d/.skycrew-console.check
  chmod 440 /etc/sudoers.d/.skycrew-console.check
  if ! visudo -cf /etc/sudoers.d/.skycrew-console.check >/dev/null; then
    rm -f /etc/sudoers.d/.skycrew-console.check
    fail "visudo refuse le fichier sudoers : rien n’a été activé"
  fi
  mv /etc/sudoers.d/.skycrew-console.check /etc/sudoers.d/skycrew-console
  echo "ok (vérifié par visudo)"
fi

if [ $HELPER_ONLY -eq 1 ]; then
  say "Accès SSH de la console"
  key=$(head -n 1 "$KEY_FILE")
  printf 'restrict %s\n' "$key" | put "$DATA/.ssh/authorized_keys" "$USER_NAME:$USER_NAME" 600
  run chmod 700 "$DATA/.ssh"
  run chown "$USER_NAME:$USER_NAME" "$DATA/.ssh"
  say "Terminé"
  echo "Sur la console, ajoutez ce serveur à CONSOLE_SERVERS : nom=ssh:$USER_NAME@<adresse de ce serveur>"
  exit 0
fi

# --- Application ----------------------------------------------------------------------
say "Application dans $APP (propriété de root : la console ne peut pas se modifier)"
run rm -rf "$APP.new"
run mkdir -p "$APP.new"
for part in bin src public package.json package-lock.json; do run cp -R "$CONSOLE/$part" "$APP.new/"; done
if [ $DRY_RUN -eq 1 ]; then
  printf '   $ cd %s && npm ci --omit=dev --ignore-scripts --no-audit --no-fund\n' "$APP.new"
else
  (cd "$APP.new" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null) || fail "npm ci a échoué : l’ancienne version reste en place"
  chown -R root:root "$APP.new"; chmod -R go-w "$APP.new"
fi
run rm -rf "$APP.old"
if [ -d "$APP" ] || [ $DRY_RUN -eq 1 ]; then run mv "$APP" "$APP.old"; fi
run mv "$APP.new" "$APP"

say "Réglages dans $ETC"
run mkdir -p "$ETC"
sed -e "s|^CONSOLE_PUBLIC_URL=.*|CONSOLE_PUBLIC_URL=https://$DOMAIN|" \
    -e "s|^CONSOLE_SERVERS=.*|CONSOLE_SERVERS=$(hostname -s 2>/dev/null | tr 'A-Z_' 'a-z-' | cut -c1-30 || echo local)=local|" \
    "$CONSOLE/deploy/console.env.example" | put_once "$ETC/console.env" "root:$USER_NAME" 640
put_file "$ETC/nginx-proxy-headers.conf" root:root 644 <"$CONSOLE/deploy/nginx-proxy-headers.conf"
port=8090
[ ! -f "$ETC/console.env" ] || port=$(grep '^CONSOLE_PORT=' "$ETC/console.env" | cut -d= -f2 | tr -dc 0-9)
sed -e "s/CONSOLE_DOMAIN/$DOMAIN/g" -e "s/CONSOLE_PORT/${port:-8090}/g" "$CONSOLE/deploy/nginx-console.conf" |
  put "$ETC/nginx-console.conf" root:root 644

say "Commande skycrew-console"
put /usr/local/bin/skycrew-console root:root 755 <<EOF2
#!/bin/sh
# The command line of the SkyCrew console, run as its own user with its settings.
[ "\$(id -u)" = 0 ] || exec sudo "\$0" "\$@"
exec runuser -u $USER_NAME -- sh -c 'set -a; . $ETC/console.env; set +a; exec /usr/bin/node --disable-warning=ExperimentalWarning $APP/bin/skycrew-console.ts "\$@"' skycrew-console "\$@"
EOF2

say "Clé SSH de la console (pour d’autres serveurs plus tard)"
if [ $DRY_RUN -eq 1 ] || [ ! -f "$DATA/.ssh/id_ed25519" ]; then
  run mkdir -p "$DATA/.ssh"
  run ssh-keygen -q -t ed25519 -N '' -C "skycrew-console@$DOMAIN" -f "$DATA/.ssh/id_ed25519"
  run chown -R "$USER_NAME:$USER_NAME" "$DATA/.ssh"
  run chmod 700 "$DATA/.ssh"
else
  echo "existe déjà"
fi

say "Service systemd"
put_file /etc/systemd/system/skycrew-console.service root:root 644 <"$CONSOLE/deploy/skycrew-console.service"
run systemctl daemon-reload
run systemctl enable skycrew-console
run systemctl restart skycrew-console
if [ $DRY_RUN -eq 0 ]; then
  i=0
  until curl -fs -m 2 -o /dev/null "http://127.0.0.1:${port:-8090}/healthz"; do
    i=$((i + 1)); [ $i -lt 20 ] || fail "la console ne répond pas : journalctl -u skycrew-console -n 50"
    sleep 1
  done
  echo "la console répond sur 127.0.0.1:${port:-8090}"
  run rm -rf "$APP.old"
fi

[ $DRY_RUN -eq 0 ] || printf '\nSimulation (--dry-run) : rien n’a été modifié.\n'
cat <<EOF2

== Terminé
Ensuite (README de la console, « Installer la console ») :
  1. Faites pointer $DOMAIN vers ce serveur (DNS, type A).
  2. Créez votre compte :      sudo skycrew-console create-owner
  3. Vérifiez :                sudo skycrew-console check
  4. Activez le site (nginx -t avant tout rechargement, jamais restart) :
       sudo cp $ETC/nginx-console.conf /etc/nginx/sites-available/skycrew-console.conf
       sudo ln -s /etc/nginx/sites-available/skycrew-console.conf /etc/nginx/sites-enabled/
       sudo nginx -t && sudo systemctl reload nginx
       sudo certbot --nginx -d $DOMAIN --redirect
  5. Stripe : README, « Relier Stripe », puis STRIPE_WEBHOOK_SECRET dans $ETC/console.env
     et sudo systemctl restart skycrew-console
EOF2
