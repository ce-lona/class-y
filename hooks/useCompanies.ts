import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompanies, getCompany, createCompany, updateCompanyAddress } from "@/lib/companies";

export function useCompanies() {
  return useQuery({ queryKey: ["companies"], queryFn: getCompanies });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ["companies", id],
    queryFn: () => getCompany(id),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateCompanyAddress(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateCompanyAddress>[1]) => updateCompanyAddress(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["billing-settings", id] });
      queryClient.invalidateQueries({ queryKey: ["my-companies"] });
    },
  });
}
