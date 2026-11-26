# class-y

> 📄 **DevOps-Projekt (BHT WiSe 2026):**
> - **Milestone 1 – Projektkonzept:** [**`docs/concept.md`**](./docs/concept.md)
> - **Uni-Fork (Infrastruktur, OpenTofu, Ansible & Monitoring):** [**`github.com/ce-lona/class-y-devops`**](https://github.com/ce-lona/class-y-devops)

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
- `invite-trainer`: lädt Trainer:innen ein und bietet ihnen einen Vertrag an (nur für Company-Admins der jeweiligen Company bzw. `platform_admin`)
- `create-test-admin`: Hilfsfunktion **nur für die lokale Entwicklung**. Sie antwortet nur gegen
  den lokalen Supabase-Stack (`SUPABASE_URL` zeigt auf `kong`/`localhost`) und nur mit dem
  Function-Secret `ALLOW_TEST_ADMIN=true`; auf gehosteten Projekten bleibt sie immer aus. Die
  Oberfläche dafür erscheint nur unter `next dev`.

Der Service-Role-Key gehört ausschließlich in die Edge Functions und niemals ins Frontend oder
in dieses Repository.

## Konten und Einladungen

Es gibt **keine Selbstregistrierung** (`[auth] enable_signup = false` in `supabase/config.toml`).
Der E-Mail-Provider selbst bleibt aktiv (`[auth.email] enable_signup = true`), sonst ist auch
der Login abgeschaltet.

Einladungen werden serverseitig verschickt und können keinen PKCE-Code liefern. Der Link in der
Einladungsmail (`supabase/templates/invite.html`) führt deshalb mit `token_hash` auf
`/auth/confirm`, das die Einladung per `verifyOtp` einlöst und auf `/reset-password` weiterleitet.

Passwörter brauchen mindestens 8 Zeichen (`minimum_password_length` in `supabase/config.toml`).
Beim Setzen prüft die App sie zusätzlich gegen die HaveIBeenPwned-Datenbank geleakter Passwörter
(`lib/passwordBreach.ts`, k-Anonymität: nur die ersten 5 Zeichen des SHA-1-Hashs verlassen den
Browser). Die Anfrage läuft über `app/api/pwned-range`, damit HIBP nur die Server-IP sieht. Ist
die API nicht erreichbar, wird das Passwort durchgelassen.

Auf einem gehosteten Projekt zusätzlich im Dashboard:

- Authentication → Sign In / Providers → Email: "Minimum password length" auf 8 setzen
- Authentication → Sign In / Providers: "Allow new users to sign up" ausschalten, Provider "Email" aktiv lassen
- Authentication → URL Configuration: Site URL = Adresse der App, Redirect URLs passend ergänzen
- Authentication → Emails → "Invite user": Inhalt aus `supabase/templates/invite.html` übernehmen
- Authentication → Emails → "Reset password": Inhalt aus `supabase/templates/recovery.html` übernehmen
- Authentication → SMTP Settings (Produktion): Custom SMTP (Resend, `noreply@class-y.de`) aktivieren

- `platform_admin` legt Companies an und lädt Company-Admins ein (Edge Function `invite-company-admin`).
- Company-Admins laden Trainer:innen ein und bieten ihnen dabei direkt einen Vertrag an
  (Edge Function `invite-trainer`, Oberfläche unter Einstellungen). Die Person setzt über den
  Einladungslink ihr Passwort und nimmt das Angebot dann an.

Nach Änderungen an `supabase/config.toml` den lokalen Stack neu starten (`supabase stop && supabase start`)
und die Edge Functions lokal mit `supabase functions serve` laufen lassen.

## Hilfe & Support

Jede Rolle hat unter **Hilfe** (`/help`) einen Rundgang, das Handbuch und ein Kontaktformular.

- Kontaktformular → Edge Function `send-support-message` → Mail an alle Adressen aus
  **Plattform → Einstellungen** (`/platform-settings`, Tabelle `support_recipients`). Reply-To ist die
  absendende Person. Jede Nachricht wird zusätzlich in `support_messages` gespeichert und ist dort
  auch sichtbar, falls der Versand scheitert (max. 5 Nachrichten pro Stunde und Person).
- SMTP-Secrets (gehostet: `supabase secrets set ...`; Supabase blockt Port 25/587, daher 465):
  - `SUPPORT_SMTP_HOST=smtp.resend.com`, `SUPPORT_SMTP_PORT=465`, `SUPPORT_SMTP_USER=resend`,
    `SUPPORT_SMTP_PASS=<Resend-API-Key>`, `SUPPORT_SMTP_FROM=noreply@class-y.de`
  - lokal (Mailpit): `SUPPORT_SMTP_HOST=inbucket`, `SUPPORT_SMTP_PORT=1025`,
    `SUPPORT_SMTP_SECURE=false`, `SUPPORT_SMTP_FROM=support@class-y.local`
  - Ohne Secrets wird nur gespeichert (`mail_status = not_configured`).
- Rundgang und Willkommens-Dialog: `components/help/`, Texte in `constants/help.ts`. Der Dialog
  erscheint einmal pro Rolle (`profiles.onboarding_seen`).
- Handbuch-Bildschirmfotos erzeugt `npm run handbook:screenshots` (Playwright,
  `e2e/handbook.spec.ts`) nach `public/handbook/`. Nach UI-Änderungen neu erzeugen und committen.

## Vertragsannahme

Verträge zwischen Company und Trainer:in sind erst wirksam, wenn die Trainer:in sie annimmt:

1. `company_admin`/`platform_admin` bieten einen Vertrag an (`offer_contract`, Status `pending`).
2. Die Trainer:in sieht das Angebot über `get_my_contracts` und nimmt es an (`accept_contract`) oder lehnt es ab (`decline_contract`).
3. Erst ein angenommener Vertrag (`active`) berechtigt zum Erfassen von Kursen und macht das Profil für die Company sichtbar.
   Die Datenbank verhindert, dass Admins die Annahme umgehen; nach der Annahme sind die Konditionen gesperrt.

Die Oberflächen dafür liegen unter **Einstellungen** (`/settings`, Stammdaten & eigene Vertragsangebote für Trainer:innen) und **Trainer** (`/trainers`, Angebote senden, Status filtern und Verträge beenden für Company-Admins). Die Datenzugriffe stehen in `lib/contracts.ts`.

## Tests

- Lint: `npm run lint`
- Typprüfung: `npm run typecheck` (erzeugt die Next.js-Routentypen und startet `tsc --noEmit`)
- Edge Functions: `npm run functions:lint` (Deno) und `npm run functions:check` (Typprüfung pro Funktion, braucht Internet für JSR-Pakete)
- Datenbank/RLS: `supabase test db` (pgTAP, `supabase/tests/database/`) prüft, dass jede Tabelle in
  `public` RLS aktiviert hat und `anon` keine security-definer-Funktionen ausführen darf
- Edge Functions lokal ausführen: `supabase functions serve --env-file supabase/.env.local`
  (für `create-test-admin` dort `ALLOW_TEST_ADMIN=true` setzen)
- E2E: `npm run test:e2e` (Playwright, startet den Entwicklungsserver). Die Tests brauchen
  `E2E_PLATFORM_ADMIN_EMAIL` und `E2E_PLATFORM_ADMIN_PASSWORD` eines bestehenden
  `platform_admin`-Kontos in `.env.local`. `e2e/contracts.spec.ts` (Einladen, Annehmen, Ablehnen,
  Beenden) läuft nur gegen den lokalen Stack: `supabase start` und `supabase functions serve` müssen
  laufen, der Einladungslink wird aus Mailpit gelesen (`E2E_MAILPIT_URL`, Standard
  `http://127.0.0.1:54324`). Die Trainer:innen-Seite wird als eigenes Video angehängt.

## Hinweis zur KI-Nutzung

Dieses Repository enthält Konfigurationsdateien für KI-Assistenten (`CLAUDE.md`, `AGENTS.md`) und
wurde teilweise mit KI-Unterstützung entwickelt. Commits mit KI-Anteil sind mit `[ai]`
gekennzeichnet; die zugehörigen Prompts stehen in der Commit-Nachricht.

## Lizenz

Copyright (C) 2026 Jennifer Donath

Dieses Projekt steht unter der [GNU Affero General Public License v3.0](./LICENSE). Wer eine
veränderte Version als Netzwerkdienst betreibt, muss den Nutzer:innen den Quellcode dieser
Version zur Verfügung stellen.
