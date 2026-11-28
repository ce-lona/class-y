import { test, expect, type Page } from "@playwright/test";
import {
  acceptContractOffer,
  endTrainerContract,
  ensureAdminHasCompany,
  getInviteLink,
  loginAsPlatformAdmin,
  uniqueEmail,
  uniqueName,
} from "./helpers";

// Gutschriften-Flow gegen den lokalen Stack (supabase start, functions serve, Mailpit):
// Rechnungsanschrift → Vertrag mit Stammdaten annehmen → Studio bestätigt → Kurs im Vormonat →
// Gutschrift erstellen → Trainer:in fordert Korrektur an → Kurs ergänzt → Storno + neue
// Gutschrift → Trainer:in gibt frei → Kommentar erledigt → PDF.

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const now = new Date();
const previousMonthStart = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const courseDay1 = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 10));
const courseDay2 = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 17));

async function logAdHocCourse(page: Page, studioName: string, courseTypeName: string, date: string, note: string) {
  await page.goto("/courses/log");
  await page.getByRole("tab", { name: "Ad-hoc" }).click();
  await page.locator("#adhoc-studio").click();
  await page.getByRole("listbox").getByRole("option", { name: new RegExp(studioName) }).click();
  await page.locator("#adhoc-date").fill(date);
  await page.locator("#adhoc-start").fill("18:00");
  await page.locator("#adhoc-end").fill("19:00");
  await page.locator("#adhoc-course-type").click();
  await page.getByRole("option", { name: new RegExp(courseTypeName) }).click();
  await page.getByLabel("Notizen (optional)").fill(note);
  await page.getByRole("button", { name: "Kurs speichern" }).click();
  await page.waitForURL("/courses");
}

test("Gutschriften: Vertrag mit Stammdaten, Bestätigung, Gutschrift, Korrektur mit Storno, Freigabe", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const trainerEmail = uniqueEmail("e2e-gutschrift");
  const trainerName = uniqueName("E2E Gutschrift");
  const studioName = uniqueName("E2E GS-Studio");
  const courseTypeName = uniqueName("GS-Kurs");

  // 1. Admin: Rechnungsanschrift der Company, Studio und Kurstyp
  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);

  // Rechnungsanschrift liegt in Einstellungen › Company
  await page.goto("/settings?section=company");
  const address = page.locator("#company-address");
  for (const [label, value] of [
    ["Straße", "Musterstraße"],
    ["Hausnummer", "12"],
    ["PLZ", "70173"],
    ["Ort", "Stuttgart"],
  ] as const) {
    await address.getByLabel(label, { exact: true }).fill(value);
  }
  await address.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Rechnungsanschrift gespeichert.")).toBeVisible();
  await page.goto("/settings?section=billing");
  await expect(page.getByRole("heading", { name: "Gutschriften & Nachweise" })).toBeVisible();
  await expect(page.getByText("Die Rechnungsanschrift der Company fehlt noch.")).toHaveCount(0);

  await page.goto("/studios");
  await page.getByRole("button", { name: "Neues Studio" }).click();
  await page.getByLabel("Name").fill(studioName);
  await page.getByRole("button", { name: "Studio anlegen" }).click();
  await expect(page.getByRole("link", { name: studioName })).toBeVisible();

  await page.goto("/settings?tab=config");
  await page.getByRole("button", { name: "Neuer Kurstyp" }).click();
  await page.getByLabel("Kursname").fill(courseTypeName);
  await page.getByLabel("Standarddauer (Min.)").fill("60");
  await page.getByRole("button", { name: "Kurstyp anlegen" }).click();
  await expect(page.getByText(courseTypeName)).toBeVisible();

  // 2. Vertrag (freiberuflich, 37 € pro Kurs) ab Anfang Vormonat anbieten
  await page.goto("/trainers");
  await page.getByRole("button", { name: "Vertrag anbieten" }).click();
  await page.getByLabel("E-Mail-Adresse der Person").fill(trainerEmail);
  await page.getByLabel("Betrag (€)").fill("37,00");
  await page.getByLabel("Gültig ab").fill(previousMonthStart);
  await page.getByRole("button", { name: "Angebot senden" }).click();
  await expect(page.getByText("Einladung und Angebot gesendet.")).toBeVisible();

  const trainerContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: testInfo.project.use.storageState,
    recordVideo: { dir: testInfo.outputPath("trainer-video") },
  });
  const trainer = await trainerContext.newPage();
  try {
    // 3. Trainer:in: Passwort setzen, Angebot nur mit Stammdaten + Zustimmung annehmbar
    await trainer.goto(await getInviteLink(trainerEmail));
    await trainer.getByLabel("Neues Passwort").fill(`E2e-${Date.now()}`);
    await trainer.getByRole("button", { name: "Neues Passwort setzen" }).click();
    await trainer.waitForURL("/");

    await trainer.goto("/profile?tab=contracts");
    const offer = trainer.getByRole("listitem").filter({ hasText: "37,00" });
    await offer.getByRole("button", { name: "Annehmen" }).click();
    const dialog = trainer.getByRole("dialog", { name: "Vertrag annehmen" });
    await dialog.getByRole("button", { name: "Vertrag annehmen" }).click();
    await expect(dialog.getByText("Bitte stimme dem Gutschriftverfahren zu")).toBeVisible();
    await dialog.getByRole("button", { name: "Abbrechen" }).click();

    await acceptContractOffer(trainer, offer, { name: trainerName });
    await expect(offer).toContainText("Aktiv");
    await expect(offer).toContainText("Wartet auf Bestätigung durchs Studio");

    // 4. Admin bestätigt den Vertrag
    await page.goto("/trainers");
    const row = page.getByRole("row").filter({ hasText: trainerEmail });
    await expect(row).toContainText("Nicht bestätigt");
    await row.getByRole("button", { name: "Bestätigen" }).click();
    await expect(row.getByRole("button", { name: "Bestätigen" })).toHaveCount(0);

    // 5. Trainer:in trägt einen Kurs im Vormonat ein
    await logAdHocCourse(trainer, studioName, courseTypeName, courseDay1, "GS E2E 1");

    // 6. Admin erstellt die Gutschriften für den Vormonat
    await page.goto("/billing");
    const previewRow = page.getByTestId("billing-preview-row").filter({ hasText: trainerName });
    await expect(previewRow).toContainText("Neu");
    await expect(previewRow).toContainText("44,03"); // 37,00 + 19 % USt
    await page.getByTestId("issue-billing-documents").click();
    await expect(page.getByText(/^Erstellt:/)).toBeVisible();
    const docRow = page.getByTestId("billing-document-row").filter({ hasText: trainerName });
    await expect(docRow).toContainText("Gutschrift");
    await expect(docRow).toContainText("Offen bis");

    // 7. Trainer:in fordert eine Korrektur an
    await trainer.goto("/courses/billing");
    const openNote = trainer.getByTestId("open-credit-note");
    await expect(openNote).toContainText("44,03");
    await openNote.getByRole("button", { name: "Korrektur anfordern" }).click();
    const correction = trainer.getByRole("dialog", { name: "Korrektur anfordern" });
    await correction.getByLabel("Was soll korrigiert werden?").fill("Der Kurs am 17. fehlt.");
    await correction.getByRole("button", { name: "Absenden" }).click();
    await expect(trainer.getByTestId("my-billing-document").first()).toContainText("Korrektur angefordert");

    // 8. Kurs wird ergänzt → Storno + neue Gutschrift
    await logAdHocCourse(trainer, studioName, courseTypeName, courseDay2, "GS E2E 2");

    await page.reload();
    const comment = page
      .getByTestId("billing-comment")
      .filter({ hasText: trainerName })
      .filter({ hasText: "Der Kurs am 17. fehlt." });
    await expect(comment).toBeVisible();
    await expect(previewRow).toContainText("Storno + neu");
    await expect(previewRow).toContainText("88,06");
    await page.getByTestId("issue-billing-documents").click();
    await expect(page.getByText(/^Erstellt:/)).toBeVisible();
    await expect(
      page.getByTestId("billing-document-row").filter({ hasText: trainerName }).filter({ hasText: "Stornogutschrift" }),
    ).toContainText("-44,03");

    await comment.getByRole("button", { name: "Als erledigt markieren" }).click();
    await expect(comment).toContainText("Erledigt");

    // 9. Trainer:in gibt die neue Gutschrift frei
    await trainer.goto("/courses/billing");
    const newNote = trainer.getByTestId("open-credit-note");
    await expect(newNote).toContainText("88,06");
    await expect(newNote).toContainText("ersetzt");
    await newNote.getByRole("button", { name: "Freigeben" }).click();
    await expect(trainer.getByTestId("open-credit-note")).toHaveCount(0);
    await expect(
      trainer.getByTestId("my-billing-document").filter({ hasText: "88,06" }),
    ).toContainText("Freigegeben");

    // 10. Admin lädt das PDF der neuen Gutschrift
    await page.reload();
    const approvedRow = page
      .getByTestId("billing-document-row")
      .filter({ hasText: trainerName })
      .filter({ hasText: "Freigegeben" });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      approvedRow.getByRole("button", { name: "PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Gutschrift_.*\.pdf$/);

    await endTrainerContract(page, trainerEmail);
  } finally {
    await trainerContext.close();
    const video = trainer.video();
    if (video) {
      await testInfo.attach("trainer-video", { path: await video.path(), contentType: "video/webm" });
    }
  }
});
