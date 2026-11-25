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

export interface PlanSlotDetailed {
  id: string;
  course_plan_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  course_type_id: string;
  course_type_name: string;
  course_type_duration_min: number;
  trainer_id: string;
  trainer_name: string | null;
  trainer_email: string;
}

export interface ActiveCompanyTrainer {
  trainer_id: string;
  full_name: string | null;
  email: string;
}

export interface PublishSlotInput {
  weekday: number;
  start_time: string;
  end_time: string;
  course_type_id: string;
  trainer_id: string;
}

export interface CompanyActiveSlot extends PlanSlotDetailed {
  studio_id: string;
  studio_name: string;
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
  return data as CoursePlan | null;
}

export async function getCoursePlans(studioId: string): Promise<CoursePlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("course_plans")
    .select("*")
    .eq("studio_id", studioId)
    .order("valid_from", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as CoursePlan[];
}

export async function getPlanSlotsDetailed(planId: string): Promise<PlanSlotDetailed[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_plan_slots_detailed", {
    target_plan_id: planId,
  });
  if (error) throw error;
  return (data ?? []) as PlanSlotDetailed[];
}

export async function getCompanyActiveTrainers(
  companyId: string
): Promise<ActiveCompanyTrainer[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_active_trainers", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return (data ?? []) as ActiveCompanyTrainer[];
}

export async function publishCoursePlan(input: {
  studioId: string;
  validFrom: string;
  slots: PublishSlotInput[];
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("publish_course_plan", {
    target_studio_id: input.studioId,
    p_valid_from: input.validFrom,
    p_slots: input.slots,
  });
  if (error) throw error;
  return data as string;
}

export async function getCompanyActiveSlots(
  studios: { id: string; name: string }[]
): Promise<CompanyActiveSlot[]> {
  if (studios.length === 0) return [];
  const supabase = createClient();
  const studioIds = studios.map((s) => s.id);
  const { data: activePlans, error } = await supabase
    .from("course_plans")
    .select("id, studio_id")
    .in("studio_id", studioIds)
    .eq("status", "active");
  if (error) throw error;
  if (!activePlans || activePlans.length === 0) return [];

  const studioNames = new Map(studios.map((s) => [s.id, s.name]));
  const perPlan = await Promise.all(
    activePlans.map(async (plan) => {
      const slots = await getPlanSlotsDetailed(plan.id);
      const studioName = studioNames.get(plan.studio_id) ?? "";
      return slots.map((slot) => ({
        ...slot,
        studio_id: plan.studio_id,
        studio_name: studioName,
      }));
    })
  );

  return perPlan.flat();
}
