# Redesign class-y: Umsetzungsplan

Referenz: `design/prototype/index.html` (klickbarer Prototyp, im Browser öffnen). Alle Texte in `i18n/de.ts`, Datenzugriff über `lib/` + `hooks/`, RLS-Regeln wie in CLAUDE.md. Jede Phase = eigener Branch + Pull Request gegen `main`, kein direkter Push auf `main`. Prod-Migrationen führt Jennifer selbst aus.

## Phase 1: Gerüst, Navigation, Theme (nur UI, keine Migration)

1. **Theme-Tokens** in `app/globals.css`: Hell-Hintergrund neutral `#F5F4F1`, Karten weiß, Sidebar `#FBFAF8`. Dark: bg `#2B2926`, card `#35332F`, sidebar `#302E2A`, border `#4A4741`, muted-foreground `#ADA99F`, primary `#79B0AD` mit Text `#0F2E2D`. Nur ein Dark-Modus.
2. **App-Shell**: Sidebar 248 px statt Kopfleiste (`components/nav.tsx` ersetzen), einklappbar auf 64 px (Zustand in localStorage), unter 900 px automatisch eingeklappt. Unten: Einstellungen, Hilfe, Avatar-Menü (Profil, Darstellung Hell/Dunkel/System, Abmelden).
3. **Company-Wechsler** oben in der Sidebar, gestaffelt: 1 Company = nur Name; 2–5 = Liste, Tasten 1–5; 6–19 = Suche, Angepinnt (Stern), Zuletzt geöffnet, Strg K; ab 20 (Plattform-Admin) zusätzlich Plattform-Übersicht als Startseite und Kontextleiste „Du bist in X · Zur Plattform“. Pins/Zuletzt in localStorage (`store/companyStore.ts` erweitern).
4. **Globaler Studio-Filter** unter der Company (Store), gilt für Kurse, Kurspläne, Team, Abrechnung.
5. **Bereiche**: Übersicht (neu), Kurse (bisher Monitoring), Kurspläne, Team (bzw. Trainer:innen für Studio-Admins), Abrechnung. Plattform-Admin zusätzlich Abschnitt „Plattform“: Übersicht, Plattform-Admins, Support.
6. **Einstellungen** mit Unter-Navigation links: Company, Studios, Kurstypen, Rechte der Studio-Admins, Abrechnung, Datenschutz (Company-Export, Offboarding), Verlauf (Phase 3). Studio-Admin: Studios (lesend), Kurstypen, Rechte (lesend). Darstellung wandert ins Avatar-Menü, `/privacy` und `/studios` leiten in die Einstellungen um.
7. **Kurse**: KPI-Karten raus, stattdessen Zeile mit Status-Chips samt Zahlen (filtern zugleich). Zeitraum-Steuerung: Woche/Monat/Quartal/Jahr/Eigener Zeitraum mit ‹ › unbegrenzt zurück. Umschalter Kurse | Pro Trainer:in.
8. **Übersicht**: „Wartet auf dich“ (offene Vertragsangebote, Kurstyp-Vorschläge, überfällige Kurse, Korrekturwünsche, Gutschriften-Status), „Heute“, „Woche je Studio“ (Raster erfasst/geplant). Kennzahlen als eine Textzeile.
9. **Plattform-Übersicht**: Company-Tabelle mit Suche, Filter-Chips (offene Punkte, angepinnt, neu, Löschung geplant), offene Freigaben, überfällige Kurse, letzte Aktivität.
10. **Trainer:in**: Sidebar mit „Kurs eintragen“-Knopf, Bereiche Meine Kurse, Abrechnung, Profil & Verträge. Meine Kurse: Zu bestätigen, Vertretungsanfragen, Kommend, Erledigt, Liste/Woche, Zeitraum-Steuerung, Company als Filter-Chips. Eintragen als Drawer (Desktop) bzw. Bottom-Sheet (mobil). Mobil: Bottom-Bar Woche, Plan, Plus, Abrechnung, Profil.
11. **Team**: Tabelle mit Rollen-Chips, Details im Seitenpanel (Vertrag, Studio-Freigabe, Stammdaten, Datenschutz pro Person), „Person hinzufügen“ mit Rollenwahl. Baut auf dem Team-Tab (`get_company_team`) auf.
12. E2E-Tests in `e2e/` an neue Navigation anpassen, Handbuch-Texte (`constants/help.ts`) und Rundgang-Ziele (`data-tour`) nachziehen.

## Phase 2: Arbeitsabläufe (überwiegend Client, ggf. kleine RPCs)

- Mehrfachauswahl: Team (Angebote bestätigen, Studios freigeben, Erinnerung, Export), Kurse (erinnern, absagen, Vertretung ausschreiben), Übersicht „Alle bestätigen“, Trainer:in „Alle als gegeben“.
- Kursplan: Bearbeiten im Raster mit Markierung neu/entfernt/geändert, Konfliktprüfung (Trainer:in gleichzeitig in anderem Studio, fehlende Studio-Freigabe), Vorschau-Drawer vor dem Veröffentlichen inkl. Liste der benachrichtigten Trainer:innen.
- Einrichtungs-Checkliste für neue Companies (abgeleitet: Anschrift, Studios, Kurstypen, Plan, Trainer:innen), ausblendbar.

## Phase 3: Backend-Funktionen (Migrationen, Edge Functions)

- Offene Vertretungen: Ausschreiben an alle für das Studio freigegebenen Kolleg:innen, wer zuerst übernimmt, bekommt den Kurs (Erweiterung `substitute_assignments` + RPC mit Sperre gegen Doppelvergabe, RLS, pgTAP).
- Änderungsverlauf: Tabelle `audit_log` + Trigger auf Verträge, Pläne, Kurstypen, Rechte, Team, Abrechnung; Einstellungen › Verlauf mit Filter und CSV; 24 Monate Aufbewahrung.
- „Als Company-Admin ansehen“ für Plattform-Admins: nur lesend (UI-Sperre, Schreib-RPCs prüfen Flag), Eintrag im Verlauf.
- Push nach Kursende (PWA Web Push): VAPID-Schlüssel, Subscription-Tabelle, Service Worker mit Aktionen „Gegeben“/„Ausgefallen“, Cron-Edge-Function 15 Min. nach Kursende, Schalter im Profil. Braucht Secrets und Deploy durch Jennifer.
