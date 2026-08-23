import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompanies, getCompany, createCompany } from "@/lib/companies";

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
