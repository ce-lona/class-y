import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompanyAdmins, addCompanyAdmin, getMyCompanies } from "@/lib/companyAdmins";
import { useAuthStore } from "@/store/authStore";

export function useMyCompanies() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: ["my-companies", userId],
    queryFn: getMyCompanies,
    enabled: !!userId,
  });
}

// Nimmt die erste Company-Admin-Mitgliedschaft. Mehrere Memberships sind laut
// Datenmodell möglich, ein Company-Switcher ist aber (noch) nicht gebaut.
export function useMyCompany() {
  const { data: companies, ...rest } = useMyCompanies();
  return { data: companies?.[0], ...rest };
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
