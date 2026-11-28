# class-y — Arbeitsstand

Lebendes Dokument, damit jederzeit ein anderer Agent übernehmen kann. Jede neue Aufgabe hier
eintragen, bevor die Arbeit beginnt, und beim Abschluss abhaken. Nur eigene Abschnitte ändern.

Regeln für alle Agenten:

- Nur in `/Users/jd/Code/class-y` arbeiten (Repo `ce-lona/class-y`). Den Ordner `lumi` nie anfassen.
- Vor jedem Commit/Push `pwd` und `git remote -v` prüfen. Mehrere Agenten arbeiten parallel im
  selben Ordner: nur eigene Dateien/Hunks committen.
- Nach jedem Push den GitHub-Actions-Lauf prüfen und rote Läufe selbst beheben.
- Prod-Migrationen führt Jennifer selbst aus (`supabase db push --linked`).
- UI-Texte nur in `i18n/de.ts`, Antworten an Jennifer auf Deutsch.

## Gutschriften und Belege

- Iteration 1 live in Prod (seit 2026-11-28): Gutschriften, Stornos, Nachweise, täglicher Job 5:05 Berlin.
- E-Mail-Benachrichtigungen zu Gutschriften gepusht (Commit 6ae57f8), Links auf `APP_URL` class-y.de.
- Offen: XRechnung/ZUGFeRD (Iteration 2).

## Vertretungen

- [x] Wochen-Pfeile für künftige Vertretungen (Commit 2eda74d) ist auf origin/main, CI grün
  (mitgelaufen in Lauf 46145727498).

## Rollenmodell um Studio-Admin erweitern

- Ziel: Plattform-Admin (mehrere möglich), Company-Admin (ganze Kette), Studio-Admin (intern
  `studio_coordinators`, bisher „Kurskoordinator:in“, studioweit), Trainer:innen über mehrere
  Companies, nur für freigegebene Studios.
- [x] Migration `20261128150000_studio_admin_permissions.sql`: Rechte pro Company in
  `studio_admin_permissions` (Kurstypen / Verträge: darf, mit Bestätigung, darf nicht;
  Abrechnung bei nicht getrennter Abrechnung: darf / darf nicht). Standard: mit Bestätigung,
  mit Bestätigung, darf nicht.
- [x] Verträge company-weit; Studio-Admin-Angebote ggf. `approval_status = pending_approval`,
  Company-Admin bestätigt (`review_contract`) und beschränkt optional (`set_contract_studios`).
  Studio-Beschränkung gilt jetzt auch für Trainer:innen (`trainer_cleared_for_studio`: Studios,
  Pläne, Kurse erfassen, Vertretungen).
- [x] Kurstypen durch Studio-Admins (`studio_admin_save_course_type`, Vorschläge mit
  `pending_change`, Bestätigung `review_course_type`); unbestätigte nicht planbar.
- [x] Mehrere Plattform-Admins (`get/add/remove_platform_admin`, Edge Function
  `invite-platform-admin`, Karte in den Plattform-Einstellungen).
- [x] UI: Rechte-Karte in Einstellungen, Bestätigen/Ablehnen + „Studios“ auf der Trainer-Seite,
  Kurstypen für Studio-Admins, Company-Auswahl (`store/companyStore.ts`, `availableRoles[].key/companyId`).
- [x] pgTAP: `studio_admin_permissions.test.sql` (39 Tests), alle Testdateien grün (lokal).
- [ ] Commit/Push + CI, dann Jennifer: `supabase db push --linked` und
  `supabase functions deploy invite-platform-admin`.
- Offen/später: Vertragsänderungen durch Studio-Admins „mit Bestätigung“ (aktuell nur Angebote;
  Beenden nur mit Recht „darf“), E-Mail an Company-Admin bei neuen Bestätigungsanfragen.

## Navigation und Einstellungen aufräumen

- [x] Hell/Dunkel/System aus der Kopfleiste in die Einstellungen jeder Rolle
  (Admin: Reiter „Darstellung“, Plattform: unten in den Einstellungen, Trainer: `/courses/settings`).
- [x] Profil nur noch über den Avatar oben rechts, kein eigener Tab mehr.
- [ ] Umschalter Admin/Plattform/Trainer aus der Kopfleiste entfernen, Ansichtswechsel ins
  Avatar-Menü (`components/user-menu.tsx`). Wartet auf den Push des Rollen-Umbaus
  (neue Felder `key`/`companyId` in `useWorkspace().availableRoles`).
- [ ] Team-Tab statt „Trainer:innen“ für Admins: alle Personen (Admins, Studio-Admins,
  Trainer:innen), anlegen (mit Vor- und Nachname), filtern, Standard-Sortierung nach Rolle und
  innerhalb nach „zuletzt aktualisiert“. Vertragsbestätigung aus der Trainer-Seite muss erhalten
  bleiben. Startet nach dem Rollen-Umbau.
