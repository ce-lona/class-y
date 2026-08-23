import { createClient } from "@/lib/supabase/client";

export interface Studio {
  id: string;
  company_id: string;
  name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  created_at: string;
}

export async function getStudios(companyId: string): Promise<Studio[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("studios")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getStudio(id: string): Promise<Studio> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("studios")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createStudio(input: {
  company_id: string;
  name: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}): Promise<Studio> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("studios")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}
