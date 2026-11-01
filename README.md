# class-y

Web-App für Studios und ihre Trainer:innen: gehaltene Kurse erfassen, Studios einen Überblick
geben und später Gutschriften/Belege automatisiert abwickeln. Installierbar als PWA, Oberfläche
auf Deutsch, Code auf Englisch.

> **Status:** frühe Entwicklung. Vieles ist noch im Aufbau, und die Datenbankstruktur kann sich ändern.

## Funktionen (aktueller Stand)

- Login und rollenbasierte Navigation (`trainer`, `studio_admin`, `platform_admin`)
- Verwaltung von Firmen und Studios durch Plattform-Admins
- Einladung von Company-Admins per E-Mail
- Hell-/Dunkelmodus, Landing Page, installierbar als PWA

Das Datenmodell für Kurspläne, Verträge und erfasste Kurse ist bereits angelegt
(`supabase/migrations/`); die zugehörigen Oberflächen entstehen schrittweise.

## Tech-Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4, shadcn/ui
- TanStack Query, Zustand, React Hook Form + Zod
- Supabase: Auth, Postgres mit Row Level Security, Edge Functions
- Playwright für E2E-Tests

## Rollen

- `trainer`: pflegt eigene Stammdaten, sieht eigene Verträge (nur lesend) und erfasst Kurse
- `studio_admin`: Admin einer Firma (immer firmenweit, nicht pro Studio)
- `platform_admin`: globale Rolle für die Plattformverwaltung

Zugriffsrechte werden in der Datenbank per Row Level Security durchgesetzt, nicht nur im Frontend.

## Lokal starten

Voraussetzungen: aktuelle Node.js-LTS, npm und ein Supabase-Projekt (gehostet oder lokal über die
[Supabase CLI](https://supabase.com/docs/guides/local-development)).

1. Abhängigkeiten installieren: `npm install`
2. Umgebungsvariablen anlegen: `cp .env.local.example .env.local` und
   `NEXT_PUBLIC_SUPABASE_URL` sowie `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` eintragen.
3. Datenbank einrichten: Migrationen aus `supabase/migrations/` einspielen
   (`supabase link` und `supabase db push`, lokal `supabase start` und `supabase db reset`).
4. Entwicklungsserver starten: `npm run dev` (http://localhost:3000)

### Ersten Plattform-Admin anlegen

Die Migration `*_seed_platform_admin.sql` enthält den Platzhalter `REPLACE_ME_ADMIN_EMAIL`.
Ersetze ihn vor dem Einspielen durch die E-Mail-Adresse des ersten Admins. Die Person muss zu
diesem Zeitpunkt bereits in `auth.users` existieren, sonst passiert nichts. Alternativ trägst du
den Admin nachträglich per SQL in `platform_admins` ein.

### Edge Functions

- `invite-company-admin`: lädt Company-Admins ein (nur für `platform_admin`)
- `create-test-admin`: Hilfsfunktion **nur für die Entwicklung**. Sie antwortet nur, wenn das
  Function-Secret `ALLOW_TEST_ADMIN=true` gesetzt ist, und sollte nicht in produktive Umgebungen
  deployt werden.

Der Service-Role-Key gehört ausschließlich in die Edge Functions und niemals ins Frontend oder
in dieses Repository.

## Tests

- Lint: `npm run lint`
- Datenbank/RLS: `supabase test db` (pgTAP, `supabase/tests/database/`) prüft, dass jede Tabelle in
  `public` RLS aktiviert hat und `anon` keine security-definer-Funktionen ausführen darf
- E2E: `npm run test:e2e` (Playwright, startet den Entwicklungsserver). Die Tests brauchen
  `E2E_PLATFORM_ADMIN_EMAIL` und `E2E_PLATFORM_ADMIN_PASSWORD` eines bestehenden
  `platform_admin`-Kontos in `.env.local`.

## Hinweis zur KI-Nutzung

Dieses Repository enthält Konfigurationsdateien für KI-Assistenten (`CLAUDE.md`, `AGENTS.md`) und
wurde teilweise mit KI-Unterstützung entwickelt. Commits mit KI-Anteil sind mit `[ai]`
gekennzeichnet; die zugehörigen Prompts stehen in der Commit-Nachricht.

## Lizenz

Copyright (C) 2026 Jennifer Donath

Dieses Projekt steht unter der [GNU Affero General Public License v3.0](./LICENSE). Wer eine
veränderte Version als Netzwerkdienst betreibt, muss den Nutzer:innen den Quellcode dieser
Version zur Verfügung stellen.
