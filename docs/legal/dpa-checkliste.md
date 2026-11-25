# Checkliste: AVVs/DPAs und Datenschutz-To-dos vor dem Launch

> Arbeitsliste, kein Rechtstext. Grundlage: Code-Review des Repos am 25.11.2026. Links und Bedingungen bei Abschluss jeweils aktuell prüfen.

## 1. Dienstleister, mit denen du einen AVV/DPA brauchst

Im Code gefunden: Supabase (Datenbank, Auth, Edge Functions), Vercel (Hosting), Resend (E-Mail über Supabase-SMTP), Sentry (Fehlerüberwachung, EU-Region) und die Pwned-Passwords-API (Passwortprüfung im Browser). Kein Tracking, keine Analytics, keine externen Fonts zur Laufzeit (next/font hostet Google Fonts selbst), kein Zahlungsanbieter.

- [ ] **Supabase** – DPA unter supabase.com/legal/dpa. Muss in der Regel aktiv angefordert und unterschrieben werden (im Dashboard unter Organization → Legal Documents bzw. über das verlinkte Formular). Unterschriebenes PDF ablegen. Transfer Impact Assessment (TIA) von Supabase mit herunterladen, falls angeboten.
- [ ] **Vercel** – DPA unter vercel.com/legal/dpa. Gilt meist automatisch als Teil der Nutzungsbedingungen; als PDF herunterladen und ablegen. Aktuell Hobby-Tarif (laut Vercel nur nicht-kommerziell): reicht für die Testphase, spätestens mit dem ersten zahlenden Studio auf Pro wechseln.
- [ ] **Sentry** – DPA unter sentry.io/legal/dpa. Gilt laut Sentry als Teil der Nutzungsbedingungen; als PDF herunterladen und ablegen. Prüfen, dass die Organisation in der **EU-Region (de.sentry.io)** angelegt ist; die Region lässt sich nachträglich nicht ändern. Datenaufbewahrung im Tarif nachsehen und in der Datenschutzerklärung eintragen. In den Organisationseinstellungen „Prevent Storing of IP Addresses“ und den serverseitigen Data Scrubber aktivieren.
- [ ] **Resend** – DPA unter resend.com/legal/dpa. Ebenfalls herunterladen bzw. unterschreiben und ablegen.
- [ ] **IONOS (HiDrive)** – speichert die verschlüsselten nächtlichen Backups. AVV im IONOS Control Center (Menü „Datenschutz“ bzw. „Vertrag zur Auftragsverarbeitung“) abschließen; deckt dann auch ein IONOS-Postfach ab.
- [ ] **GitHub** – die Backup-Action erzeugt den unverschlüsselten Dump auf dem GitHub-Runner. GitHubs DPA (github.com/customer-terms → Data Protection Agreement) gilt für Kundenkonten automatisch; als PDF ablegen. Darauf achten, dass Dump-Inhalte nie in Logs oder Artifacts landen.
- [ ] **E-Mail-Postfach für Kontakt/Support** (z. B. IONOS, Google Workspace, Microsoft 365) – AVV im jeweiligen Kundenkonto abschließen. Die Domain liegt laut Repo bei IONOS; falls dort auch Postfächer laufen, AVV im IONOS Control Center abschließen.
- [ ] **Buchhaltung/Rechnungen an Kund:innen** (z. B. lexoffice, sevDesk, Steuerberater:in) – sobald gewählt, AVV abschließen und in Datenschutzerklärung ergänzen.

Pwned Passwords (api.pwnedpasswords.com): kein DPA verfügbar, öffentliche API; erhält nur einen Hash-Präfix und die IP-Adresse. In der Datenschutzerklärung erwähnt, anwaltlich bewerten lassen (Alternative: Abfrage über eigenen Server-Endpunkt, dann sieht der Dienst keine Nutzer-IP).

Nicht nötig (keine personenbezogenen Daten der App): IONOS-DNS allein. Hetzner nur, falls der DevOps-Fork produktiv geht.

## 2. Einstellungen, die zu den Texten passen müssen

- [x] Vercel: Function Region auf **fra1 (Frankfurt)** setzen (erledigt 25.11.2026, wirksam ab nächstem Deployment) (Project Settings → Functions), dann in Datenschutzerklärung und AVV Anlage 3 eintragen.
- [ ] Resend: Sende-Region **eu-west-1** prüfen bzw. Domain dort anlegen.
- [ ] Supabase: Region eu-west-1 ist laut Projekt-Setup gesetzt, im Dashboard bestätigen.
- [ ] Backups: Die nächtliche GitHub Action muss einmal erfolgreich gelaufen sein, bevor die AVV-Anlage 2 so unterschrieben wird (Supabase läuft im Free-Tarif ohne eigene Backups).
- [ ] Supabase: Passwort-Mindestlänge im gehosteten Dashboard erhöhen (lokal steht 6), Wert in AVV Anlage 2 eintragen.
- [ ] 2FA für alle Admin-Zugänge (Supabase, Vercel, Resend, GitHub, Domain).
- [ ] DPF-Zertifizierung von Supabase, Vercel, Sentry und Resend unter dataprivacyframework.gov nachsehen und in Datenschutzerklärung Abschnitt 8 konkret benennen.
- [ ] Log-Aufbewahrung von Vercel (je nach Tarif) und Supabase-Auth-Logs nachsehen und in Datenschutzerklärung eintragen.

## 3. Dokumente, die du selbst führen musst

- [ ] **Verzeichnis von Verarbeitungstätigkeiten** als Verantwortliche (Art. 30 Abs. 1 DSGVO): Website, Konten, Kund:innenverwaltung, E-Mail.
- [ ] **Verzeichnis als Auftragsverarbeiterin** (Art. 30 Abs. 2 DSGVO): je Kund:in Name, Kategorien der Verarbeitung, Unterauftragsverarbeiter, Drittlandtransfers, TOM-Verweis.
- [ ] Unterschriebene AVVs mit jedem Kunden (Vorlage `avv-vorlage.md`).
- [ ] Prozess für Datenschutzverletzungen: wer meldet wem innerhalb von 48 h (an Kund:innen) bzw. 72 h (an die Behörde, wenn du selbst verantwortlich bist).
- [ ] Prozess für Auskunft und Löschung: Die App hat noch keine Konto-Löschung und keinen Datenexport. Bis es die gibt, Anfragen per E-Mail manuell über das Supabase-Dashboard bearbeiten und das dokumentieren.

## 4. Offene Rechtsfragen für die anwaltliche Prüfung

1. **Rollenverteilung bei Trainer:innen-Konten:** Ein Konto kann mit mehreren Unternehmen verbunden sein, die Stammdaten pflegen die Trainer:innen selbst. Ist class-y dafür eigene Verantwortliche, Auftragsverarbeiterin der jeweiligen Unternehmen oder liegt gemeinsame Verantwortlichkeit vor?
2. **Nutzungsbedingungen für eingeladene Nutzer:innen:** Trainer:innen schließen keinen Vertrag mit class-y. Braucht es eigene kurze Nutzungsbedingungen, die beim ersten Login bestätigt werden?
3. **AGPL-3.0-Lizenz** des Repos im Verhältnis zum kommerziellen SaaS-Angebot (AGPL verpflichtet zur Herausgabe des Quellcodes an Nutzer:innen eines Netzwerkdienstes).
4. **Haftungshöchstgrenze und SLA-Werte** in den AGB.
5. **Rechtsform und Impressum:** Einzelunternehmen oder GmbH/UG, ab wann Handelsregister.
