import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin, uniqueName } from "./helpers";

test("Stammdaten unter /profile im Read-Only-Modus ansehen, bearbeiten und nach Reload erhalten", async ({
  page,
}) => {
  await loginAsPlatformAdmin(page);

  const fullName = uniqueName("E2E Trainer");
  const phone = "+49 170 9876543";
  const street = "Torstraße";
  const houseNumber = "42";
  const postalCode = "10119";
  const city = "Berlin";

  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Meine Stammdaten" })).toBeVisible();
  const stammdaten = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Meine Stammdaten" }) });

  // Read-Only-Modus → Bearbeiten-Modus öffnen
  await stammdaten.getByRole("button", { name: "Bearbeiten" }).click();

  await page.getByLabel("Vollständiger Name").fill(fullName);
  await page.getByLabel("Telefonnummer").fill(phone);
  await page.getByLabel("Straße").fill(street);
  await page.getByLabel("Hausnummer").fill(houseNumber);
  await page.getByLabel("PLZ").fill(postalCode);
  await page.getByLabel("Ort").fill(city);

  const kleinunternehmer = page.getByLabel("Kleinunternehmer nach § 19 UStG");
  const nextChecked = !(await kleinunternehmer.isChecked());
  if (nextChecked) {
    await kleinunternehmer.check();
  } else {
    await kleinunternehmer.uncheck();
  }

  await stammdaten.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Stammdaten gespeichert.")).toBeVisible();

  // Nach dem Speichern zurück im Read-Only-Modus
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(phone)).toBeVisible();
  await expect(page.getByText(`${street} ${houseNumber}, ${postalCode} ${city}`)).toBeVisible();
  await expect(
    page.getByText(nextChecked ? "Kleinunternehmer (§ 19 UStG)" : "Regelbesteuert")
  ).toBeVisible();

  // Nach Reload bleiben Werte im Read-Only-Modus erhalten
  await page.reload();
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(phone)).toBeVisible();
  await expect(page.getByText(`${street} ${houseNumber}, ${postalCode} ${city}`)).toBeVisible();
  await expect(
    page.getByText(nextChecked ? "Kleinunternehmer (§ 19 UStG)" : "Regelbesteuert")
  ).toBeVisible();
});
