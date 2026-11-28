import { test, expect } from "@playwright/test";
import {
  createActiveTrainer,
  endTrainerContract,
  ensureAdminHasCompany,
  loginAsPlatformAdmin,
} from "./helpers";

// Hilfe & Support gegen den lokalen Stack (`supabase start`, `supabase functions serve` für
// send-support-message und invite-trainer, Mailpit). Ohne SUPPORT_SMTP_*-Secrets wird die
// Nachricht nur gespeichert, der Posteingang zeigt sie trotzdem.

test("Support: Empfänger pflegen, Nachricht senden, im Posteingang sehen", async ({ page }) => {
  const extra = `e2e-support-${Date.now()}@example.test`;
  const text = `E2E-Supportnachricht ${Date.now()}`;

  await loginAsPlatformAdmin(page);
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: "Support-Empfänger" })).toBeVisible();

  // Empfänger hinzufügen (ungültige Adresse wird abgelehnt). Eine feste Basisadresse sorgt dafür,
  // dass die Testadresse am Ende entfernt werden kann (die letzte Adresse ist nicht löschbar).
  const input = page.getByLabel("Neue Empfänger-Adresse");
  const recipients = page.getByRole("list", { name: "Support-Empfänger" });
  const base = "e2e-support-base@example.test";
  await expect(recipients.or(page.getByText("Noch keine Adresse"))).toBeVisible();
  if ((await recipients.getByText(base).count()) === 0) {
    await input.fill(base);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(recipients.getByText(base)).toBeVisible();
  }
  await input.fill("keine-mail");
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByText("Das sieht nicht nach einer E-Mail-Adresse aus.")).toBeVisible();
  await input.fill(extra);
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(recipients.getByText(extra)).toBeVisible();

  // Nachricht über das Kontaktformular senden
  await page.getByRole("link", { name: "Hilfe" }).click();
  await expect(page.getByRole("heading", { name: "Hilfe & Support", level: 1 })).toBeVisible();
  await page.getByText("Etwas funktioniert nicht").click();
  await page.getByRole("button", { name: "Nachricht senden" }).click();
  await expect(page.getByText("Bitte schreib ein paar Worte.")).toBeVisible();
  await page.getByLabel("Deine Nachricht").fill(text);
  await page.getByRole("button", { name: "Nachricht senden" }).click();
  await expect(page.getByText("Danke, deine Nachricht ist angekommen.")).toBeVisible();

  // Posteingang zeigt die Nachricht; Testadresse wieder entfernen
  await page.goto("/support");
  await expect(page.getByText(text)).toBeVisible();
  await recipients.getByRole("button", { name: `${extra} entfernen` }).click();
  await expect(recipients.getByText(extra)).toHaveCount(0);
});

test("Onboarding: Willkommens-Dialog und Rundgang für neue Trainer:innen", async ({
  page,
  browser,
}, testInfo) => {
  await loginAsPlatformAdmin(page);
  await ensureAdminHasCompany(page);
  const { trainer, context, email } = await createActiveTrainer(page, browser, testInfo, {
    showOnboarding: true,
  });
  try {
    await trainer.goto("/courses");
    const welcome = trainer.getByRole("dialog", { name: "Willkommen bei class-y!" });
    await expect(welcome).toBeVisible();
    await welcome.getByRole("button", { name: "Rundgang starten" }).click();

    const tour = trainer.getByRole("dialog", { name: "Meine Kurse" });
    await expect(tour).toContainText("Schritt 1 von 5");
    for (let i = 0; i < 4; i++) {
      await trainer.getByRole("button", { name: "Weiter" }).click();
    }
    await expect(trainer.getByText("Schritt 5 von 5")).toBeVisible();
    await trainer.getByRole("button", { name: "Fertig" }).click();
    await expect(trainer.getByText("Fertig! Den Rundgang findest du jederzeit unter „Hilfe“.")).toBeVisible();

    // Dialog erscheint nicht erneut; Rundgang lässt sich unter Hilfe neu starten
    await trainer.reload();
    await expect(trainer.getByRole("link", { name: "Hilfe" })).toBeVisible();
    await expect(trainer.getByRole("dialog", { name: "Willkommen bei class-y!" })).toHaveCount(0);
    await trainer.getByRole("link", { name: "Hilfe" }).click();
    await expect(trainer.getByRole("button", { name: "Kurse erfassen" })).toBeVisible();
    await expect(trainer.getByRole("button", { name: "Studio anlegen" })).toHaveCount(0);
    await trainer.getByRole("button", { name: "Rundgang starten" }).click();
    await expect(trainer.getByText("Schritt 1 von 5")).toBeVisible();
    await trainer.getByRole("button", { name: "Beenden" }).click();
    await expect(trainer.getByText("Schritt 1 von 5")).toHaveCount(0);
  } finally {
    await context.close();
    await endTrainerContract(page, email);
  }
});
