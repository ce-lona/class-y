# class-y Corporate Design

Lebende Referenz: **[class-y Corporate Design (Canvas)](https://claude.ai/code/artifact/b3cde592-4f5c-41b8-aeb7-8bd90e9b1bba)**

Editierbarer Canvas mit zwei Seiten (Umschalter oben im Canvas):

- **Corporate Design** — Moodboard & Positionierung, Logo-Konzept, Farbpalette,
  Typografie, UI-Stilguide
- **App-Screens** — Templates für Listen-/Detail-/Anlegen-Seiten: Studios-Liste,
  Studio-Detail, Kursplan anlegen, Monitoring-Dashboard (Desktop, Studio-Admin)
  sowie Meine-Kurse-Liste und Kurs-eintragen (Mobile, Trainer:in). Grundaufbau,
  nicht jede Seite jedes Flows — weitere Listen/Details (Trainer, Verträge,
  Kurstypen) übernehmen dieselben Muster.

Änderungen dort über den Save-Button sichern eine neue Version für alle
Betrachter.

## Updaten

Die Quelldateien des Canvas liegen unter [`canvas/`](./canvas/) (`.dc.html`
pro Board + `canvas.json` fürs Layout) — Snapshot vom letzten Stand. Um den
Canvas weiterzubearbeiten oder eine neue Version zu seeden: in Claude Code
den `design`-Skill nutzen und auf den obigen Artifact-Link verweisen (liest
den aktuellen Live-Stand zurück, falls er sich seitdem geändert hat) oder
direkt von den Dateien in `canvas/` aus neu seeden.

## Tokens (Kurzreferenz)

Vollständig mit Rationale im Colors-/Typography-Board. Bereits eingebunden
in [`app/globals.css`](../../app/globals.css) und [`app/layout.tsx`](../../app/layout.tsx).

**Primary — Petrol** (`--primary-50` … `--primary-950`, Basis `600`)
`#EEF5F5 #D3E6E5 #A7CDCB #79B0AD #4C928E #2E7672 #1F5F5C #184C4A #133B3A #0F2E2D #081918`

**Neutral — Warmgrau** (`--neutral-50` … `--neutral-950`)
`#FAFAF9 #F2F1EF #E5E3DF #D3D0C9 #A9A59C #7C7870 #5C5952 #45423D #302E2A #201F1C #131211`

**Link — Indigo** (`--link-400/500/600`, Links/Fokus/Badges — nie für Status)
`#8B8AE8 #6C6ADD #5450C4`

**Status** — `success #1D8A5F` (bg `#E7F6EE`) · `warning #B87503` (bg `#FCF1DC`) ·
`error #DC2626` (bg `#FDECEC`)

**Typografie**
- `font-heading` (Manrope, 600/700/800) — alle UI-Headlines
- `font-logo` (Newsreader, 500) — **ausschließlich** die "class-y"-Wortmarke,
  nie als UI-Headline
- `font-sans` (Source Sans 3, 400/500/600/700) — Fließtext

## Logo

Wortmarke + Bildmarke (drei gestufte Punkte) als React-Komponente unter
[`components/logo.tsx`](../../components/logo.tsx) (`<Logo />`, `<LogoMark />`).
Rohe Bildmarke als SVG: [`mark.svg`](./mark.svg) — Quelle für Favicon
(`app/icon.svg`, `app/favicon.ico`) und PWA-Icons (`public/icons/`).
