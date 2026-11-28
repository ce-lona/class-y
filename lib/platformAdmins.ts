import { createClient } from "@/lib/supabase/client";

export interface PlatformAdmin {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export async function getPlatformAdmins(): Promise<PlatformAdmin[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_platform_admins");
  if (error) throw error;
  return (data ?? []) as PlatformAdmin[];
}

/** Trägt eine Person als Plattform-Admin ein und lädt sie ein, falls sie noch kein Konto hat. */
export async function addPlatformAdmin(email: string): Promise<{ invited: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("invite-platform-admin", {
    body: {
      email: email.trim(),
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    },
  });
  if (error) {
    if ("context" in error && error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error ?? error.message);
    }
    throw error;
  }
  return { invited: Boolean(data?.invited) };
}

export async function removePlatformAdmin(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_platform_admin", { target_user_id: userId });
  if (error) throw error;
}
