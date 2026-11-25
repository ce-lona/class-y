import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  ensureAdminHasCompany,
  getInviteLink,
  loginAsPlatformAdmin,
  uniqueEmail,
} from "./helpers";

// Vertragsfluss gegen den lokalen Stack: braucht `supabase start`, `supabase functions serve`
// (invite-trainer) und Mailpit. Admin (/trainers) und Trainer:in (/profile?tab=contracts)
// laufen in getrennten Browser-Kontexten.

function adminRow(page: Page, trainerEmail: string, amount: string): Locator {
  return page
    .getByRole("row")
    .filter({ hasText: trainerEmail })
    .filter({ hasText: amount });
}

function trainerRow(page: Page, amount: string): Locator {
  return page.getByRole("listitem").filter({ hasText: amount });
}

async function offerContract(page: Page, email: string, amount: string) {
  await page.getByRole("button", { name: "Vertrag anbieten" }).click();
  await page.getByLabel("E-Mail-Adresse der Person").fill(email);
  await page.getByLabel("Betrag (€)").fill(amount);
  await page.getByLabel("Gültig ab").fill("2027-01-01");
  await page.getByRole("button", { name: "Angebot senden" }).click();
}

test("Vertrag: einladen, annehmen, zweites Angebot ablehnen, beenden", async ({
  page,
  browser,
}, testInfo) => {
  const trainerEmail = uniqueEmail("e2e-trainer");
  const trainerPassword = `E2e-${Date.now()}`;

  // Admin bietet unter /trainers einer noch unbekannten Person einen Vertrag an
  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);
  await offerContract(page, trainerEmail, "42,50");
  await expect(page.getByText("Einladung und Angebot gesendet.")).toBeVisible();
  await expect(adminRow(page, trainerEmail, "42,50")).toContainText("Wartet auf Annahme");

  // Trainer:in: Einladungslink → Passwort setzen → Angebot unter Einstellungen annehmen
  const trainerContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    recordVideo: { dir: testInfo.outputPath("trainer-video") },
  });
  const trainer = await trainerContext.newPage();
  try {
    await trainer.goto(await getInviteLink(trainerEmail));
    await expect(trainer.getByRole("heading", { name: "Neues Passwort setzen" })).toBeVisible();
    await trainer.getByLabel("Neues Passwort").fill(trainerPassword);
    await trainer.getByRole("button", { name: "Neues Passwort setzen" }).click();
    await trainer.waitForURL("/");

    await trainer.goto("/profile");
    await trainer.getByRole("tab", { name: /Meine Verträge/ }).click();
    const offer = trainerRow(trainer, "42,50");
    await expect(offer).toContainText("Wartet auf Annahme");
    await offer.getByRole("button", { name: "Annehmen" }).click();
    await expect(offer).toContainText("Aktiv");
    await expect(offer.getByRole("button", { name: "Annehmen" })).toHaveCount(0);

    // Admin sieht den Vertrag als aktiv und bietet zusätzlich einen zweiten an (Konto existiert)
    await page.reload();
    await expect(adminRow(page, trainerEmail, "42,50")).toContainText("Aktiv");
    await offerContract(page, trainerEmail, "30,00");
    await expect(page.getByText("Angebot gesendet. Die Person muss es noch annehmen.")).toBeVisible();

    // Trainer:in lehnt das zweite Angebot ab
    await trainer.reload();
    const second = trainerRow(trainer, "30,00");
    await second.getByRole("button", { name: "Ablehnen" }).click();
    await expect(second).toContainText("Abgelehnt");

    // Admin sieht das abgelehnte Angebot im Filter "Alle" und beendet den aktiven Vertrag
    await page.reload();
    await page.getByRole("button", { name: /^Alle/ }).click();
    await expect(adminRow(page, trainerEmail, "30,00")).toContainText("Abgelehnt");
    const active = adminRow(page, trainerEmail, "42,50");
    await active.getByRole("button", { name: "Beenden" }).click();
    await expect(active).toContainText("Beendet");

    await trainer.reload();
    await expect(trainerRow(trainer, "42,50")).toContainText("Beendet");
  } finally {
    await trainerContext.close();
    const video = trainer.video();
    if (video) {
      await testInfo.attach("trainer-video", { path: await video.path(), contentType: "video/webm" });
    }
  }
});
