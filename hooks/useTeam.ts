import { useQuery } from "@tanstack/react-query";
import { getCompanyTeam } from "@/lib/team";

export function useCompanyTeam(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ["company-team", companyId],
    queryFn: () => getCompanyTeam(companyId),
    enabled: !!companyId && enabled,
  });
}
