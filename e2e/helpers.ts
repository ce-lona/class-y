import {
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
  expect,
} from "@playwright/test";

export async function loginAsPlatformAdmin(page: Page) {
  const email = process.env.E2E_PLATFORM_ADMIN_EMAIL;
  const password = process.env.E2E_PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_PLATFORM_ADMIN_EMAIL / E2E_PLATFORM_ADMIN_PASSWORD fehlen in .env.local",
    );
  }

  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  // Platform-Admins werden von "/" direkt weitergeleitet; die E-Mail ist dort nur kurz sichtbar.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await expect(page.getByRole("button", { name: "Konto-Menü" })).toBeVisible();
}

/** Abmelden über das Avatar-Menü unten in der Sidebar. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "Konto-Menü" }).click();
  await page.getByRole("menuitem", { name: "Abmelden" }).click();
}

export function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

/** Stellt sicher, dass der eingeloggte Platform-Admin Company-Admin mindestens einer Company ist. */
export async function ensureAdminHasCompany(page: Page) {
  await page.goto("/trainers");
  const offerButton = page.getByRole("button", { name: "Vertrag anbieten" });
  try {
    await expect(offerButton).toBeVisible({ timeout: 5_000 });
    return;
  } catch {
    // keine Company → per UI anlegen und sich selbst als Admin eintragen
  }
  const companyName = uniqueName("E2E Vertrags-Company");
  await page.goto("/companies");
  await page.getByRole("button", { name: "Neue Company" }).click();
  await page.getByLabel("Name").fill(companyName);
  await page.getByRole("button", { name: "Company anlegen" }).click();
  await page.getByRole("link", { name: new RegExp(companyName) }).click();
  await page.locator("#admin-email").fill(process.env.E2E_PLATFORM_ADMIN_EMAIL!);
  await page.getByRole("button", { name: "Admin hinzufügen" }).click();
  await expect(page.getByText(process.env.E2E_PLATFORM_ADMIN_EMAIL!)).toBeVisible();
  await page.goto("/trainers");
  await expect(offerButton).toBeVisible();
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}@example.test`;
}

const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

/**
 * Liest den Einladungslink (token_hash → /auth/confirm) aus der lokalen Mailpit-Instanz.
 * Funktioniert nur gegen den lokalen Supabase-Stack (`supabase start`).
 */
export async function getInviteLink(email: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        ).then((r) => r.json());
        const id = search.messages?.[0]?.ID;
        if (!id) return undefined;
        const message = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`).then((r) => r.json());
        const href = /href="([^"]*\/auth\/confirm[^"]*)"/.exec(message.HTML ?? "")?.[1];
        link = href?.replace(/&amp;/g, "&");
        return link;
      },
      { message: `Einladungsmail an ${email} in Mailpit`, timeout: 15_000 },
    )
    .toBeTruthy();
  return link!;
}

/**
 * Legt per Vertragsangebot eine neue Trainer:in an, die das Angebot annimmt (lokaler Stack mit
 * Mailpit nötig). Der eingeloggte Platform-Admin muss Company-Admin sein (ensureAdminHasCompany).
 * Liefert die Seite der Trainer:in in einem eigenen Browser-Kontext.
 */
export async function createActiveTrainer(
  adminPage: Page,
  browser: Browser,
  testInfo: TestInfo,
  options: { showOnboarding?: boolean } = {},
): Promise<{ trainer: Page; context: BrowserContext; email: string }> {
  const email = uniqueEmail("e2e-trainer");
  const amount = "41,00";
  await adminPage.goto("/trainers");
  await adminPage.getByRole("button", { name: "Vertrag anbieten" }).click();
  await adminPage.getByLabel("E-Mail-Adresse der Person").fill(email);
  await adminPage.getByLabel("Betrag (€)").fill(amount);
  await adminPage.getByLabel("Gültig ab").fill(new Date().toISOString().slice(0, 10));
  await adminPage.getByRole("button", { name: "Angebot senden" }).click();
  await expect(adminPage.getByText("Einladung und Angebot gesendet.")).toBeVisible();

  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    // Ohne Skip-Flag erscheint der Willkommens-Dialog wie bei echten neuen Konten.
    storageState: options.showOnboarding
      ? { cookies: [], origins: [] }
      : testInfo.project.use.storageState,
    recordVideo: { dir: testInfo.outputPath("trainer-video") },
  });
  const trainer = await context.newPage();
  await trainer.goto(await getInviteLink(email));
  await trainer.getByLabel("Neues Passwort").fill(`E2e-${Date.now()}`);
  await trainer.getByRole("button", { name: "Neues Passwort setzen" }).click();
  await trainer.waitForURL("/");

  await trainer.goto("/profile");
  await trainer.getByRole("tab", { name: /^Verträge/ }).click();
  const offer = trainer.getByRole("listitem").filter({ hasText: amount });
  await acceptContractOffer(trainer, offer);
  await expect(offer).toContainText("Aktiv");
  return { trainer, context, email };
}

/**
 * Beendet den Vertrag einer mit createActiveTrainer angelegten Person wieder, damit andere
 * Specs (die nach "irgendeinem aktiven Vertrag" suchen) nicht über sie stolpern.
 */
export async function endTrainerContract(adminPage: Page, email: string) {
  await adminPage.goto("/trainers");
  const row = adminPage.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "Beenden" }).click();
  // Beendete Verträge verschwinden aus dem Standardfilter "Aktiv & Offen".
  await expect(row).toHaveCount(0);
}

/** Gültige Test-IBAN (Prüfziffer korrekt). */
export const E2E_IBAN = "DE02 1203 0000 0000 2020 51";

/**
 * Nimmt ein Vertragsangebot an: „Annehmen“ öffnet das Formular mit Pflicht-Stammdaten
 * (Name, Anschrift, IBAN; bei Freiberufler:innen Steuernummer + Zustimmung zum
 * Gutschriftverfahren).
 */
export async function acceptContractOffer(
  page: Page,
  offer: Locator,
  data: { name?: string } = {},
) {
  await offer.getByRole("button", { name: "Annehmen" }).click();
  const dialog = page.getByRole("dialog", { name: "Vertrag annehmen" });
  await expect(dialog).toBeVisible();
  // Vorhandene Stammdaten (z.B. des Admin-Kontos) bleiben stehen, nur leere Felder werden gefüllt.
  const fillIfEmpty = async (label: string, value: string) => {
    const field = dialog.getByLabel(label, { exact: true });
    if (!(await field.inputValue())) await field.fill(value);
  };
  await fillIfEmpty("Vollständiger Name", data.name ?? "E2E Trainer:in");
  await fillIfEmpty("Straße", "Teststraße");
  await fillIfEmpty("Hausnummer", "1");
  await fillIfEmpty("PLZ", "70173");
  await fillIfEmpty("Ort", "Stuttgart");
  await dialog.getByLabel("IBAN").fill(E2E_IBAN);
  const taxNumber = dialog.getByLabel("Steuernummer", { exact: true });
  if (await taxNumber.isVisible()) {
    await taxNumber.fill("99/123/45678");
    await dialog.getByLabel(/Gutschriftverfahren/).check();
  }
  await dialog.getByRole("button", { name: "Vertrag annehmen" }).click();
  await expect(dialog).toHaveCount(0);
}
