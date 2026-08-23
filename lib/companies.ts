import { createClient } from "@/lib/supabase/client";

export interface Company {
  id: string;
  name: string;
  billing_address: string | null;
  created_at: string;
}

export async function getCompanies(): Promise<Company[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createCompany(input: {
  name: string;
  billing_address?: string;
}): Promise<Company> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}
