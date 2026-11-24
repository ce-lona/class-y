import { createClient } from "@/lib/supabase/client";

export interface CourseType {
  id: string;
  company_id: string;
  name: string;
  default_duration_min: number;
}

export async function getCourseTypes(companyId: string): Promise<CourseType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_types")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data as CourseType[];
}

export async function createCourseType(input: {
  company_id: string;
  name: string;
  default_duration_min: number;
}): Promise<CourseType> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_types")
    .insert({
      company_id: input.company_id,
      name: input.name.trim(),
      default_duration_min: input.default_duration_min,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CourseType;
}

export async function updateCourseType(
  id: string,
  input: { name: string; default_duration_min: number }
): Promise<CourseType> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_types")
    .update({
      name: input.name.trim(),
      default_duration_min: input.default_duration_min,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CourseType;
}

export async function deleteCourseType(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("course_types").delete().eq("id", id);
  if (error) throw error;
}
