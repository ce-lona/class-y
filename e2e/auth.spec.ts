import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin } from "./helpers";

test("zeigt deutsche Zod-Fehlermeldung statt Browser-Validierung", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill("keine-email");
  await page.getByLabel("Passwort").fill("irgendwas");
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(page.getByText("Ungültige E-Mail-Adresse")).toBeVisible();
});

test("Login führt zur Startseite mit Nutzer-Session", async ({ page }) => {
  await loginAsPlatformAdmin(page);
  await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
});
