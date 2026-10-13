#!/bin/sh
# Tells you when SkyCrew stops answering, and when it answers again.
# Meant for cron, every two minutes, on the server or on another machine:
#
#   */2 * * * * root HEALTH_URL=https://skycrew.example/health ALERT_WEBHOOK_URL=https://… /usr/local/sbin/skycrew-watch
#
#   HEALTH_URL          address checked                     (default http://127.0.0.1:8100/health)
#   ALERT_WEBHOOK_URL   where the message is posted as JSON; works with Slack,
#                       Discord and most chat webhooks ("text" and "content" are both sent)
#   ALERT_EMAIL         address written to with the local `mail` command, if there is one
#   FAILURES_BEFORE_ALERT   consecutive failed checks before alerting (default 2)
#   STATE_FILE          where the number of failures is kept (default /var/tmp/skycrew-watch.state)
set -eu

HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:8100/health}
THRESHOLD=${FAILURES_BEFORE_ALERT:-2}
STATE_FILE=${STATE_FILE:-/var/tmp/skycrew-watch.state}

notify() {
  message=$1
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -fsS -m 10 -H 'Content-Type: application/json' \
      -d "{\"text\":\"$message\",\"content\":\"$message\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true
  fi
  if [ -n "${ALERT_EMAIL:-}" ] && command -v mail >/dev/null 2>&1; then
    printf '%s\n' "$message" | mail -s "SkyCrew" "$ALERT_EMAIL" || true
  fi
  logger -t skycrew-watch "$message" 2>/dev/null || true
}

failures=$(cat "$STATE_FILE" 2>/dev/null || echo 0)

if curl -fsS -m 10 -o /dev/null "$HEALTH_URL"; then
  [ "$failures" -ge "$THRESHOLD" ] && notify "SkyCrew answers again ($HEALTH_URL)."
  echo 0 > "$STATE_FILE"
  exit 0
fi

failures=$((failures + 1))
echo "$failures" > "$STATE_FILE"
# One message when the threshold is reached, not one at every check.
[ "$failures" -eq "$THRESHOLD" ] && notify "SkyCrew does not answer ($HEALTH_URL), $failures checks in a row."
exit 0
