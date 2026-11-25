#!/usr/bin/env bash
# Erstellt einen vollständigen Dump der Supabase-Datenbank (Rollen, Schema, Daten)
# so wie es die Supabase-Doku für Backups/Umzüge empfiehlt.
#
# Benötigt: Supabase CLI (+ Docker), env SUPABASE_DB_URL
# Aufruf:   scripts/backup/dump.sh <ausgabe-ordner>
set -euo pipefail

out="${1:?Ausgabe-Ordner fehlt}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL ist nicht gesetzt}"
mkdir -p "$out"

supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$out/roles.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "$out/data.sql"

for f in roles.sql schema.sql data.sql; do
  [ -s "$out/$f" ] || { echo "::error::$f ist leer" >&2; exit 1; }
done

{
  echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "supabase_cli=$(supabase --version)"
  echo "git_commit=${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
  echo "latest_migration=$(ls supabase/migrations 2>/dev/null | tail -1)"
} > "$out/manifest.txt"
(cd "$out" && sha256sum roles.sql schema.sql data.sql > SHA256SUMS)

echo "Dump fertig: $(du -sh "$out" | cut -f1)"
