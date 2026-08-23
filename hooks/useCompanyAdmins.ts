import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompanyAdmins, addCompanyAdmin } from "@/lib/companyAdmins";

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
