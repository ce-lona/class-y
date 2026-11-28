import { createClient } from "@/lib/supabase/client";

/** Stufe eines Rechts: darf, darf nicht, darf mit Bestätigung des Company-Admins. */
export type PermissionLevel = "allowed" | "denied" | "approval";

export interface StudioAdminPermissions {
  course_types: PermissionLevel;
  contracts: PermissionLevel;
  /** Nur bei nicht getrennter Abrechnung relevant; kennt kein "approval". */
  billing: Exclude<PermissionLevel, "approval">;
}

export const DEFAULT_STUDIO_ADMIN_PERMISSIONS: StudioAdminPermissions = {
  course_types: "approval",
  contracts: "approval",
  billing: "denied",
};

export async function getStudioAdminPermissions(
  companyId: string,
): Promise<StudioAdminPermissions> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_studio_admin_permissions", {
    target_company_id: companyId,
  });
  if (error) throw error;
  const row = (data as StudioAdminPermissions[] | null)?.[0];
  return row ?? DEFAULT_STUDIO_ADMIN_PERMISSIONS;
}

export async function setStudioAdminPermissions(
  companyId: string,
  permissions: StudioAdminPermissions,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_studio_admin_permissions", {
    target_company_id: companyId,
    p_course_types: permissions.course_types,
    p_contracts: permissions.contracts,
    p_billing: permissions.billing,
  });
  if (error) throw error;
}
