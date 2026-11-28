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

**Flächen (Redesign 2026-11)** — Hell: Hintergrund `#F5F4F1`, Karten `#FFFFFF`, Sidebar `#FBFAF8`,
Rand `#E5E3DF`, gedämpfter Text `--muted-foreground #6B675F` (5,1:1 auf `#F5F4F1`).
Dunkel (einziger Dark-Modus): Hintergrund `#2B2926`, Karten `#35332F`, Sidebar `#302E2A`,
Rand `#4A4741`, gedämpfter Text `#ADA99F`, Primary `#79B0AD` mit Text `#0F2E2D`.

**Eingabefelder** — eigenes Token `--input` mit 3:1 (hell `#8D8980`, dunkel `#86827A`) für
Input, Select, Textarea, Checkbox. Karten- und Tabellenränder bleiben bei `--border`.

**Status** — `success #3D7A1F` (bg `#EAF4E2`, dunkel `#7DB35C` / `rgba(61,122,31,.25)`; bewusst
gelbgrün, damit es sich von Petrol abhebt) · `warning #9A6203` (bg `#FCF1DC`, 4,6:1) ·
`error #C81E1E` (bg `#FDECEC`)

**Kurstypen** — 8 Tokens `--course-1 … --course-8`, ohne Status-Rot/Grün/Amber.
Hell: `#5450C4 #8A4FA0 #B83A7A #2B6CB0 #1F8AA8 #5C6B7A #8A5A3C #6D4AC7`
Dunkel: `#A3A2F0 #C79BD6 #E58AB6 #7FB0E8 #6CC3DB #A3B0BD #C79A7A #A993EE`
Zuordnung über `getCourseTypeAccent()` in `lib/format.ts`.

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
