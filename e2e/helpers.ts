import { type Page, expect } from "@playwright/test";

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
  await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
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
