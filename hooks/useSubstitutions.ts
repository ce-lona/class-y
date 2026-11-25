import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelSubstitutionRequest,
  getCompanyColleagues,
  getMySubstitutions,
  requestSubstitution,
  respondSubstitution,
} from "@/lib/substitutions";

export function useCompanyColleagues(companyId: string) {
  return useQuery({
    queryKey: ["substitutions", "colleagues", companyId],
    queryFn: () => getCompanyColleagues(companyId),
    enabled: !!companyId,
  });
}

export function useMySubstitutions(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["substitutions", "my", range?.from ?? "", range?.to ?? ""],
    queryFn: () => getMySubstitutions(range),
  });
}

export function useRequestSubstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestSubstitution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["substitutions"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring"] });
    },
  });
}

export function useRespondSubstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: respondSubstitution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["substitutions"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring"] });
    },
  });
}

export function useCancelSubstitutionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelSubstitutionRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["substitutions"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring"] });
    },
  });
}
