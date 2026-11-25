#!/usr/bin/env bash
# Restore-Test: spielt einen Dump (roles.sql, schema.sql, data.sql) in eine
# frische, temporäre Supabase-Instanz ein und prüft, dass jede Tabelle genau
# so viele Zeilen hat wie im Dump. Die Instanz läuft auf eigenen Ports
# (553xx) und wird danach wieder entfernt; deine lokale Dev-DB bleibt unberührt.
#
# Benötigt: Supabase CLI, Docker, psql
# Aufruf:   scripts/backup/verify-restore.sh <ordner-mit-dump>
#           scripts/backup/verify-restore.sh <backup.tar.gz.age> <age-schluessel.txt>
set -euo pipefail

work="$(mktemp -d)"
cleanup() { (cd "$work" && supabase stop --no-backup >/dev/null 2>&1) || true; rm -rf "${work:?}"; }
trap cleanup EXIT

if [ $# -eq 2 ]; then
  mkdir -p "$work/backup"
  age -d -i "$2" "$1" | tar -xz -C "$work/backup"
  dump="$work/backup/$(ls "$work/backup" | head -1)"
  echo "Entschlüsselt: $(basename "$1")"
else
  dump="$(cd "${1:?Ordner mit roles.sql/schema.sql/data.sql fehlt}" && pwd)"
fi
for f in roles.sql schema.sql data.sql; do
  [ -f "$dump/$f" ] || { echo "$dump/$f fehlt" >&2; exit 1; }
done
if [ -f "$dump/SHA256SUMS" ]; then (cd "$dump" && { command -v sha256sum >/dev/null && sha256sum --quiet -c SHA256SUMS || shasum -a 256 --quiet -c SHA256SUMS; }); fi

mkdir -p "$work/supabase"
cat > "$work/supabase/config.toml" <<'TOML'
project_id = "class-y-restore-test"

[api]
port = 55321

[db]
port = 55322
shadow_port = 55320
major_version = 17

[db.pooler]
port = 55329

[db.seed]
enabled = false

[studio]
enabled = false
port = 55323

[local_smtp]
enabled = false
port = 55324

[edge_runtime]
enabled = false

[analytics]
enabled = false
port = 55327
TOML

echo "Starte temporäre Supabase-Instanz ..."
(cd "$work" && supabase start -x studio,imgproxy,edge-runtime,logflare,vector,postgres-meta,mailpit,supavisor >/dev/null)
db="postgresql://postgres:postgres@127.0.0.1:55322/postgres"

echo "Spiele Backup ein ..."
"$(dirname "$0")/restore.sh" "$dump" "$db" >/dev/null

echo "Vergleiche Zeilenzahlen ..."
# Erwartete Zeilen je Tabelle direkt aus den COPY-Blöcken in data.sql zählen.
expected="$(awk '
  /^COPY / { t=$2; n=0; inblk=1; next }
  inblk && $0=="\\." { print t "\t" n; inblk=0; next }
  inblk { n++ }
' "$dump/data.sql")"

tables=0; rows=0; bad=0
while IFS=$'\t' read -r table want; do
  [ -n "$table" ] || continue
  [ "$want" -gt 0 ] || continue
  got="$(psql -X -At -v ON_ERROR_STOP=1 -d "$db" -c "select count(*) from $table")"
  tables=$((tables+1)); rows=$((rows+want))
  if [ "$got" != "$want" ]; then
    echo "::error::$table: erwartet $want Zeilen, wiederhergestellt $got" >&2
    bad=$((bad+1))
  fi
done <<< "$expected"

for t in public.companies auth.users; do
  if ! grep -q "^COPY \"${t%%.*}\".\"${t#*.}\"" "$dump/data.sql"; then
    echo "::error::$t fehlt im Dump" >&2; bad=$((bad+1))
  fi
done

if [ "$bad" -gt 0 ]; then
  echo "Restore-Test FEHLGESCHLAGEN ($bad Abweichungen)" >&2
  exit 1
fi
echo "Restore-Test OK: $tables Tabellen, $rows Zeilen wiederhergestellt."
