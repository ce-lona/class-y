import { test, expect } from "@playwright/test";
import { ensureAdminHasCompany, loginAsPlatformAdmin, uniqueEmail, uniqueName } from "./helpers";

// DSGVO-Flows gegen den lokalen Stack (`supabase start`, `supabase functions serve` für
// invite-trainer): Datenauskunft, Konto-Löschung durch Admins und Company-Offboarding.

test("Datenschutz: Company-Export, Datenauskunft und Konto löschen", async ({ page }) => {
  const personEmail = uniqueEmail("e2e-dsgvo");

  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);

  // Person mit offenem Vertragsangebot anlegen (wird beim Löschen komplett entfernt)
  await page.getByRole("button", { name: "Vertrag anbieten" }).click();
  await page.getByLabel("E-Mail-Adresse der Person").fill(personEmail);
  await page.getByLabel("Betrag (€)").fill("30");
  await page.getByLabel("Gültig ab").fill("2027-01-01");
  await page.getByRole("button", { name: "Angebot senden" }).click();
  await expect(page.getByText("Einladung und Angebot gesendet.")).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Datenschutz", level: 1 })).toBeVisible();

  // Company-Export als CSV
  const companyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Datenexport der Company CSV" }).click();
  expect((await companyDownload).suggestedFilename()).toMatch(/^datenexport-.*\.csv$/);

  // Datenauskunft der Person als JSON
  const row = page.getByRole("listitem").filter({ hasText: personEmail });
  await expect(row).toBeVisible();
  const personDownload = page.waitForEvent("download");
  await row.getByRole("button", { name: `Datenauskunft ${personEmail} JSON` }).click();
  expect((await personDownload).suggestedFilename()).toMatch(/^datenauskunft-.*\.json$/);

  // Konto löschen
  await row.getByRole("button", { name: `Konto löschen ${personEmail}` }).click();
  await expect(page.getByRole("dialog", { name: "Konto endgültig löschen?" })).toBeVisible();
  await page.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(page.getByText("Konto gelöscht.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: personEmail })).toHaveCount(0);
});

test("Offboarding: Löschung einplanen und zurücknehmen", async ({ page }) => {
  const companyName = uniqueName("E2E Offboarding Company");

  await loginAsPlatformAdmin(page);
  await page.goto("/companies");
  await page.getByRole("button", { name: "Neue Company" }).click();
  await page.getByLabel("Name").fill(companyName);
  await page.getByRole("button", { name: "Company anlegen" }).click();
  await page.getByRole("link", { name: new RegExp(companyName) }).click();
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();

  await page.getByRole("button", { name: "Löschung in 30 Tagen einplanen" }).click();
  // Bestätigung
  await page.getByRole("button", { name: "Löschung in 30 Tagen einplanen" }).click();
  await expect(page.getByText("Löschung geplant")).toBeVisible();
  await expect(page.getByText("Endgültige Löschung am")).toBeVisible();

  await page.getByRole("button", { name: "Löschung zurücknehmen" }).click();
  await expect(page.getByText("Löschung geplant")).toHaveCount(0);
});
