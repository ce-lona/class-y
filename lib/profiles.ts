import { createClient } from "@/lib/supabase/client";

export type ProfileCountry = "DE" | "AT" | "CH";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: ProfileCountry;
  kleinunternehmer: boolean;
  /** Rollen, für die der Willkommens-Dialog schon gezeigt wurde. */
  onboarding_seen: string[];
  /** Persönliche Abbestellung der Abrechnungs-Mails (zusätzlich zur Company-Einstellung). */
  mail_document_ready: boolean;
  mail_review_reminder: boolean;
  mail_correction_request: boolean;
  created_at: string;
}

export interface MailPreferences {
  mail_document_ready: boolean;
  mail_review_reminder: boolean;
  mail_correction_request: boolean;
}

export interface UpdateProfileInput {
  full_name: string | null;
  phone: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: ProfileCountry;
  kleinunternehmer: boolean;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getMyProfile(): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw userError ?? new Error("not_authenticated");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw userError ?? new Error("not_authenticated");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: emptyToNull(input.full_name),
      phone: emptyToNull(input.phone),
      street: emptyToNull(input.street),
      house_number: emptyToNull(input.house_number),
      postal_code: emptyToNull(input.postal_code),
      city: emptyToNull(input.city),
      country: input.country,
      kleinunternehmer: input.kleinunternehmer,
    })
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateMyMailPreferences(input: MailPreferences): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw userError ?? new Error("not_authenticated");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      mail_document_ready: input.mail_document_ready,
      mail_review_reminder: input.mail_review_reminder,
      mail_correction_request: input.mail_correction_request,
    })
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}
