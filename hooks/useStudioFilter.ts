"use client";

import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios } from "@/hooks/useStudios";
import { ALL_STUDIOS, useStudioFilterStore } from "@/store/studioFilterStore";
import { t } from "@/i18n/de";

/**
 * Globaler Studio-Filter der gewählten Company (Sidebar). Gilt für Übersicht, Kurse, Kurspläne,
 * Team und Abrechnung. Studio-Admins sehen nur ihre Studios; "all" heißt dann „Meine Studios“.
 */
export function useStudioFilter() {
  const { data: company } = useMyCompany();
  const companyId = company?.id ?? "";
  const { data: allStudios } = useStudios(companyId);
  const stored = useStudioFilterStore((state) => state.byCompany[companyId]);
  const setStudio = useStudioFilterStore((state) => state.setStudio);

  const isCoordinator = company?.role === "coordinator";
  const studios =
    isCoordinator && company?.studio_ids
      ? (allStudios ?? []).filter((s) => company.studio_ids!.includes(s.id))
      : (allStudios ?? []);

  const studioId =
    stored && stored !== ALL_STUDIOS && studios.some((s) => s.id === stored) ? stored : ALL_STUDIOS;
  const studio = studios.find((s) => s.id === studioId) ?? null;

  /** Passt eine Studio-ID zum Filter? (Bei „Alle“ für Studio-Admins nur die eigenen Studios.) */
  function matches(id: string | null | undefined): boolean {
    if (studioId !== ALL_STUDIOS) return id === studioId;
    if (!isCoordinator) return true;
    return !!id && studios.some((s) => s.id === id);
  }

  return {
    companyId,
    studios,
    studioId,
    studio,
    isAll: studioId === ALL_STUDIOS,
    /** Für Datenabfragen: null = alle Studios. */
    queryStudioId: studioId === ALL_STUDIOS ? null : studioId,
    scopeLabel: studio?.name ?? (isCoordinator ? t.studioFilter.myStudios : t.studioFilter.allStudios),
    setStudioId: (id: string) => companyId && setStudio(companyId, id),
    matches,
  };
}
