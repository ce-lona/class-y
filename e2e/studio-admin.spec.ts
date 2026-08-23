import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin, uniqueName } from "./helpers";

test("Studio-Admin-Shell: Studio anlegen und Detailseite prüfen", async ({ page }) => {
  await loginAsPlatformAdmin(page);

  await page.goto("/studios");
  await expect(page.getByRole("link", { name: "Monitoring" })).toBeVisible();
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
