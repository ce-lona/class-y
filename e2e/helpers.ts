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
  await expect(page.getByText(email)).toBeVisible();
}

export function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}
