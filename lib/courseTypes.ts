import { createClient } from "@/lib/supabase/client";

export interface CourseType {
  id: string;
  company_id: string;
  name: string;
  default_duration_min: number;
  /** Leeres Array = company-weit in allen Studios verfügbar. */
  studio_ids: string[];
}

export function isCourseTypeAvailableInStudio(
  courseType: Pick<CourseType, "studio_ids">,
  studioId: string | null | undefined
): boolean {
  if (!studioId || courseType.studio_ids.length === 0) return true;
  return courseType.studio_ids.includes(studioId);
}

interface RawCourseTypeRow {
  id: string;
  company_id: string;
  name: string;
  default_duration_min: number;
  course_type_studios?: { studio_id: string }[] | null;
}

function mapCourseType(row: RawCourseTypeRow): CourseType {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    default_duration_min: row.default_duration_min,
    studio_ids: (row.course_type_studios ?? []).map((entry) => entry.studio_id),
  };
}

export async function getCourseTypes(companyId: string): Promise<CourseType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_types")
    .select("id, company_id, name, default_duration_min, course_type_studios(studio_id)")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return ((data ?? []) as RawCourseTypeRow[]).map(mapCourseType);
}

export async function createCourseType(input: {
  company_id: string;
  name: string;
  default_duration_min: number;
  studio_ids?: string[];
}): Promise<CourseType> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_types")
    .insert({
      company_id: input.company_id,
      name: input.name.trim(),
      default_duration_min: input.default_duration_min,
    })
    .select("id, company_id, name, default_duration_min")
    .single();
  if (error) throw error;

  const studioIds = input.studio_ids ?? [];
  if (studioIds.length > 0) {
    const { error: scopeError } = await supabase.rpc("set_course_type_studios", {
      p_course_type_id: data.id,
      p_studio_ids: studioIds,
    });
    if (scopeError) throw scopeError;
  }

  return {
    ...(data as Omit<CourseType, "studio_ids">),
    studio_ids: studioIds,
  };
}

export async function updateCourseType(
  id: string,
  input: { name: string; default_duration_min: number; studio_ids?: string[] }
): Promise<CourseType> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_types")
    .update({
      name: input.name.trim(),
      default_duration_min: input.default_duration_min,
    })
    .eq("id", id)
    .select("id, company_id, name, default_duration_min")
    .single();
  if (error) throw error;

  if (input.studio_ids !== undefined) {
    const { error: scopeError } = await supabase.rpc("set_course_type_studios", {
      p_course_type_id: id,
      p_studio_ids: input.studio_ids,
    });
    if (scopeError) throw scopeError;
  }

  return {
    ...(data as Omit<CourseType, "studio_ids">),
    studio_ids: input.studio_ids ?? [],
  };
}

export async function deleteCourseType(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("course_types").delete().eq("id", id);
  if (error) throw error;
}
