import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin, uniqueName } from "./helpers";

test("Company anlegen, Studio anlegen, Admin hinzufügen", async ({ page }) => {
  await loginAsPlatformAdmin(page);

  const companyName = uniqueName("E2E Test Company");
  const studioName = uniqueName("E2E Test Studio");
  const adminEmail = process.env.E2E_PLATFORM_ADMIN_EMAIL!;

  // Company anlegen
  await page.goto("/companies");
  await page.getByLabel("Name").fill(companyName);
  await page.getByRole("button", { name: "Company anlegen" }).click();
  await expect(page.getByRole("link", { name: new RegExp(companyName) })).toBeVisible();

  // In die Company-Detailseite wechseln
  await page.getByRole("link", { name: new RegExp(companyName) }).click();
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();

  // Studio anlegen
  await page.getByLabel("Name").fill(studioName);
  await page.getByRole("button", { name: "Studio anlegen" }).click();
  await expect(page.getByText(studioName)).toBeVisible();

  // Admin hinzufügen (eigener Account, da einziger bekannter existierender Nutzer)
  await page.getByPlaceholder("E-Mail-Adresse").fill(adminEmail);
  await page.getByRole("button", { name: "Admin hinzufügen" }).click();
  await expect(page.getByText(adminEmail)).toBeVisible();
});
