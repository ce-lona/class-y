#!/usr/bin/env bash
# Lädt ein verschlüsseltes Backup per WebDAV auf IONOS HiDrive hoch und räumt
# alte Backups auf.
#
#   <HIDRIVE_PATH>/daily/    die letzten KEEP_DAILY Backups (Standard 30)
#   <HIDRIVE_PATH>/monthly/  das Backup vom 1. jedes Monats, KEEP_MONTHLY Stück (Standard 12)
#
# Aufgeräumt wird nach Anzahl, nicht nach Alter: Fallen Backups ein paar Tage aus,
# bleiben trotzdem immer die letzten N erhalten.
#
# Benötigt: rclone; env HIDRIVE_USER, HIDRIVE_PASSWORD, HIDRIVE_PATH
# Optional: HIDRIVE_URL (Standard https://webdav.hidrive.ionos.com)
# Aufruf:   scripts/backup/upload-hidrive.sh <datei>
set -euo pipefail

file="${1:?Datei fehlt}"
: "${HIDRIVE_USER:?HIDRIVE_USER ist nicht gesetzt}"
: "${HIDRIVE_PASSWORD:?HIDRIVE_PASSWORD ist nicht gesetzt}"
: "${HIDRIVE_PATH:?HIDRIVE_PATH ist nicht gesetzt (z. B. users/<benutzer>/class-y-backups)}"
keep_daily="${KEEP_DAILY:-30}"
keep_monthly="${KEEP_MONTHLY:-12}"
base="${HIDRIVE_PATH#/}"; base="${base%/}"
name="$(basename "$file")"

export RCLONE_CONFIG_HIDRIVE_TYPE=webdav
export RCLONE_CONFIG_HIDRIVE_URL="${HIDRIVE_URL:-https://webdav.hidrive.ionos.com}"
export RCLONE_CONFIG_HIDRIVE_VENDOR=other
export RCLONE_CONFIG_HIDRIVE_USER="$HIDRIVE_USER"
RCLONE_CONFIG_HIDRIVE_PASS="$(rclone obscure "$HIDRIVE_PASSWORD")"
export RCLONE_CONFIG_HIDRIVE_PASS
rc=(rclone --retries 5 --low-level-retries 10 --stats-log-level DEBUG --no-gzip-encoding)

"${rc[@]}" mkdir "hidrive:$base/daily"
"${rc[@]}" copyto "$file" "hidrive:$base/daily/$name"

# Hochgeladene Größe prüfen.
local_size="$(stat -c %s "$file")"
remote_size="$("${rc[@]}" lsf --format s "hidrive:$base/daily/$name")"
if [ "$local_size" != "$remote_size" ]; then
  echo "::error::Upload unvollständig: lokal $local_size Bytes, HiDrive $remote_size Bytes" >&2
  exit 1
fi
echo "Hochgeladen: $base/daily/$name ($local_size Bytes)"

if [ "$(date -u +%d)" = "01" ] || [ "${FORCE_MONTHLY:-}" = "1" ]; then
  "${rc[@]}" mkdir "hidrive:$base/monthly"
  "${rc[@]}" copyto "$file" "hidrive:$base/monthly/$name"
  echo "Monatsbackup abgelegt: $base/monthly/$name"
fi

# Aufräumen: Dateinamen enthalten das Datum (class-y-YYYY-MM-DD...), also sortiert
# "sort" sie chronologisch. Alles außer den neuesten N wird gelöscht.
prune() {
  local dir="$1" keep="$2" old
  old="$("${rc[@]}" lsf --files-only "hidrive:$base/$dir" 2>/dev/null \
        | grep -E '^class-y-[0-9]{4}-[0-9]{2}-[0-9]{2}.*\.age$' | sort | head -n "-$keep" || true)"
  [ -n "$old" ] || return 0
  while IFS= read -r f; do
    "${rc[@]}" deletefile "hidrive:$base/$dir/$f" </dev/null
    echo "Gelöscht (älter als die letzten $keep): $dir/$f"
  done <<< "$old"
}
prune daily "$keep_daily"
prune monthly "$keep_monthly"
