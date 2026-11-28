import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin, uniqueName } from "./helpers";

test("Studio-Admin-Shell: Studio anlegen und Detailseite prüfen", async ({ page }) => {
  await loginAsPlatformAdmin(page);

  // /studios leitet in Einstellungen › Studios um
  await page.goto("/studios");
  await expect(page).toHaveURL(/\/settings\?section=studios/);
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await expect(nav.locator('a[href="/overview"]')).toBeVisible();
  for (const name of ["Kurse", "Kurspläne", "Team", "Abrechnung"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Einstellungen", exact: true })).toBeVisible();
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

test("Team: Person hinzufügen mit Rollenwahl und Seitenpanel einer Person", async ({ page }) => {
  await loginAsPlatformAdmin(page);
  await page.goto("/team");
  await expect(page.getByRole("heading", { name: "Team", level: 1 })).toBeVisible();

  // Ein Schritt: Rollenwahl oben, darunter das passende Formular
  await page.getByRole("button", { name: "Person hinzufügen" }).click();
  const drawer = page.getByRole("dialog", { name: "Person hinzufügen" });
  await expect(drawer.getByRole("radio", { name: /Trainer:in/ })).toHaveAttribute("aria-checked", "true");
  await expect(drawer.getByLabel("E-Mail-Adresse der Person")).toBeVisible();
  await drawer.getByRole("radio", { name: /^Admin/ }).click();
  await expect(drawer.getByRole("radio", { name: /^Admin/ })).toHaveAttribute("aria-checked", "true");
  await expect(drawer.locator("#admin-email")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);

  // Klick auf eine Person öffnet das Seitenpanel
  await page.getByRole("row").nth(1).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Stammdaten" })).toBeVisible();
});
