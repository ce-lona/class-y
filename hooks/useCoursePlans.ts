import { useQuery } from "@tanstack/react-query";
import { getActiveCoursePlan } from "@/lib/coursePlans";

export function useActiveCoursePlan(studioId: string) {
  return useQuery({
    queryKey: ["course-plans", "active", studioId],
    queryFn: () => getActiveCoursePlan(studioId),
    enabled: !!studioId,
  });
}
