import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getActiveCoursePlan,
  getCompanyActiveSlots,
  getCompanyActiveTrainers,
  getCoursePlans,
  getPlanSlotsDetailed,
  publishCoursePlan,
} from "@/lib/coursePlans";

export function useActiveCoursePlan(studioId: string) {
  return useQuery({
    queryKey: ["course-plans", "active", studioId],
    queryFn: () => getActiveCoursePlan(studioId),
    enabled: !!studioId,
  });
}

export function useCoursePlans(studioId: string) {
  return useQuery({
    queryKey: ["course-plans", "list", studioId],
    queryFn: () => getCoursePlans(studioId),
    enabled: !!studioId,
  });
}

export function usePlanSlots(planId: string | null | undefined) {
  return useQuery({
    queryKey: ["course-plans", "slots", planId],
    queryFn: () => getPlanSlotsDetailed(planId!),
    enabled: !!planId,
  });
}

export function useCompanyActiveTrainers(companyId: string) {
  return useQuery({
    queryKey: ["course-plans", "active-trainers", companyId],
    queryFn: () => getCompanyActiveTrainers(companyId),
    enabled: !!companyId,
  });
}

export function useCompanyActiveSlots(
  companyId: string,
  studios: { id: string; name: string }[]
) {
  const studioKey = studios.map((s) => s.id).join(",");
  return useQuery({
    queryKey: ["course-plans", "company-active-slots", companyId, studioKey],
    queryFn: () => getCompanyActiveSlots(studios),
    enabled: !!companyId && studios.length > 0,
  });
}

export function usePublishCoursePlan(studioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      validFrom: string;
      slots: Parameters<typeof publishCoursePlan>[0]["slots"];
    }) => publishCoursePlan({ studioId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-plans"] });
    },
  });
}
