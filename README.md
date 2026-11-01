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

Alle Befehle werden im Terminal im Projektordner (`class-y/`) ausgeführt, nicht in der Supabase-Weboberfläche.

Voraussetzungen:

- aktuelle Node.js-LTS und npm
- [Docker Desktop](https://docs.docker.com/desktop/) (muss laufen)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), z. B. `brew install supabase/tap/supabase`
- optional Deno für die Edge Functions: wird mit `npm install` mitinstalliert (`npx deno`) oder per `brew install deno`

Schritte:

1. Abhängigkeiten installieren: `npm install`
2. Lokalen Supabase-Stack starten: `supabase start` (beim ersten Mal lädt das mehrere Docker-Images)
3. Datenbank aufbauen: `supabase db reset` (spielt alle Migrationen aus `supabase/migrations/` ein)
4. Umgebungsvariablen anlegen: `cp .env.local.example .env.local`, dann `supabase status` ausführen und
   `NEXT_PUBLIC_SUPABASE_URL` (API URL) sowie `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Publishable bzw. anon key) eintragen.
5. Entwicklungsserver starten: `npm run dev` (http://localhost:3000)
6. Benutzer anlegen: in der lokalen Studio-Oberfläche (URL steht in `supabase status`) unter
   Authentication einen Benutzer erstellen und ihn in `platform_admins` eintragen (siehe unten).

Stoppen mit `supabase stop`. Gegen ein gehostetes Projekt: `supabase link --project-ref <ref>` und `supabase db push`.

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

## Vertragsannahme

Verträge zwischen Company und Trainer:in sind erst wirksam, wenn die Trainer:in sie annimmt:

1. `company_admin`/`platform_admin` bieten einen Vertrag an (`offer_contract`, Status `pending`).
2. Die Trainer:in sieht das Angebot über `get_my_contracts` und nimmt es an (`accept_contract`) oder lehnt es ab (`decline_contract`).
3. Erst ein angenommener Vertrag (`active`) berechtigt zum Erfassen von Kursen und macht das Profil für die Company sichtbar.
   Die Datenbank verhindert, dass Admins die Annahme umgehen; nach der Annahme sind die Konditionen gesperrt.

Die Oberfläche dafür liegt unter **Einstellungen** (`/settings`): Trainer:innen sehen dort ihre Angebote
und Verträge und nehmen sie an oder lehnen sie ab; Company-Admins bieten Verträge an, sehen den Status
aller Verträge ihrer Company und können Angebote zurückziehen bzw. Verträge beenden. Die Datenzugriffe
stehen in `lib/contracts.ts`.

## Tests

- Lint: `npm run lint`
- Edge Functions: `npm run functions:lint` (Deno) und `npm run functions:check` (Typprüfung, braucht Internet für JSR-Pakete)
- Datenbank/RLS: `supabase test db` (pgTAP, `supabase/tests/database/`) prüft, dass jede Tabelle in
  `public` RLS aktiviert hat und `anon` keine security-definer-Funktionen ausführen darf
- Edge Functions lokal ausführen: `supabase functions serve --env-file supabase/.env.local`
  (für `create-test-admin` dort `ALLOW_TEST_ADMIN=true` setzen)
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
