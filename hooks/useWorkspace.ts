"use client";

import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useMyCompanies, useMyCompany } from "@/hooks/useCompanyAdmins";
import { useCompanyStore } from "@/store/companyStore";
import { useMyContracts } from "@/hooks/useContracts";

export type WorkspaceRole = "trainer" | "admin" | "platform";
/** Rolle für Rundgang und Handbuch: Admin-Bereich unterscheidet Admin und Koordination. */
export type HelpRole = "trainer" | "admin" | "coordinator" | "platform";

/**
 * Bereich (Trainer, Admin/Studio-Admin, Plattform) aus den vorhandenen Rollen. Es gibt keinen
 * Umschalter mehr: Plattform-Admins sehen Plattform- und Company-Tabs zusammen und wählen die
 * Company oben aus, Company-/Studio-Admins nur bei mehreren Companies. Admin und Trainer:in
 * gleichzeitig ist nicht vorgesehen; die Trainer-Ansicht gibt es nur ohne Admin-Rolle.
 * Gemeinsame Quelle für Navigation, Hilfe-Bereich und Rundgang.
 */
export function useWorkspace() {
  const { data: isPlatformAdmin, isLoading: platformLoading } = useIsPlatformAdmin();
  const { data: myCompany, isLoading: companyLoading } = useMyCompany();
  const { data: myCompanies } = useMyCompanies();
  const selectCompany = useCompanyStore((state) => state.selectCompany);
  const { data: myContracts, isLoading: contractsLoading } = useMyContracts();

  const hasActiveContract = (myContracts ?? []).some((c) => c.status === "active");
  const hasAdminRole = Boolean(myCompany);
  const hasPlatformRole = Boolean(isPlatformAdmin);
  const isCoordinator = myCompany?.role === "coordinator";
  const showTrainerArea = !hasAdminRole && !hasPlatformRole && hasActiveContract;
  const hasNoRole = !hasAdminRole && !hasPlatformRole && !hasActiveContract;

  const activeRole: WorkspaceRole = hasPlatformRole
    ? "platform"
    : hasAdminRole
      ? "admin"
      : "trainer";

  const helpRole: HelpRole | null = hasNoRole
    ? null
    : activeRole === "admin" && isCoordinator
      ? "coordinator"
      : activeRole;

  return {
    activeRole,
    helpRole,
    hasActiveContract,
    hasAdminRole,
    hasPlatformRole,
    hasNoRole,
    showTrainerArea,
    isCoordinator,
    myCompany,
    myCompanies: myCompanies ?? [],
    selectCompany,
    isLoading: platformLoading || companyLoading || contractsLoading,
  };
}
