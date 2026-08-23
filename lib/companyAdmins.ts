import { createClient } from "@/lib/supabase/client";

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

export async function addCompanyAdmin(companyId: string, email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("add_company_admin", {
    target_company_id: companyId,
    target_email: email,
  });
  if (error) throw error;
}
