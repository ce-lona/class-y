import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// Kontaktformular im Hilfe-Bereich: speichert die Nachricht (submit_support_message, mit dem
// JWT der absendenden Person inkl. Rate-Limit) und schickt sie per SMTP an alle Adressen aus
// support_recipients. Reply-To ist die absendende Person, damit eine Antwort direkt bei ihr landet.
//
// SMTP-Zugang über Secrets (kostenlos, z.B. das Postfach des eigenen Mail-Anbieters):
//   SUPPORT_SMTP_HOST, SUPPORT_SMTP_PORT (Standard 465), SUPPORT_SMTP_USER, SUPPORT_SMTP_PASS,
//   SUPPORT_SMTP_FROM (Absender, Standard = SUPPORT_SMTP_USER), SUPPORT_SMTP_SECURE ("false" für STARTTLS/Klartext lokal).
// Supabase blockt ausgehend die Ports 25 und 587 – auf gehosteten Projekten Port 465 verwenden.
// Ohne SMTP-Secrets wird die Nachricht nur gespeichert (mail_status = not_configured).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SMTP_HOST = Deno.env.get("SUPPORT_SMTP_HOST");
const SMTP_PORT = Number(Deno.env.get("SUPPORT_SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SUPPORT_SMTP_USER");
const SMTP_PASS = Deno.env.get("SUPPORT_SMTP_PASS");
const SMTP_FROM = Deno.env.get("SUPPORT_SMTP_FROM") ?? SMTP_USER;
const SMTP_SECURE = (Deno.env.get("SUPPORT_SMTP_SECURE") ?? String(SMTP_PORT === 465)) !== "false";

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic"];

const TOPIC_LABELS: Record<string, string> = {
  question: "Frage zur Bedienung",
  problem: "Etwas funktioniert nicht",
  idea: "Idee oder Wunsch",
  other: "Sonstiges",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  coordinator: "Koordination",
  trainer: "Trainer:in",
  platform: "Plattform",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function oneLine(value: unknown, max = 200): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "missing_authorization" }, 401);
  }

  const body = await req.json().catch(() => null);
  const { topic, message, role, context, attachment } = body ?? {};
  if (!topic || !message || !role) {
    return json({ error: "missing_fields" }, 400);
  }

  let attachmentBytes: Uint8Array | null = null;
  let attachmentName: string | null = null;
  let attachmentType: string | null = null;
  if (attachment) {
    attachmentType = String(attachment.type ?? "");
    attachmentName = oneLine(attachment.name, 120) || "bildschirmfoto";
    if (!ALLOWED_IMAGE_TYPES.includes(attachmentType)) {
      return json({ error: "attachment_type" }, 400);
    }
    try {
      const binary = atob(String(attachment.base64 ?? ""));
      attachmentBytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    } catch {
      return json({ error: "attachment_invalid" }, 400);
    }
    if (attachmentBytes.byteLength > MAX_ATTACHMENT_BYTES) {
      return json({ error: "attachment_too_large" }, 400);
    }
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const safeContext = {
    page: oneLine(context?.page, 300),
    userAgent: oneLine(context?.userAgent, 300),
  };

  const submitted = await userClient.rpc("submit_support_message", {
    p_topic: topic,
    p_message: message,
    p_role: role,
    p_context: context ? safeContext : {},
    p_attachment_name: attachmentName,
  });
  if (submitted.error) {
    const known = ["rate_limited", "message_required", "message_too_long", "not_authorized"];
    const code = known.includes(submitted.error.message) ? submitted.error.message : "invalid_input";
    return json({ error: code }, code === "rate_limited" ? 429 : 400);
  }
  const info = submitted.data as {
    id: string;
    sender_email: string;
    sender_name: string | null;
    companies: string[];
  };

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const setStatus = (status: string) =>
    adminClient.from("support_messages").update({ mail_status: status }).eq("id", info.id);

  const { data: recipients } = await adminClient.from("support_recipients").select("email");
  const to = (recipients ?? []).map((r: { email: string }) => r.email);

  if (!SMTP_HOST || !SMTP_FROM || to.length === 0) {
    await setStatus("not_configured");
    return json({ id: info.id, delivered: false });
  }

  const senderName = oneLine(info.sender_name) || info.sender_email;
  const topicLabel = TOPIC_LABELS[topic] ?? oneLine(topic, 40);
  const lines = [
    String(message).trim(),
    "",
    "—",
    `Von: ${senderName} <${info.sender_email}>`,
    `Firma: ${info.companies.length ? info.companies.join(", ") : "–"}`,
    `Rolle: ${ROLE_LABELS[role] ?? oneLine(role, 40)}`,
  ];
  if (context) {
    lines.push(`Seite: ${safeContext.page || "–"}`, `Browser: ${safeContext.userAgent || "–"}`);
  }
  lines.push(`Gesendet: ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`);

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    await transport.sendMail({
      from: { name: "class-y Support", address: SMTP_FROM },
      to,
      replyTo: { name: senderName, address: info.sender_email },
      subject: `[class-y Support] ${topicLabel} von ${senderName}`,
      text: lines.join("\n"),
      attachments: attachmentBytes
        ? [{ filename: attachmentName!, content: attachmentBytes, contentType: attachmentType! }]
        : undefined,
    });
    await setStatus("sent");
    return json({ id: info.id, delivered: true });
  } catch (err) {
    console.error("support mail failed", err);
    await setStatus("failed");
    // Die Nachricht ist gespeichert und im Postfach-Ersatz unter Einstellungen sichtbar.
    return json({ id: info.id, delivered: false });
  }
});
