import { createClient } from "@/lib/supabase/client";

export type SubstitutionStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface CompanyColleague {
  trainer_id: string;
  display_name: string;
}

export interface MySubstitution {
  id: string;
  course_plan_slot_id: string;
  date: string;
  studio_id: string;
  studio_name: string;
  company_id: string;
  company_name: string;
  weekday: number;
  start_time: string;
  end_time: string;
  course_type_id: string;
  course_type_name: string;
  original_trainer_id: string;
  original_trainer_name: string;
  substitute_trainer_id: string;
  substitute_trainer_name: string;
  status: SubstitutionStatus;
  notes: string | null;
  direction: "incoming" | "outgoing";
  created_at: string;
}

export async function getCompanyColleagues(companyId: string): Promise<CompanyColleague[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_colleagues", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return (data ?? []) as CompanyColleague[];
}

export async function getMySubstitutions(range?: {
  from?: string;
  to?: string;
}): Promise<MySubstitution[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_substitutions", {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
  });
  if (error) throw error;
  return (data ?? []) as MySubstitution[];
}

export async function requestSubstitution(input: {
  slotId: string;
  date: string;
  substituteTrainerId: string;
  notes?: string | null;
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("request_substitution", {
    p_slot_id: input.slotId,
    p_date: input.date,
    p_substitute_trainer_id: input.substituteTrainerId,
    p_notes: input.notes?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}

export async function respondSubstitution(input: {
  assignmentId: string;
  decision: "accepted" | "declined";
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("respond_substitution", {
    p_assignment_id: input.assignmentId,
    p_decision: input.decision,
  });
  if (error) throw error;
}

export async function cancelSubstitutionRequest(assignmentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_substitution_request", {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
}
