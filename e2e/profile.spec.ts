import { test, expect } from "@playwright/test";
import { loginAsPlatformAdmin, uniqueName } from "./helpers";

test("Stammdaten unter /settings bearbeiten und nach Reload erhalten", async ({ page }) => {
  await loginAsPlatformAdmin(page);

  const fullName = uniqueName("E2E Trainer");
  const phone = "+49 170 9876543";
  const street = "Torstraße";
  const houseNumber = "42";
  const postalCode = "10119";
  const city = "Berlin";

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Meine Stammdaten" })).toBeVisible();

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

  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Stammdaten gespeichert.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Vollständiger Name")).toHaveValue(fullName);
  await expect(page.getByLabel("Telefonnummer")).toHaveValue(phone);
  await expect(page.getByLabel("Straße")).toHaveValue(street);
  await expect(page.getByLabel("Hausnummer")).toHaveValue(houseNumber);
  await expect(page.getByLabel("PLZ")).toHaveValue(postalCode);
  await expect(page.getByLabel("Ort")).toHaveValue(city);
  await expect(page.getByLabel("Kleinunternehmer nach § 19 UStG")).toBeChecked({
    checked: nextChecked,
  });
});
