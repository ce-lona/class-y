import { createClient } from "@/lib/supabase/client";

export type SessionStatus = "planned" | "completed" | "cancelled";

export interface TrainerStudio {
  studio_id: string;
  studio_name: string;
  company_id: string;
  company_name: string;
}

export interface TrainerStudioSlot {
  slot_id: string;
  studio_id: string;
  studio_name: string;
  company_id: string;
  company_name: string;
  course_plan_id: string;
  plan_valid_from: string;
  weekday: number;
  start_time: string;
  end_time: string;
  course_type_id: string;
  course_type_name: string;
  scheduled_trainer_id: string;
  scheduled_trainer_name: string;
}

export interface MyCourseSession {
  id: string;
  studio_id: string;
  studio_name: string;
  company_id: string;
  company_name: string;
  course_plan_slot_id: string | null;
  course_type_id: string | null;
  course_type_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  trainer_id: string;
  is_substitution: boolean;
  scheduled_trainer_name: string | null;
  status: SessionStatus;
  notes: string | null;
  logged_at: string;
  locked_at: string | null;
}

export interface LogCourseSessionInput {
  studio_id: string;
  course_plan_slot_id: string | null;
  course_type_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  is_substitution: boolean;
  status: "completed" | "cancelled";
  notes?: string | null;
}

export async function getTrainerStudios(): Promise<TrainerStudio[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_trainer_studios");
  if (error) throw error;
  return (data ?? []) as TrainerStudio[];
}

export async function getTrainerStudioSlots(): Promise<TrainerStudioSlot[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_trainer_studio_slots");
  if (error) throw error;
  return (data ?? []) as TrainerStudioSlot[];
}

export async function getMyCourseSessions(range?: {
  from?: string;
  to?: string;
}): Promise<MyCourseSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_course_sessions", {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
  });
  if (error) throw error;
  return (data ?? []) as MyCourseSession[];
}

export async function logCourseSession(input: LogCourseSessionInput): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw userError ?? new Error("not_authenticated");
  }

  const { error } = await supabase.from("course_sessions").insert({
    studio_id: input.studio_id,
    course_plan_slot_id: input.course_plan_slot_id,
    course_type_id: input.course_type_id,
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time,
    trainer_id: user.id,
    is_substitution: input.is_substitution,
    status: input.status,
    notes: input.notes?.trim() || null,
    logged_by: user.id,
  });
  if (error) throw error;
}

export async function deleteCourseSession(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("course_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}
