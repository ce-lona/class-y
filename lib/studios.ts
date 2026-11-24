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

export async function updateStudio(
  id: string,
  input: {
    name: string;
    street?: string;
    house_number?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  }
): Promise<Studio> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("studios")
    .update({
      name: input.name.trim(),
      street: input.street?.trim() || null,
      house_number: input.house_number?.trim() || null,
      postal_code: input.postal_code?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country ?? "DE",
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
