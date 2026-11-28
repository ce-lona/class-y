import { createClient } from "@/lib/supabase/client";

export interface CourseType {
  id: string;
  company_id: string;
  name: string;
  default_duration_min: number;
  /** Leeres Array = company-weit in allen Studios verfügbar. */
  studio_ids: string[];
  /** Vorschläge von Studio-Admins sind erst nach Bestätigung durch den Company-Admin nutzbar. */
  approval_status?: "approved" | "pending_approval";
  /** Vorgeschlagene Änderung an einem bestätigten Kurstyp (wartet auf Bestätigung). */
  pending_change?: CourseTypePendingChange | null;
}

export type CourseTypePendingChange =
  | { delete: true }
  | { name: string; default_duration_min: number; studio_ids: string[] };

export function isCourseTypeApproved(courseType: Pick<CourseType, "approval_status">): boolean {
  return (courseType.approval_status ?? "approved") === "approved";
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
  approval_status?: "approved" | "pending_approval";
  pending_change?: CourseTypePendingChange | null;
  course_type_studios?: { studio_id: string }[] | null;
}

function mapCourseType(row: RawCourseTypeRow): CourseType {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    default_duration_min: row.default_duration_min,
    studio_ids: (row.course_type_studios ?? []).map((entry) => entry.studio_id),
    approval_status: row.approval_status ?? "approved",
    pending_change: row.pending_change ?? null,
  };
}

export async function getCourseTypes(companyId: string): Promise<CourseType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_types")
    .select(
      "id, company_id, name, default_duration_min, approval_status, pending_change, course_type_studios(studio_id)"
    )
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

/**
 * Studio-Admin: Kurstyp der eigenen Studios anlegen oder ändern. Je nach Recht wird direkt
 * gespeichert oder ein Vorschlag angelegt, den der Company-Admin bestätigt (`pending`).
 */
export async function saveCourseTypeAsStudioAdmin(input: {
  company_id: string;
  id?: string | null;
  name: string;
  default_duration_min: number;
  studio_ids: string[];
}): Promise<{ id: string; pending: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("studio_admin_save_course_type", {
    target_company_id: input.company_id,
    p_course_type_id: input.id ?? null,
    p_name: input.name.trim(),
    p_default_duration_min: input.default_duration_min,
    p_studio_ids: input.studio_ids,
  });
  if (error) throw error;
  const row = (data as { id: string; pending: boolean }[] | null)?.[0];
  return { id: row?.id ?? input.id ?? "", pending: Boolean(row?.pending) };
}

/** Studio-Admin: Kurstyp löschen. `false` = Löschung wartet auf Bestätigung. */
export async function deleteCourseTypeAsStudioAdmin(id: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("studio_admin_delete_course_type", {
    p_course_type_id: id,
  });
  if (error) throw error;
  return Boolean(data);
}

/** Company-Admin: Vorschlag eines Studio-Admins bestätigen oder verwerfen. */
export async function reviewCourseType(input: { id: string; approve: boolean }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("review_course_type", {
    p_course_type_id: input.id,
    p_approve: input.approve,
  });
  if (error) throw error;
}
