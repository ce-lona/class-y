import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCompanyAdmins,
  addCompanyAdmin,
  getMyCompanies,
  createTestAdmin,
} from "@/lib/companyAdmins";
import { useAuthStore } from "@/store/authStore";
import { useCompanyStore } from "@/store/companyStore";

export function useMyCompanies() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: ["my-companies", userId],
    queryFn: getMyCompanies,
    enabled: !!userId,
  });
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
