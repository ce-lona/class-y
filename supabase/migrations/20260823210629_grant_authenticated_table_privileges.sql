-- Wir haben "Automatically expose new tables" bewusst deaktiviert (siehe
-- PLANNING.md), was auch das automatische GRANT an die authenticated-Rolle
-- übernimmt. RLS-Policies allein reichen nicht — Postgres verweigert den
-- Zugriff schon vor der Policy-Prüfung ohne diese Grundrechte.
-- anon bleibt bewusst ohne Rechte: jede Tabelle erfordert eingeloggte Nutzer.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Gilt automatisch auch für Tabellen aus künftigen Migrationen.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
