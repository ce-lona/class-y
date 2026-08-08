# class-y

Mobile App (iOS/Android) für Gyms/Studios und ihre Trainer:innen, um gegebene Kurse zu tracken,
Studios eine Monitoring-Übersicht zu geben und (Phase 2, später) Gutschriften/Belege
automatisiert abzuwickeln. UI-Sprache ist Deutsch (analog `i18n/de.ts` bei classy), es gibt
aktuell keine weiteren Sprachen. Code ist Englisch.

Nicht zu verwechseln mit dem separaten, bestehenden Projekt `classy` (ohne Bindestrich) unter
`../classy` — beide Projekte existieren parallel.

Projekt ist in Planung — dieses Dokument beschreibt den Ziel-Stack/Konventionen für den Code, der
noch geschrieben wird. Details, Datenmodell und Roadmap: siehe [`PLANNING.md`](./PLANNING.md).

## Stack (geplant)

- **Expo** (managed workflow) + **EAS Build/Submit**
- **React Native / expo-router** (dateibasiert, Ordner `app/`)
- **TypeScript**, `strict: true`
- **NativeWind** (Tailwind-Klassen in RN-Komponenten)
- **Zustand** für Client-State
- **TanStack Query** für Server-State/Caching
- **React Hook Form + Zod** für Formulare/Validierung
- **Supabase** als Backend: Auth, Postgres (RLS), Edge Functions
- **Storybook** + **Chromatic** für visuelle Regression
- **Detox** für E2E-Tests — bewusst keine separaten Unit-Tests

Das ursprüngliche Next.js-Boilerplate in diesem Repo (`create-next-app`, unbenutzt) wurde
entfernt und durch dieses Planungsdokument ersetzt; das Expo-Projekt wird als Nächstes gescaffoldet.

## Rollenmodell

Drei Rollen in einer App (siehe `PLANNING.md` Abschnitt 2): `trainer`, `studio_admin`
(immer company-weit, nicht pro Location), `platform_admin`. Rollenprüfung/-freischaltung passiert
clientseitig über die Session + serverseitig über RLS-Policies — niemals nur clientseitig
vertrauen.

**Stammdaten vs. Vertragsdaten:** Trainer pflegen ihre eigenen Stammdaten (`profiles`)
selbst; Vertragsdaten (`contracts`: Beschäftigungsart, Vergütung, Gültigkeit) werden
ausschließlich von Company-Admins gepflegt, Trainer sehen sie nur lesend.

## Konventionen (analog classy, sobald Code existiert)

- Alle sichtbaren Texte über `t.*` aus `i18n/de.ts`, keine Hardcoded-Strings in Komponenten.
- Datenzugriff läuft immer über `lib/*.ts`, nie direkter Supabase-Call aus Komponenten/Hooks —
  Hooks in `hooks/` wrappen `lib/`-Funktionen mit TanStack Query.
- Nach mutierenden Aktionen: `queryClient.invalidateQueries`/`refetchQueries` mit passendem
  Query-Key.
- Neue UI-Komponenten in `components/ui/` bekommen eine `.stories.tsx` daneben.
- RLS ist scharf geschaltet — neue Tabellen/Spalten brauchen eine Migration, die RLS-Policies
  mitliefert (siehe `PLANNING.md` Abschnitt 4).
- Kursplan-Änderungen laufen immer über Archivieren + Neuanlage, nie Update der Slots eines
  aktiven Plans (siehe `PLANNING.md` Abschnitt 3, Versionierung).
- Contracts sind pro Company, nicht pro Studio — ein Trainer mit Contract kann an allen Studios
  der Company eingesetzt werden.
- Ad-hoc-Kurse (ohne Plan-Slot) und spontane Vertretungen (Trainer loggt fremden Slot) sind ab
  Phase 1 explizit erlaubt und kein Sonderfall.

## Ordnerstruktur (geplant, analog classy)

- `app/` — Screens/Routing (expo-router), Gruppen für `(auth)`, `(trainer)`, `(studio-admin)`,
  `(platform-admin)` je nach finaler Rollen-Navigation
- `components/` — wiederverwendbare UI-Komponenten, `components/ui/` = generische Bausteine
- `hooks/` — TanStack-Query-Hooks pro Entität
- `lib/` — Datenzugriff/Logik ohne React-Bindung (`supabase.ts`, `courses.ts`, `plans.ts`, …)
- `store/` — Zustand-Stores
- `constants/` — statische Werte
- `i18n/de.ts` — alle UI-Texte zentral
- `supabase/migrations/` — SQL-Migrationen inkl. RLS
- `e2e/` — Detox-Tests

## Offene Punkte

Siehe `PLANNING.md` Abschnitt 7 (Offene Fragen) — vor dem eigentlichen Scaffolding klären.
