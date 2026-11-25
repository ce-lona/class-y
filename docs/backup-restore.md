# Datenbank-Backup & Restore

Jede Nacht um 02:15 UTC (03:15 bzw. 04:15 deutscher Zeit) läuft die GitHub-Action
[`Nightly DB backup`](../.github/workflows/db-backup.yml):

1. **Dump** der Produktions-DB mit der Supabase CLI: `roles.sql`, `schema.sql`, `data.sql`
   (enthält auch `auth.users`, also alle Logins).
2. **Restore-Test**: Der Dump wird in eine frische Wegwerf-Supabase-Instanz auf dem
   GitHub-Runner eingespielt. Danach wird für jede Tabelle geprüft, ob die Zeilenzahl
   stimmt. Schlägt das fehl, wird **nichts** hochgeladen und die Action ist rot.
3. **Verschlüsselung** mit [age](https://age-encryption.org). GitHub kennt nur den
   öffentlichen Schlüssel. Entschlüsseln kann nur, wer den privaten Schlüssel hat.
4. **Upload** per WebDAV auf IONOS HiDrive:
   - `<HIDRIVE_PATH>/daily/`: die letzten **30** Backups
   - `<HIDRIVE_PATH>/monthly/`: das Backup vom 1. jedes Monats, die letzten **12**

   Aufgeräumt wird nach Anzahl, nicht nach Alter. Fällt das Backup ein paar Tage aus,
   bleiben trotzdem 30 Stück liegen.

Schlägt ein nächtlicher Lauf fehl, schickt GitHub eine E-Mail an die Person, die den
Workflow zuletzt geändert hat.

**Nicht im Backup:** Dateien in Supabase Storage (wird derzeit nicht genutzt),
Projekt-Einstellungen im Supabase-Dashboard (Auth/SMTP, API-Keys), Edge-Function-Secrets
und die Vercel-Umgebungsvariablen. Die Edge Functions selbst liegen im Repo.

---

## Einmalige Einrichtung

### 1. age-Schlüsselpaar erzeugen (auf deinem Mac)

```bash
brew install age
age-keygen -o class-y-backup-key.txt
```

Die Ausgabe zeigt `Public key: age1...`. Das ist der öffentliche Schlüssel für GitHub.

Die Datei `class-y-backup-key.txt` ist der **private Schlüssel**:
- in den Passwort-Manager legen **und** zusätzlich offline sichern (z. B. ausgedruckt
  oder auf einem USB-Stick im Schrank),
- **nie** ins Repo, nie nach GitHub, nicht unverschlüsselt auf HiDrive.

Ohne diese Datei sind alle Backups wertlos.

### 2. HiDrive vorbereiten

1. In der HiDrive-Web-App: *Einstellungen → Zugriffsrechte und Protokolle →*
   Stift-Symbol → **WebDAV aktivieren** → Speichern.
2. Empfohlen, falls dein Tarif mehrere Benutzer erlaubt: unter *Administration →
   Benutzer* einen eigenen Benutzer nur für Backups anlegen. Dann liegt dein
   Haupt-Passwort nicht in GitHub.
3. Zielordner festlegen, z. B. `users/<benutzername>/class-y-backups`. Er wird beim
   ersten Lauf angelegt. Den Pfad siehst du, wenn du dich mit WebDAV im Finder
   verbindest (*Gehe zu → Mit Server verbinden →* `https://webdav.hidrive.ionos.com`).

### 3. Datenbank-Verbindung aus Supabase holen

Supabase-Dashboard → Projekt → **Connect** → **Session pooler** → Verbindungs-URL
kopieren und `[YOUR-PASSWORD]` durch das Datenbank-Passwort ersetzen. Sie sieht so aus:

```
postgresql://postgres.<project-ref>:<passwort>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

Wichtig: den **Session pooler** nehmen, nicht die direkte Verbindung
(`db.<ref>.supabase.co`). Die direkte Verbindung geht nur über IPv6, und das können
GitHub-Runner nicht.

### 4. GitHub-Secrets setzen

GitHub → Repo → *Settings → Secrets and variables → Actions → New repository secret*:

| Secret | Inhalt |
| --- | --- |
| `SUPABASE_DB_URL` | Session-Pooler-URL aus Schritt 3 |
| `BACKUP_AGE_PUBLIC_KEY` | `age1...` aus Schritt 1 (nur der öffentliche Schlüssel!) |
| `HIDRIVE_USER` | HiDrive-Benutzername |
| `HIDRIVE_PASSWORD` | HiDrive-Passwort dieses Benutzers |
| `HIDRIVE_PATH` | Zielordner aus Schritt 2, z. B. `users/<benutzername>/class-y-backups` |

### 5. Ersten Lauf starten

GitHub → *Actions → Nightly DB backup → Run workflow*. Nach ca. 5 Minuten sollte die
erste Datei `class-y-YYYY-MM-DDTHHMMZ.tar.gz.age` in HiDrive unter `daily/` liegen.

---

## Restore-Test auf dem eigenen Rechner (alle paar Monate)

Prüft, dass du ein Backup mit deinem privaten Schlüssel wirklich zurückholen kannst.
Benötigt Docker Desktop und die Supabase CLI. Deine lokale Dev-Datenbank bleibt
unberührt, der Test läuft auf eigenen Ports (553xx).

1. Ein Backup aus HiDrive herunterladen (Web-App oder Finder).
2. Im Repo:

   ```bash
   scripts/backup/verify-restore.sh ~/Downloads/class-y-2026-....tar.gz.age ~/Pfad/class-y-backup-key.txt
   ```

3. Erwartete Ausgabe am Ende: `Restore-Test OK: N Tabellen, M Zeilen wiederhergestellt.`

---

## Ernstfall: Produktion wiederherstellen

Supabase empfiehlt, in ein **neues, leeres Projekt** einzuspielen. Dabei bleibt das
kaputte Projekt zum Vergleichen erhalten.

1. **Neues Supabase-Projekt anlegen** (Region `eu-west-1`, Postgres 17). Keine
   Migrationen einspielen, das Schema kommt aus dem Backup.
2. **Backup herunterladen**: das neueste aus HiDrive `daily/`.
3. **Einspielen** (Session-Pooler-URL des *neuen* Projekts, siehe oben):

   ```bash
   brew install age libpq   # psql
   scripts/backup/restore.sh class-y-2026-....tar.gz.age class-y-backup-key.txt \
     'postgresql://postgres.<neuer-ref>:<pw>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
   ```

   Schema und Daten werden in **einer** Transaktion eingespielt: Entweder klappt alles
   oder es wird nichts geändert. Der Hinweis „Rollen-Einstellung übersprungen“ ist
   normal.
4. **Projekt-Einstellungen übertragen**, weil sie nicht in der Datenbank liegen:
   - Auth: Site-URL, Redirect-URLs, Signup aus, Passwort-Regeln, SMTP (Resend), E-Mail-Templates
   - Edge Functions deployen: `supabase link --project-ref <neuer-ref> && supabase functions deploy`
   - Edge-Function-Secrets neu setzen (`supabase secrets set ...`)
5. **App umstellen**: In Vercel `NEXT_PUBLIC_SUPABASE_URL` und
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` auf das neue Projekt setzen und neu deployen.
6. **GitHub-Secret `SUPABASE_DB_URL`** auf das neue Projekt umstellen, damit die
   Backups weiterlaufen.
7. **Prüfen**: einloggen (bestehende Passwörter funktionieren weiter, weil `auth.users`
   mit Passwort-Hashes im Backup ist), Kurspläne und Verträge stichprobenartig ansehen.

Daten, die nach dem letzten Backup entstanden sind (höchstens ca. 24 Stunden), fehlen.

---

## Dateien

| Datei | Zweck |
| --- | --- |
| `.github/workflows/db-backup.yml` | Nächtliche Action |
| `scripts/backup/dump.sh` | Dump per Supabase CLI |
| `scripts/backup/verify-restore.sh` | Restore-Test in Wegwerf-Instanz (Ordner oder `.age` + Schlüssel) |
| `scripts/backup/restore.sh` | Einspielen in eine Ziel-DB |
| `scripts/backup/upload-hidrive.sh` | WebDAV-Upload + Aufräumen |

## Hinweise

- Ist das Repo öffentlich, sind auch die Action-Logs öffentlich. Die Skripte geben
  keine Daten aus, nur Gesamtzahlen von Tabellen und Zeilen.
- In öffentlichen Repos deaktiviert GitHub geplante Workflows nach 60 Tagen ohne
  Commits. Dann kommt eine E-Mail, und der Workflow muss unter *Actions* wieder
  aktiviert werden.
