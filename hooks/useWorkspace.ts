"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useMyCompanies, useMyCompany } from "@/hooks/useCompanyAdmins";
import { useCompanyStore } from "@/store/companyStore";
import { useMyContracts } from "@/hooks/useContracts";
import { t } from "@/i18n/de";

export type WorkspaceRole = "trainer" | "admin" | "platform";
/** Rolle für Rundgang und Handbuch: Admin-Bereich unterscheidet Admin und Koordination. */
export type HelpRole = "trainer" | "admin" | "coordinator" | "platform";

export const WORKSPACE_STORAGE_KEY = "class-y:workspace-role";

export const adminPrefixes = [
  "/monitoring",
  "/billing",
  "/plans",
  "/studios",
  "/trainers",
  "/privacy",
  "/settings",
];

export function routeWorkspace(pathname: string | null): WorkspaceRole | null {
  if (!pathname) return null;
  if (pathname.startsWith("/courses")) return "trainer";
  if (pathname.startsWith("/companies") || pathname.startsWith("/platform-settings")) {
    return "platform";
  }
  if (adminPrefixes.some((p) => pathname.startsWith(p))) return "admin";
  return null;
}

function readStoredWorkspace(): WorkspaceRole | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (stored === "trainer" || stored === "admin" || stored === "platform") {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

/**
 * Aktive Ansicht (Trainer, Admin/Koordination, Plattform) aus Route, zuletzt gewählter Ansicht
 * und vorhandenen Rollen. Gemeinsame Quelle für Navigation, Hilfe-Bereich und Rundgang.
 */
export function useWorkspace() {
  const pathname = usePathname();
  const { data: isPlatformAdmin, isLoading: platformLoading } = useIsPlatformAdmin();
  const { data: myCompany, isLoading: companyLoading } = useMyCompany();
  const { data: myCompanies } = useMyCompanies();
  const selectCompany = useCompanyStore((state) => state.selectCompany);
  const { data: myContracts, isLoading: contractsLoading } = useMyContracts();

  const [lastWorkspace, setLastWorkspace] = useState<WorkspaceRole | null>(readStoredWorkspace);
  const fromRoute = routeWorkspace(pathname);

  useEffect(() => {
    if (!fromRoute) return;
    try {
      window.sessionStorage.setItem(WORKSPACE_STORAGE_KEY, fromRoute);
    } catch {
      // ignore storage errors
    }
  }, [fromRoute]);

  const hasActiveContract = (myContracts ?? []).some((c) => c.status === "active");
  const hasAdminRole = Boolean(myCompany);
  const hasPlatformRole = Boolean(isPlatformAdmin);
  const isCoordinator = myCompany?.role === "coordinator";

  // Bei mehreren Companies (Admin oder Studio-Admin) gibt es je Company einen Eintrag.
  const availableRoles: {
    id: WorkspaceRole;
    key: string;
    label: string;
    home: string;
    companyId?: string;
  }[] = [];
  if (hasActiveContract) {
    availableRoles.push({ id: "trainer", key: "trainer", label: t.nav.roleTrainer, home: "/courses" });
  }
  if (hasAdminRole && myCompany) {
    for (const company of myCompanies ?? [myCompany]) {
      const rolePrefix = company.role === "coordinator" ? t.nav.roleCoordinator : t.nav.roleAdmin;
      availableRoles.push({
        id: "admin",
        key: `admin:${company.id}`,
        label: `${rolePrefix} · ${company.name}`,
        home: "/monitoring",
        companyId: company.id,
      });
    }
  }
  if (hasPlatformRole) {
    availableRoles.push({
      id: "platform",
      key: "platform",
      label: t.nav.rolePlatform,
      home: "/companies",
    });
  }

  const defaultRole: WorkspaceRole = hasAdminRole
    ? "admin"
    : hasActiveContract
      ? "trainer"
      : "platform";

  const candidateRole = fromRoute ?? lastWorkspace ?? defaultRole;
  const activeRole: WorkspaceRole = availableRoles.some((r) => r.id === candidateRole)
    ? candidateRole
    : availableRoles[0]?.id ?? defaultRole;

  const helpRole: HelpRole | null =
    availableRoles.length === 0
      ? null
      : activeRole === "admin"
        ? isCoordinator
          ? "coordinator"
          : "admin"
        : activeRole;

  function rememberWorkspace(role: WorkspaceRole, companyId?: string) {
    if (companyId) selectCompany(companyId);
    try {
      window.sessionStorage.setItem(WORKSPACE_STORAGE_KEY, role);
    } catch {
      // ignore
    }
    setLastWorkspace(role);
  }

  return {
    activeRole,
    helpRole,
    availableRoles,
    hasActiveContract,
    hasAdminRole,
    hasPlatformRole,
    isCoordinator,
    myCompany,
    rememberWorkspace,
    isLoading: platformLoading || companyLoading || contractsLoading,
  };
}
