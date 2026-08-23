import { createClient } from "@/lib/supabase/client";

export interface Company {
  id: string;
  name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
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

export async function getCompany(id: string): Promise<Company> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCompany(input: {
  name: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  country?: string;
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
