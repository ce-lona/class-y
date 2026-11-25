import { createClient } from "@/lib/supabase/client";
import type { FunctionsError } from "@supabase/supabase-js";

export interface CompanyCoordinator {
  user_id: string;
  email: string;
  full_name: string | null;
  studio_ids: string[];
}

async function unwrapFunctionError(error: FunctionsError): Promise<never> {
  if ("context" in error && error.context instanceof Response) {
    const body = await error.context.json().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  throw error;
}

export async function getCompanyCoordinators(companyId: string): Promise<CompanyCoordinator[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_coordinators", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return (data ?? []) as CompanyCoordinator[];
}

export async function inviteStudioCoordinator(input: {
  companyId: string;
  email: string;
  studioIds: string[];
}): Promise<{ invited: boolean; userId: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("invite-studio-coordinator", {
    body: {
      company_id: input.companyId,
      email: input.email,
      studio_ids: input.studioIds,
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    },
  });
  if (error) return unwrapFunctionError(error);
  return { invited: Boolean(data.invited), userId: data.user_id };
}

export async function updateCoordinatorStudios(input: {
  companyId: string;
  email: string;
  studioIds: string[];
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_studio_coordinator_studios", {
    target_company_id: input.companyId,
    target_email: input.email,
    p_studio_ids: input.studioIds,
  });
  if (error) throw error;
}
