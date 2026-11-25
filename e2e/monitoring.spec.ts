import { test, expect } from "@playwright/test";
import { ensureAdminHasCompany, loginAsPlatformAdmin, uniqueName } from "./helpers";

test("Studio-Monitoring: erfasste Ad-hoc-Vertretung erscheint in Kurs- und Trainer-Übersicht", async ({
  page,
}) => {
  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);

  const adminEmail = process.env.E2E_PLATFORM_ADMIN_EMAIL!;
  const studioName = uniqueName("E2E Monitor Studio");
  const courseTypeName = uniqueName("E2E Cycling");

  // 1. Aktiven Vertrag sicherstellen
  await page.goto("/trainers");
  await expect(page.getByText("Lädt…")).toHaveCount(0);
  const hasActive = await page
    .getByRole("row")
    .filter({ hasText: "Aktiv" })
    .first()
    .isVisible();

  if (!hasActive) {
    await page.getByRole("button", { name: "Vertrag anbieten" }).click();
    await page.getByLabel("E-Mail-Adresse der Person").fill(adminEmail);
    await page.getByLabel("Betrag (€)").fill("40,00");
    await page.getByLabel("Gültig ab").fill("2026-01-01");
    await page.getByRole("button", { name: "Angebot senden" }).click();
    await expect(page.getByText(/Angebot gesendet/)).toBeVisible();

    await page.goto("/settings?tab=contracts");
    await page.getByRole("button", { name: "Annehmen" }).first().click();
    await expect(page.getByText("Aktiv").first()).toBeVisible();
  }

  // 2. Studio & Kurstyp anlegen
  await page.goto("/studios");
  await page.getByRole("button", { name: "Neues Studio" }).click();
  await page.getByLabel("Name").fill(studioName);
  await page.getByRole("button", { name: "Studio anlegen" }).click();
  await expect(page.getByRole("link", { name: studioName })).toBeVisible();

  await page.goto("/plans?tab=types");
  await page.getByRole("button", { name: "Neuer Kurstyp" }).click();
  await page.getByLabel("Kursname").fill(courseTypeName);
  await page.getByLabel("Standarddauer (Min.)").fill("60");
  await page.getByRole("button", { name: "Kurstyp anlegen" }).click();
  await expect(page.getByText(courseTypeName)).toBeVisible();

  // 3. Ad-hoc-Vertretung für heute erfassen
  await page.goto("/courses/log");
  await page.getByRole("tab", { name: "Ad-hoc" }).click();
  await page.locator("#adhoc-studio").click();
  await page.getByRole("option", { name: new RegExp(studioName) }).click();
  await page.locator("#adhoc-start").fill("14:00");
  await page.locator("#adhoc-end").fill("15:00");
  await page.locator("#adhoc-course-type").click();
  await page.getByRole("option", { name: new RegExp(courseTypeName) }).click();
  await page.getByLabel("Das war eine Vertretung").check();
  await page.getByRole("button", { name: "Kurs speichern" }).click();
  await page.waitForURL("/courses");

  // 4. Im Monitoring-Dashboard (/monitoring) prüfen: Studio-Filter, KPI, Kurszeile & Trainer-Summen
  await page.goto("/monitoring");
  await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible();
  await page.getByLabel("Studio").click();
  await page.getByRole("option", { name: studioName }).click();

  const courseRow = page.getByRole("row").filter({ hasText: courseTypeName });
  await expect(courseRow).toBeVisible();
  await expect(courseRow).toContainText("Erfasst");
  await expect(courseRow).toContainText("Vertretung");
  await expect(courseRow).toContainText("Ad-hoc");

  // Tab "Pro Trainer:in" prüfen
  await page.getByRole("tab", { name: /Pro Trainer:in/ }).click();
  await expect(page.getByRole("row").filter({ hasText: "Gesamt" })).toContainText("1 Std.");
});
