import { createClient } from "@/lib/supabase/client";

export interface CoursePlan {
  id: string;
  studio_id: string;
  valid_from: string;
  valid_to: string | null;
  status: "active" | "archived";
  created_by: string | null;
  created_at: string;
}

export async function getActiveCoursePlan(studioId: string): Promise<CoursePlan | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_plans")
    .select("*")
    .eq("studio_id", studioId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}
