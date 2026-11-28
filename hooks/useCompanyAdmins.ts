import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCompanyAdmins,
  addCompanyAdmin,
  getMyCompanies,
  createTestAdmin,
  type ManagedCompany,
} from "@/lib/companyAdmins";
import { getCompanies } from "@/lib/companies";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useAuthStore } from "@/store/authStore";
import { useCompanyStore } from "@/store/companyStore";

/**
 * Companies, die die Person im Admin-Bereich bearbeiten darf. Plattform-Admins dürfen jede
 * Company bearbeiten (RLS/RPCs behandeln sie wie Company-Admins): eigene Companies zuerst,
 * danach alle übrigen nach Name.
 */
export function useMyCompanies() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: isPlatformAdmin, isLoading: platformLoading } = useIsPlatformAdmin();
  const query = useQuery({
    queryKey: ["my-companies", userId, Boolean(isPlatformAdmin)],
    queryFn: async (): Promise<ManagedCompany[]> => {
      const managed = await getMyCompanies();
      if (!isPlatformAdmin) return managed;
      const managedIds = new Set(managed.map((c) => c.id));
      const others = (await getCompanies())
        .filter((c) => !managedIds.has(c.id))
        .map((c) => ({ ...c, role: "company_admin" as const, studio_ids: null }));
      return [...managed, ...others];
    },
    enabled: !!userId && !platformLoading,
  });
  return { ...query, isLoading: query.isLoading || platformLoading };
}

// Gewählte Company im Admin-Bereich (Auswahl oben in der Navigation, wenn jemand in
// mehreren Companies Admin oder Studio-Admin ist); sonst die erste.
export function useMyCompany() {
  const { data: companies, ...rest } = useMyCompanies();
  const selectedId = useCompanyStore((state) => state.selectedCompanyId);
  const selected = companies?.find((c) => c.id === selectedId) ?? companies?.[0];
  return { data: selected, ...rest };
}

export function useCompanyAdmins(companyId: string) {
  return useQuery({
    queryKey: ["company-admins", companyId],
    queryFn: () => getCompanyAdmins(companyId),
    enabled: !!companyId,
  });
}

export function useAddCompanyAdmin(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => addCompanyAdmin(companyId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-admins", companyId] });
    },
  });
}

export function useCreateTestAdmin(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      createTestAdmin(companyId, email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-admins", companyId] });
    },
  });
}
