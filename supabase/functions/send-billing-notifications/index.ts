import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// Verschickt die E-Mail-Benachrichtigungen zu Gutschriften und Tätigkeitsnachweisen aus der
// Outbox billing_notifications (Migration 20261128120000_billing_notifications).
// Aufruf alle 10 Minuten durch pg_cron (billing_notify_dispatch) mit
//   Authorization: Bearer <BILLING_NOTIFY_SECRET>
// Kein Nutzer-JWT (verify_jwt = false), daher prüft die Function das Secret selbst.
//
// Secrets:
//   BILLING_NOTIFY_SECRET  gemeinsames Secret mit dem Vault-Secret billing_notify_secret
//   APP_URL                Adresse der App für die Links in den Mails
//   SUPPORT_SMTP_*         derselbe SMTP-Zugang wie für send-support-message
// Abbestellen: Company-weit (Einstellungen → Abrechnung) und persönlich (Profil); beides prüft
// schon die Datenbank beim Einreihen bzw. Abholen.
// Ohne SMTP-Secrets bleiben die Mails in der Outbox liegen (höchstens 7 Tage).
// In den Mails stehen bewusst keine Beträge, IBAN- oder Steuerdaten.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTIFY_SECRET = Deno.env.get("BILLING_NOTIFY_SECRET") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "https://class-y.vercel.app").replace(/\/+$/, "");

const SMTP_HOST = Deno.env.get("SUPPORT_SMTP_HOST");
const SMTP_PORT = Number(Deno.env.get("SUPPORT_SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SUPPORT_SMTP_USER");
const SMTP_PASS = Deno.env.get("SUPPORT_SMTP_PASS");
const SMTP_FROM = Deno.env.get("SUPPORT_SMTP_FROM") ?? SMTP_USER;
const SMTP_SECURE = (Deno.env.get("SUPPORT_SMTP_SECURE") ?? String(SMTP_PORT === 465)) !== "false";

const BATCH_SIZE = 50;
const PROFILE_URL = `${APP_URL}/profile#mail-preferences`;
const UNSUBSCRIBE_TEXT = "Du kannst diese E-Mails in deinem Profil abbestellen.";

interface PendingNotification {
  id: string;
  kind: "document_ready" | "review_reminder" | "correction_request";
  recipient_email: string;
  recipient_name: string | null;
  company_name: string;
  document_kind: "credit_note" | "cancellation" | "statement";
  document_number: string | null;
  document_version: number;
  replaces_number: string | null;
  month: string;
  review_due: string | null;
  comment_kind: "correction_request" | "comment" | null;
  comment_body: string | null;
  comment_author_name: string | null;
  trainer_name: string | null;
}

interface Mail {
  subject: string;
  paragraphs: string[];
  quote?: string;
  link: { label: string; url: string };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function oneLine(value: unknown, max = 120): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

function formatMonth(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "";
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildMail(n: PendingNotification): Mail {
  const company = oneLine(n.company_name);
  const month = formatMonth(n.month);
  const number = oneLine(n.document_number, 40);
  const trainerLink = { label: "Zu deinen Belegen", url: `${APP_URL}/courses/billing` };

  if (n.kind === "document_ready" && n.document_kind === "statement") {
    const version = n.document_version > 1 ? ` (Version ${n.document_version})` : "";
    return {
      subject: `Neuer Tätigkeitsnachweis für ${month}`,
      paragraphs: [
        `${company} hat deinen Tätigkeitsnachweis für ${month}${version} bereitgestellt.`,
        "Fällt dir ein Fehler auf, kannst du ihn direkt beim Nachweis kommentieren.",
      ],
      link: trainerLink,
    };
  }

  if (n.kind === "document_ready") {
    const replaces = n.replaces_number ? `, ersetzt Nr. ${oneLine(n.replaces_number, 40)}` : "";
    return {
      subject: `Neue Gutschrift zur Prüfung: ${number}`,
      paragraphs: [
        `${company} hat dir eine Gutschrift für ${month} ausgestellt (Nr. ${number}${replaces}).`,
        `Bitte prüfe sie bis ${formatDate(n.review_due)}. Ohne Rückmeldung gilt sie danach als freigegeben.`,
      ],
      link: { label: "Gutschrift prüfen", url: trainerLink.url },
    };
  }

  if (n.kind === "review_reminder") {
    return {
      subject: `Erinnerung: Gutschrift ${number} heute zuletzt prüfen`,
      paragraphs: [
        `heute endet die Prüffrist für deine Gutschrift Nr. ${number} (${month}) von ${company}.`,
        "Ohne Rückmeldung gilt sie ab morgen als freigegeben. Stimmt etwas nicht, fordere bitte heute noch eine Korrektur an.",
      ],
      link: { label: "Gutschrift prüfen", url: trainerLink.url },
    };
  }

  // correction_request
  const author = oneLine(n.comment_author_name || n.trainer_name) || "Eine Person";
  const trainer = oneLine(n.trainer_name);
  const adminLink = { label: "Zur Abrechnung", url: `${APP_URL}/billing` };
  const quote = String(n.comment_body ?? "").trim().slice(0, 2000);
  if (n.document_kind === "statement") {
    return {
      subject: `Kommentar von ${author} zum Tätigkeitsnachweis ${month}`,
      paragraphs: [
        `${author} hat den Tätigkeitsnachweis für ${month}${trainer && trainer !== author ? ` von ${trainer}` : ""} kommentiert:`,
      ],
      quote,
      link: adminLink,
    };
  }
  return {
    subject: `Korrekturwunsch von ${author} zu Gutschrift ${number}`,
    paragraphs: [
      `${author} hat zur Gutschrift Nr. ${number} (${month}${trainer && trainer !== author ? `, ${trainer}` : ""}) eine Korrektur angefordert:`,
    ],
    quote,
    link: adminLink,
  };
}

function renderText(n: PendingNotification, mail: Mail): string {
  const name = oneLine(n.recipient_name);
  const lines = [name ? `Hallo ${name},` : "Hallo,", ""];
  for (const p of mail.paragraphs) lines.push(p, "");
  if (mail.quote) lines.push(mail.quote.split("\n").map((l) => `> ${l}`).join("\n"), "");
  lines.push(`${mail.link.label}: ${mail.link.url}`, "", "Viele Grüße", "class-y", "");
  lines.push(
    `Diese Nachricht wurde automatisch im Auftrag von ${oneLine(n.company_name)} verschickt.`,
    `${UNSUBSCRIBE_TEXT} ${PROFILE_URL}`,
  );
  return lines.join("\n");
}

function renderHtml(n: PendingNotification, mail: Mail): string {
  const name = oneLine(n.recipient_name);
  const p = (text: string) => `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`;
  const quote = mail.quote
    ? `<blockquote style="margin:0 0 16px;padding:8px 14px;border-left:3px solid #c7c2f0;color:#333;white-space:pre-wrap">${escapeHtml(mail.quote)}</blockquote>`
    : "";
  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f6f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
${p(name ? `Hallo ${name},` : "Hallo,")}
${mail.paragraphs.map(p).join("\n")}
${quote}
<p style="margin:24px 0"><a href="${escapeHtml(mail.link.url)}" style="display:inline-block;background:#5b4fd6;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(mail.link.label)}</a></p>
${p("Viele Grüße")}
<p style="margin:0">class-y</p>
<p style="margin:24px 0 0;font-size:12px;color:#777">${escapeHtml(`Diese Nachricht wurde automatisch im Auftrag von ${oneLine(n.company_name)} verschickt.`)}<br><a href="${escapeHtml(PROFILE_URL)}" style="color:#777">${escapeHtml(UNSUBSCRIBE_TEXT)}</a></p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!NOTIFY_SECRET || !safeEqual(req.headers.get("Authorization") ?? "", `Bearer ${NOTIFY_SECRET}`)) {
    return json({ error: "unauthorized" }, 401);
  }

  if (!SMTP_HOST || !SMTP_FROM) {
    // Ohne SMTP nichts abholen: die Mails bleiben ausstehend.
    return json({ configured: false, sent: 0, failed: 0 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.rpc("billing_pending_notifications", { p_limit: BATCH_SIZE });
  if (error) {
    console.error("billing_pending_notifications failed", error);
    return json({ error: "pending_failed" }, 500);
  }
  const pending = (data ?? []) as PendingNotification[];
  if (pending.length === 0) {
    return json({ configured: true, sent: 0, failed: 0 });
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    let sendError: string | null = null;
    try {
      const mail = buildMail(n);
      await transport.sendMail({
        from: { name: "class-y", address: SMTP_FROM },
        to: n.recipient_email,
        subject: mail.subject,
        text: renderText(n, mail),
        html: renderHtml(n, mail),
      });
      sent++;
    } catch (err) {
      failed++;
      sendError = err instanceof Error ? err.message : String(err);
      console.error("billing notification failed", n.id, sendError);
    }
    const { error: markError } = await admin.rpc("mark_billing_notification", {
      p_id: n.id,
      p_error: sendError,
    });
    if (markError) console.error("mark_billing_notification failed", n.id, markError);
  }

  return json({ configured: true, sent, failed });
});
