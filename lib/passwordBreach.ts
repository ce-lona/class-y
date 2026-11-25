// Prüft ein Passwort gegen die HaveIBeenPwned-Datenbank geleakter Passwörter
// (https://haveibeenpwned.com/API/v3#PwnedPasswords). k-Anonymität: Es verlassen nur die
// ersten 5 Zeichen des SHA-1-Hashs den Browser, nie das Passwort oder der vollständige Hash.
// Die Anfrage läuft über unseren Server (app/api/pwned-range), damit HIBP keine
// Nutzer-IPs sieht; der Server fragt mit "Add-Padding" an, damit die Antwortgröße nichts verrät.
//
// Ist die API nicht erreichbar, wird das Passwort durchgelassen (fail open): ein Ausfall von
// HIBP soll niemanden aussperren. Die Mindestlänge erzwingt Supabase Auth serverseitig.

const RANGE_URL = "/api/pwned-range/";
const TIMEOUT_MS = 4000;

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** true, wenn das Passwort in bekannten Datenlecks vorkommt. */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(RANGE_URL + prefix, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return false;

    const body = await response.text();
    return body.split("\n").some((line) => {
      const [lineSuffix, count] = line.trim().split(":");
      // Padding-Einträge haben den Zähler 0.
      return lineSuffix === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
