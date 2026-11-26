import { createClient } from "@/lib/supabase/client";
import type { HelpRole } from "@/hooks/useWorkspace";

export type SupportTopic = "question" | "problem" | "idea" | "other";
export type SupportMailStatus = "pending" | "sent" | "failed" | "not_configured";

export const SUPPORT_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
];
export const SUPPORT_MESSAGE_MAX_LENGTH = 5000;

export interface SendSupportMessageInput {
  topic: SupportTopic;
  message: string;
  role: HelpRole;
  includeTechInfo: boolean;
  attachment: File | null;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function functionError(error: unknown): Promise<Error> {
  if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
    const body = await error.context.json().catch(() => null);
    return new Error(body?.error ?? "generic");
  }
  return error instanceof Error ? error : new Error("generic");
}

export async function sendSupportMessage(
  input: SendSupportMessageInput,
): Promise<{ id: string; delivered: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("send-support-message", {
    body: {
      topic: input.topic,
      message: input.message,
      role: input.role,
      context: input.includeTechInfo
        ? { page: window.location.pathname, userAgent: navigator.userAgent }
        : null,
      attachment: input.attachment
        ? {
            name: input.attachment.name,
            type: input.attachment.type,
            base64: await fileToBase64(input.attachment),
          }
        : null,
    },
  });
  if (error) throw await functionError(error);
  return { id: data.id, delivered: data.delivered };
}

export async function getSupportRecipients(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("support_recipients")
    .select("email")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => r.email as string);
}

export async function addSupportRecipient(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("add_support_recipient", { p_email: email });
  if (error) throw error;
}

export async function removeSupportRecipient(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_support_recipient", { p_email: email });
  if (error) throw error;
}

export interface SupportMessage {
  id: string;
  topic: SupportTopic;
  message: string;
  role: HelpRole;
  attachment_name: string | null;
  mail_status: SupportMailStatus;
  created_at: string;
  sender_email: string | null;
  sender_name: string | null;
}

/** Posteingang für Plattform-Admins (RLS: nur platform_admin sieht fremde Nachrichten). */
export async function getRecentSupportMessages(limit = 20): Promise<SupportMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("support_messages")
    .select("id, topic, message, role, attachment_name, mail_status, created_at, sender_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const ids = [...new Set((data ?? []).map((m) => m.sender_id as string))];
  const { data: people } = ids.length
    ? await supabase.rpc("support_sender_details", { p_user_ids: ids })
    : { data: [] };
  const byId = new Map(
    ((people ?? []) as { id: string; email: string | null; full_name: string | null }[]).map(
      (p) => [p.id, p],
    ),
  );

  return (data ?? []).map((m) => ({
    id: m.id,
    topic: m.topic,
    message: m.message,
    role: m.role,
    attachment_name: m.attachment_name,
    mail_status: m.mail_status,
    created_at: m.created_at,
    sender_email: byId.get(m.sender_id)?.email ?? null,
    sender_name: byId.get(m.sender_id)?.full_name ?? null,
  }));
}

export async function markOnboardingSeen(role: HelpRole): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_onboarding_seen", { p_role: role });
  if (error) throw error;
}
