import { test, expect } from "@playwright/test";
import { ensureAdminHasCompany, loginAsPlatformAdmin } from "./helpers";

// E-Mail-Benachrichtigungen zu Gutschriften: company-weit (Einstellungen → Abrechnung) und
// persönlich (Profil → Stammdaten) abschaltbar. Der Versand selbst ist per pgTAP getestet.

test("Abrechnungs-Mails company-weit in den Einstellungen abschalten und wieder einschalten", async ({ page }) => {
  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);

  await page.goto("/settings?tab=billing");
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Gutschriften & Nachweise" }) });
  await expect(section.getByRole("heading", { name: "E-Mail-Benachrichtigungen" })).toBeVisible();

  const reminder = section.getByLabel("Erinnerung am letzten Prüftag");
  await expect(reminder).toBeChecked();
  await reminder.uncheck();
  await section.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Einstellungen gespeichert.")).toBeVisible();

  await page.reload();
  await expect(section.getByLabel("Erinnerung am letzten Prüftag")).not.toBeChecked();
  await expect(section.getByLabel("Neue Gutschrift oder neuer Nachweis")).toBeChecked();

  await section.getByLabel("Erinnerung am letzten Prüftag").check();
  await section.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Einstellungen gespeichert.")).toBeVisible();
});

test("Abrechnungs-Mails persönlich im Profil abbestellen", async ({ page }) => {
  await loginAsPlatformAdmin(page);

  await page.goto("/profile");
  const section = page.locator("#mail-preferences");
  await expect(section.getByRole("heading", { name: "E-Mail-Benachrichtigungen" })).toBeVisible();
  const correction = () => page.locator("#mail-preferences").getByLabel("Korrekturwünsche und Kommentare");

  // Abbestellen (Ausgangszustand ggf. aus einem abgebrochenen Lauf zurücksetzen)
  if (!(await correction().isChecked())) {
    await correction().check();
    await expect(correction()).toBeChecked();
    await expect(correction()).toBeEnabled();
  }
  await correction().uncheck();
  await expect(section.getByText("Gespeichert.")).toBeVisible();

  await page.reload();
  await expect(correction()).not.toBeChecked();

  // Wieder einschalten
  await correction().check();
  await expect(page.locator("#mail-preferences").getByText("Gespeichert.")).toBeVisible();
  await page.reload();
  await expect(correction()).toBeChecked();
});
