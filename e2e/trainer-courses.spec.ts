import { test, expect } from "@playwright/test";
import { ensureAdminHasCompany, loginAsPlatformAdmin, uniqueName } from "./helpers";

const WEEKDAYS_DE: Record<number, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
  7: "Sonntag",
};

function todayWeekdayDE(): string {
  const jsDay = new Date().getDay();
  return WEEKDAYS_DE[jsDay === 0 ? 7 : jsDay];
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test("Trainer-Kurserfassung: geplanten Kurs als gegeben markieren, Ad-hoc-Vertretung eintragen und entfernen", async ({
  page,
}) => {
  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);

  const adminEmail = process.env.E2E_PLATFORM_ADMIN_EMAIL!;
  const studioName = uniqueName("E2E Trainer Studio");
  const courseTypeName = uniqueName("E2E HIIT");

  // 1. Sicherstellen, dass der Account einen aktiven Vertrag hat
  await page.goto("/trainers");
  await expect(page.getByText("Lädt…")).toHaveCount(0);
  const hasActive = await page
    .getByRole("row")
    .filter({ hasText: "Aktiv" })
    .first()
    .isVisible();

  if (!hasActive) {
    await page.getByRole("button", { name: "Vertrag anbieten" }).click();
    await page.getByLabel("E-Mail-Adresse der Person").fill(adminEmail);
    await page.getByLabel("Betrag (€)").fill("50,00");
    await page.getByLabel("Gültig ab").fill("2026-01-01");
    await page.getByRole("button", { name: "Angebot senden" }).click();
    await expect(page.getByText(/Angebot gesendet/)).toBeVisible();

    await page.goto("/profile?tab=contracts");
    await page.getByRole("button", { name: "Annehmen" }).first().click();
    await expect(page.getByText("Aktiv").first()).toBeVisible();
  }

  // 2. Studio + Kurstyp + Plan-Slot für den heutigen Wochentag anlegen
  await page.goto("/studios");
  await page.getByRole("button", { name: "Neues Studio" }).click();
  await page.getByLabel("Name").fill(studioName);
  await page.getByRole("button", { name: "Studio anlegen" }).click();
  await expect(page.getByRole("link", { name: studioName })).toBeVisible();

  await page.goto("/settings?tab=config");
  await page.getByRole("button", { name: "Neuer Kurstyp" }).click();
  await page.getByLabel("Kursname").fill(courseTypeName);
  await page.getByLabel("Standarddauer (Min.)").fill("45");
  await page.getByRole("button", { name: "Kurstyp anlegen" }).click();
  await expect(page.getByText(courseTypeName)).toBeVisible();

  await page.goto("/plans");
  await page.getByRole("button", { name: studioName }).click();
  await page.getByRole("button", { name: "Kursplan anlegen" }).click();
  await page.locator("#plan-valid-from").fill(todayISO());
  await page.locator("#slot-weekday").click();
  await page.getByRole("option", { name: todayWeekdayDE() }).click();
  await page.locator("#slot-start").fill("17:00");
  await page.locator("#slot-end").fill("17:45");
  await page.locator("#slot-course-type").click();
  await page.getByRole("option", { name: new RegExp(courseTypeName) }).click();
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await page.getByRole("button", { name: "Kursplan veröffentlichen" }).click();
  await expect(page.getByText("Neue Kursplan-Version veröffentlicht.")).toBeVisible();

  // 3. Trainer-Ansicht (/courses) & eigener Stundenplan (/courses/schedule)
  await page.goto("/courses/schedule");
  await expect(page.getByRole("heading", { name: "Mein Stundenplan" })).toBeVisible();
  await expect(page.getByText(courseTypeName).first()).toBeVisible();
  await expect(page.getByText(studioName).first()).toBeVisible();

  await page.goto("/courses");
  const todayCard = page
    .locator("div.rounded-2xl")
    .filter({ hasText: courseTypeName })
    .first();
  await expect(todayCard).toBeVisible();
  await todayCard.getByRole("button", { name: "Als gegeben markieren" }).click();
  await expect(todayCard.getByText("Gegeben")).toBeVisible();

  // 4. Ad-hoc-Vertretungskurs über /courses/log erfassen
  await page.getByRole("link", { name: "Kurs eintragen" }).click();
  await expect(page.getByRole("heading", { name: "Kurs eintragen" })).toBeVisible();
  await page.getByRole("tab", { name: "Ad-hoc" }).click();

  await page.locator("#adhoc-studio").click();
  await page.getByRole("option", { name: new RegExp(studioName) }).click();
  await page.locator("#adhoc-start").fill("19:00");
  await page.locator("#adhoc-end").fill("19:45");
  await page.locator("#adhoc-course-type").click();
  await page.getByRole("option", { name: new RegExp(courseTypeName) }).click();
  await page.getByLabel("Das war eine Vertretung").check();
  await page.getByLabel("Notizen (optional)").fill("Spontane Vertretung E2E");
  await page.getByRole("button", { name: "Kurs speichern" }).click();

  await page.waitForURL("/courses");

  // 5. Im Tab "Erfasst" beide Sessions prüfen und die Ad-hoc-Session wieder entfernen
  await page.getByRole("tab", { name: /Erfasst/ }).click();
  const adHocRow = page
    .getByRole("listitem")
    .filter({ hasText: "Spontane Vertretung E2E" });
  await expect(adHocRow).toBeVisible();
  await expect(adHocRow).toContainText("Ad-hoc");
  await expect(adHocRow).toContainText("Vertretung");
  await expect(adHocRow).toContainText("Gegeben");

  await adHocRow.getByRole("button", { name: "Entfernen" }).click();
  await expect(adHocRow).toHaveCount(0);
});
