import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCompanyCoordinators,
  inviteStudioCoordinator,
  updateCoordinatorStudios,
} from "@/lib/coordinators";

export function useCompanyCoordinators(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ["company-coordinators", companyId],
    queryFn: () => getCompanyCoordinators(companyId),
    enabled: !!companyId && enabled,
  });
}

export function useInviteStudioCoordinator(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; studioIds: string[] }) =>
      inviteStudioCoordinator({ companyId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-coordinators", companyId] });
    },
  });
}

export function useUpdateCoordinatorStudios(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; studioIds: string[] }) =>
      updateCoordinatorStudios({ companyId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-coordinators", companyId] });
    },
  });
}
