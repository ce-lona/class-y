import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin, uniqueName } from "./helpers";

test("Studio-Admin-Shell: Studio anlegen und Detailseite prüfen", async ({ page }) => {
  await loginAsPlatformAdmin(page);

  await page.goto("/studios");
  // "Monitoring" ist sichtbar, aber noch nicht anklickbar (Seite folgt später).
  const nav = page.getByRole("navigation");
  await expect(nav.getByText("Monitoring")).toBeVisible();
  await expect(nav.getByRole("link", { name: "Monitoring" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Studios" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Studios" })).toBeVisible();

  const studioName = uniqueName("E2E Shell Studio");
  await page.getByRole("button", { name: "Neues Studio" }).click();
  await page.getByLabel("Name").fill(studioName);
  await page.getByRole("button", { name: "Studio anlegen" }).click();

  const row = page.getByRole("link", { name: studioName });
  await expect(row).toBeVisible();
  await expect(page.getByText("Kein aktiver Plan").first()).toBeVisible();

  await row.click();
  await expect(page.getByRole("heading", { name: studioName })).toBeVisible();
  await expect(page.getByText("Noch kein Kursplan für dieses Studio.")).toBeVisible();
  await expect(page.getByText("Noch keine Trainer zugewiesen.")).toBeVisible();
});
