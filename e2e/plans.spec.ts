import { test, expect } from "@playwright/test";
import { ensureAdminHasCompany, loginAsPlatformAdmin, uniqueName } from "./helpers";

test("Kurstypen anlegen, Wochen-Stundenplan veröffentlichen und als neue Version aktualisieren", async ({
  page,
}) => {
  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);

  const adminEmail = process.env.E2E_PLATFORM_ADMIN_EMAIL!;
  const courseTypeName = uniqueName("E2E Yoga");
  const studioName = uniqueName("E2E Plan Studio");

  // 1. Sicherstellen, dass es mindestens eine:n Trainer:in mit aktivem Vertrag gibt
  //    (Admin bietet sich selbst einen Vertrag an und nimmt ihn an — kein Mailpit nötig).
  await page.goto("/trainers");
  const activeTab = page.getByRole("button", { name: /^Aktiv\s+\d+/ });
  const hasActiveContract = await page
    .getByRole("row")
    .filter({ hasText: "Aktiv" })
    .first()
    .isVisible()
    .catch(() => false);

  if (!hasActiveContract) {
    await page.getByRole("button", { name: "Vertrag anbieten" }).click();
    await page.getByLabel("E-Mail-Adresse der Person").fill(adminEmail);
    await page.getByLabel("Betrag (€)").fill("45,00");
    await page.getByLabel("Gültig ab").fill("2026-01-01");
    await page.getByRole("button", { name: "Angebot senden" }).click();
    await expect(page.getByText(/Angebot gesendet/)).toBeVisible();

    await page.goto("/settings?tab=contracts");
    const acceptBtn = page.getByRole("button", { name: "Annehmen" }).first();
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();
    await expect(page.getByText("Aktiv").first()).toBeVisible();
  } else {
    await expect(activeTab).toBeVisible();
  }

  // 2. Neues Studio anlegen, damit der Plan-Test isoliert ohne Alt-Plan startet
  await page.goto("/studios");
  await page.getByRole("button", { name: "Neues Studio" }).click();
  await page.getByLabel("Name").fill(studioName);
  await page.getByRole("button", { name: "Studio anlegen" }).click();
  await expect(page.getByRole("link", { name: studioName })).toBeVisible();

  // 3. Kurstyp unter /plans?tab=types anlegen
  await page.goto("/plans");
  await page.getByRole("tab", { name: "Kurstypen" }).click();
  await page.getByRole("button", { name: "Neuer Kurstyp" }).click();
  await page.getByLabel("Kursname").fill(courseTypeName);
  await page.getByLabel("Standarddauer (Min.)").fill("60");
  await page.getByRole("button", { name: "Kurstyp anlegen" }).click();
  await expect(page.getByText(courseTypeName)).toBeVisible();

  // 4. Zurück zum Stundenplan-Tab, Studio auswählen und Version 1 veröffentlichen
  await page.getByRole("tab", { name: "Stundenpläne" }).click();
  await page.getByRole("button", { name: studioName }).click();
  await expect(page.getByText("Noch kein Kursplan für dieses Studio.")).toBeVisible();

  await page.getByRole("button", { name: "Kursplan anlegen" }).click();
  await page.locator("#plan-valid-from").fill("2026-12-01");
  await page.locator("#slot-start").fill("18:00");
  await page.locator("#slot-end").fill("19:00");
  await page.locator("#slot-course-type").click();
  await page.getByRole("option", { name: new RegExp(courseTypeName) }).click();
  await page.getByRole("button", { name: "Hinzufügen" }).click();

  await page.getByRole("button", { name: "Kursplan veröffentlichen" }).click();
  await expect(page.getByText("Neue Kursplan-Version veröffentlicht.")).toBeVisible();
  await expect(page.getByText(courseTypeName).first()).toBeVisible();
  await expect(page.getByText("18:00–19:00").first()).toBeVisible();
  await expect(page.getByText("1 Kurs / Woche").first()).toBeVisible();

  // 5. Bearbeiten-Modus öffnen (bestehender Slot ist vorbefüllt), zweiten Slot ergänzen & Version 2 veröffentlichen
  await page.getByRole("button", { name: "Kursplan ändern" }).click();
  await page.locator("#plan-valid-from").fill("2027-01-01");
  await page.locator("#slot-weekday").click();
  await page.getByRole("option", { name: "Mittwoch" }).click();
  await page.locator("#slot-start").fill("07:30");
  await page.locator("#slot-end").fill("08:30");
  await page.locator("#slot-course-type").click();
  await page.getByRole("option", { name: new RegExp(courseTypeName) }).click();
  await page.getByRole("button", { name: "Hinzufügen" }).click();

  await page.getByRole("button", { name: "Neue Version veröffentlichen" }).click();
  await expect(page.getByText("Neue Kursplan-Version veröffentlicht.")).toBeVisible();
  await expect(page.getByText("2 Kurse / Woche").first()).toBeVisible();
  await expect(page.getByText("07:30–08:30").first()).toBeVisible();
});
