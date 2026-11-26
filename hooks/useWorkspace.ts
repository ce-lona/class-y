"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
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

  const availableRoles: { id: WorkspaceRole; label: string; home: string }[] = [];
  if (hasActiveContract) {
    availableRoles.push({ id: "trainer", label: t.nav.roleTrainer, home: "/courses" });
  }
  if (hasAdminRole && myCompany) {
    const rolePrefix = isCoordinator ? t.nav.roleCoordinator : t.nav.roleAdmin;
    availableRoles.push({
      id: "admin",
      label: `${rolePrefix} · ${myCompany.name}`,
      home: "/monitoring",
    });
  }
  if (hasPlatformRole) {
    availableRoles.push({ id: "platform", label: t.nav.rolePlatform, home: "/companies" });
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

  function rememberWorkspace(role: WorkspaceRole) {
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
