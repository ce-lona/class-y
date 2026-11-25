import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/companies";
import type { FunctionsError } from "@supabase/supabase-js";

async function unwrapFunctionError(error: FunctionsError): Promise<never> {
  if ("context" in error && error.context instanceof Response) {
    const body = await error.context.json().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  throw error;
}

export type ManagedCompanyRole = "company_admin" | "coordinator";

export interface ManagedCompany extends Company {
  role: ManagedCompanyRole;
  /** NULL für Company-Admins (alle Studios); Array zugewiesener Studio-IDs für Kurskoordinatoren. */
  studio_ids: string[] | null;
}

export async function getMyCompanies(): Promise<ManagedCompany[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_my_managed_companies");
  if (error) throw error;
  return (data ?? []) as ManagedCompany[];
}

export interface CompanyAdmin {
  user_id: string;
  email: string;
  full_name: string | null;
}

export async function getCompanyAdmins(companyId: string): Promise<CompanyAdmin[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_admins", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return data;
}

export async function addCompanyAdmin(
  companyId: string,
  email: string,
): Promise<{ invited: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("invite-company-admin", {
    body: {
      company_id: companyId,
      email,
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    },
  });

  if (error) return unwrapFunctionError(error);

  return data;
}

// Dev-Hilfsfunktion für Testkonten ohne echten E-Mail-Versand (siehe
// supabase/functions/create-test-admin) — nicht für echte Einladungen.
export async function createTestAdmin(
  companyId: string,
  email: string,
  password: string,
): Promise<{ user_id: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("create-test-admin", {
    body: { company_id: companyId, email, password },
  });

  if (error) return unwrapFunctionError(error);

  return data;
}
