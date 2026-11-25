#!/usr/bin/env bash
# Spielt einen Dump in eine Datenbank ein.
#
# Aufruf:
#   scripts/backup/restore.sh <backup.tar.gz.age> <age-schluessel.txt> <ziel-db-url>
#   scripts/backup/restore.sh <entpackter-ordner>                      <ziel-db-url>
#
# Das Ziel muss ein FRISCHES Supabase-Projekt sein (keine Migrationen eingespielt),
# sonst kollidieren die Tabellen. Siehe docs/backup-restore.md.
set -euo pipefail

if [ $# -eq 3 ]; then
  archive="$1"; identity="$2"; db="$3"
  tmpdir="$(mktemp -d)"
  age -d -i "$identity" "$archive" | tar -xz -C "$tmpdir"
  dir="$tmpdir/$(ls "$tmpdir" | head -1)"
elif [ $# -eq 2 ]; then
  dir="$1"; db="$2"
else
  sed -n '2,10p' "$0"; exit 2
fi

for f in roles.sql schema.sql data.sql; do
  [ -f "$dir/$f" ] || { echo "$dir/$f fehlt" >&2; exit 1; }
done
if [ -f "$dir/SHA256SUMS" ]; then (cd "$dir" && { command -v sha256sum >/dev/null && sha256sum --quiet -c SHA256SUMS || shasum -a 256 --quiet -c SHA256SUMS; }); fi
[ -f "$dir/manifest.txt" ] && cat "$dir/manifest.txt"

# roles.sql enthält auch Einstellungen für Supabase-interne Rollen, die man als
# "postgres" nicht immer setzen darf. Fehler dort sind unkritisch und werden nur gemeldet.
role_errors="$(psql -q -X -v ON_ERROR_STOP=0 -f "$dir/roles.sql" -d "$db" 2>&1 >/dev/null | grep -c ERROR || true)"
[ "$role_errors" -gt 0 ] && echo "Hinweis: $role_errors Rollen-Einstellung(en) übersprungen (Supabase-intern, unkritisch)." >&2

# Leere COPY-Blöcke weglassen: sie ändern nichts, scheitern aber an Supabase-internen
# Tabellen (z. B. storage.buckets_vectors), auf die "postgres" keine Schreibrechte hat.
data="$(mktemp)"; trap 'rm -f "$data"; [ -n "${tmpdir:-}" ] && rm -rf "${tmpdir:?}"' EXIT
awk '
  /^COPY / { hdr=$0; n=0; buf=""; inblk=1; next }
  inblk && $0=="\\." { if (n>0) printf "%s\n%s\\.\n", hdr, buf; inblk=0; next }
  inblk { buf=buf $0 "\n"; n++; next }
  { print }
' "$dir/data.sql" > "$data"

# Schema und Daten in EINER Transaktion: entweder alles oder nichts.
psql -q -X --single-transaction -v ON_ERROR_STOP=1 \
  -f "$dir/schema.sql" \
  -c 'SET session_replication_role = replica' \
  -f "$data" -d "$db" >/dev/null

echo "Restore abgeschlossen."
