import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompanies, createCompany } from "@/lib/companies";

export function useCompanies() {
  return useQuery({ queryKey: ["companies"], queryFn: getCompanies });
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
