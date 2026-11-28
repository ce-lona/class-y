import { createClient } from "@/lib/supabase/client";
import type { ContractStatus } from "@/lib/contracts";

export type TeamRole = "company_admin" | "coordinator" | "trainer";

export interface TeamMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: TeamRole;
  studio_ids: string[] | null;
  /** Nur Trainer:innen: Status des neuesten Vertrags. */
  contract_status: ContractStatus | null;
  updated_at: string | null;
}

const ROLE_ORDER: Record<TeamRole, number> = { company_admin: 0, coordinator: 1, trainer: 2 };

/** Standard-Sortierung: Admins, dann Studio-Admins, dann Trainer:innen, je zuletzt geändert zuerst. */
export function sortTeam(members: TeamMember[]): TeamMember[] {
  return [...members].sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      (b.updated_at ?? "").localeCompare(a.updated_at ?? "") ||
      (a.full_name || a.email).localeCompare(b.full_name || b.email, "de"),
  );
}

/** Company-Admins und Plattform-Admins: alle Personen der Company in einer Liste. */
export async function getCompanyTeam(companyId: string): Promise<TeamMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_team", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

/** Setzt beim Anlegen den Namen im Profil, solange die Person selbst noch keinen eingetragen hat. */
export async function setTeamMemberName(input: {
  companyId: string;
  email: string;
  fullName: string;
}): Promise<void> {
  if (!input.fullName.trim()) return;
  const supabase = createClient();
  const { error } = await supabase.rpc("set_team_member_name", {
    target_company_id: input.companyId,
    target_email: input.email,
    p_full_name: input.fullName,
  });
  if (error) throw error;
}
