import { test, expect, type Page } from "@playwright/test";
import { createActiveTrainer, ensureAdminHasCompany, loginAsPlatformAdmin } from "./helpers";

// Erzeugt die Bildschirmfotos für das Handbuch im Hilfe-Bereich (public/handbook/*.png).
// Läuft nur mit `npm run handbook:screenshots` (HANDBOOK_SCREENSHOTS=1) gegen den lokalen Stack.
// Die Dateinamen müssen zu `shots` in constants/help.ts passen.

test.skip(!process.env.HANDBOOK_SCREENSHOTS, "Nur mit npm run handbook:screenshots");
test.use({ viewport: { width: 1280, height: 800 }, colorScheme: "light", video: "off" });
test.setTimeout(180_000);

const DIR = "public/handbook";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Lädt…", { exact: true })).toHaveCount(0);
  await page.waitForTimeout(400);
}

async function shoot(page: Page, name: string, path?: string) {
  if (path) await page.goto(path);
  await settle(page);
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

test("Handbuch-Bildschirmfotos erzeugen", async ({ page, browser }, testInfo) => {
  // Ohne Anmeldung
  await shoot(page, "login", "/login");
  await shoot(page, "forgot-password", "/forgot-password");

  // Admin-Ansicht
  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);
  for (const [name, path] of [
    ["monitoring", "/monitoring"],
    ["plans", "/plans"],
    ["studios", "/studios"],
    ["trainers", "/trainers"],
    ["billing", "/billing"],
    ["settings", "/settings"],
    ["privacy", "/privacy"],
    ["help", "/help"],
  ] as const) {
    await shoot(page, name, path);
  }

  await page.goto("/monitoring");
  await settle(page);
  await page.locator("header").first().screenshot({ path: `${DIR}/workspace-switch.png` });

  await page.goto("/trainers");
  await settle(page);
  await page.getByRole("button", { name: "Vertrag anbieten" }).click();
  await shoot(page, "trainers-offer");

  // Trainer-Ansicht mit frischem Konto
  const { trainer, context } = await createActiveTrainer(page, browser, testInfo);
  try {
    await trainer.setViewportSize({ width: 1280, height: 800 });
    for (const [name, path] of [
      ["courses", "/courses"],
      ["courses-log", "/courses/log"],
      ["schedule", "/courses/schedule"],
      ["courses-billing", "/courses/billing"],
    ] as const) {
      await shoot(trainer, name, path);
    }
    await trainer.goto("/profile");
    await trainer.getByRole("tab", { name: /^Verträge/ }).click();
    await shoot(trainer, "profile-contracts");
  } finally {
    await context.close();
  }
});
