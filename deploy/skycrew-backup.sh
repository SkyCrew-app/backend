#!/bin/sh
# Backs up one SkyCrew installation: its database, its uploaded files and its
# .env (needed to restore). Meant for cron, once a day, as root:
#
#   skycrew-backup.sh <deployment folder> <backup folder> [days kept]
#
#   deployment folder   where its docker-compose.yml and .env are (e.g. /opt/skycrew-aeroclub-x)
#   backup folder       where the archives go (e.g. /var/backups/skycrew-aeroclub-x)
#   days kept           older archives are deleted (default 14)
#
# Only the installation of that folder is read: the other clubs of the server
# are left alone. Exits with a status other than 0 when a part failed.
set -eu

[ $# -ge 2 ] || { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 64; }
DEPLOY_DIR=$1
BACKUP_DIR=$2
KEEP_DAYS=${3:-14}

cd "$DEPLOY_DIR"
umask 077
mkdir -p "$BACKUP_DIR"
stamp=$(date +%F-%H%M)

# Written to a file first: in a pipe, a failed dump would go unnoticed.
docker compose exec -T db pg_dump -U skycrew skycrew >"$BACKUP_DIR/db-$stamp.sql"
gzip -f "$BACKUP_DIR/db-$stamp.sql"

# Licences, maintenance documents, pictures: read through the API container,
# which holds them, so that no other image is needed.
docker compose exec -T backend tar czf - -C /usr/src/app/dist/src/uploads . \
  >"$BACKUP_DIR/uploads-$stamp.tar.gz"

cp .env "$BACKUP_DIR/env-$stamp"

find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete
echo "backup of $DEPLOY_DIR written to $BACKUP_DIR ($stamp)"
