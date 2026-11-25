# Rechtstexte (Entwürfe)

> **Alle Texte sind Entwürfe und nicht anwaltlich geprüft.** Vor dem Launch von einer Anwältin oder einem Anwalt für IT-/Datenschutzrecht prüfen lassen.

| Datei | Zweck | In der App |
|---|---|---|
| `impressum.md` | Anbieterkennzeichnung nach § 5 DDG | `/impressum` |
| `datenschutz.md` | Datenschutzerklärung (Website, Konten, Dienstleister) | `/datenschutz` |
| `agb.md` | AGB für Unternehmenskund:innen (B2B-SaaS) | `/agb` |
| `avv-vorlage.md` | Vertrag zur Auftragsverarbeitung mit Kund:innen, inkl. TOM und Unterauftragsverarbeitern | nicht veröffentlicht, wird pro Kund:in geschlossen |
| `dpa-checkliste.md` | DPAs mit Supabase/Vercel/Resend, nötige Einstellungen, offene Rechtsfragen | intern |

Die Seiten `/impressum`, `/datenschutz` und `/agb` lesen die Markdown-Dateien beim Build (`components/legal-document.tsx`). Änderungen am Text also nur hier machen, nicht im Code.

## Platzhalter

Alles in eckigen Klammern `[…]` ist ein Platzhalter oder ein Hinweis für die Prüfung und muss vor dem Launch ersetzt oder gestrichen werden. Suche danach mit:

```
grep -n "\[" docs/legal/*.md
```

Den Hinweisblock „Entwurf, nicht anwaltlich geprüft“ oben in jeder Datei erst nach der Prüfung entfernen.

## Grundlage

Die Datenkategorien stammen aus `supabase/migrations/` (Stand 25.11.2026): Konten (Supabase Auth), `profiles` (Name, Telefon, Adresse, Kleinunternehmer), `contracts` (Beschäftigungsart, Vergütung, Laufzeit, Annahme), `course_sessions`, `substitute_assignments`, `companies`, `studios`, Rollen-Tabellen. Neue Tabellen oder Dienstleister bedeuten: Datenschutzerklärung, AVV Anlage 1 und Anlage 3 nachziehen.
