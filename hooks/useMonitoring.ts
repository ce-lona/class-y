import { useQuery } from "@tanstack/react-query";
import { getCompanyMonitoring } from "@/lib/monitoring";

export function useCompanyMonitoring(params: {
  companyId: string;
  from: string;
  to: string;
  studioId?: string | null;
}) {
  return useQuery({
    queryKey: [
      "monitoring",
      params.companyId,
      params.from,
      params.to,
      params.studioId ?? "all",
    ],
    queryFn: () => getCompanyMonitoring(params),
    enabled: !!params.companyId && !!params.from && !!params.to,
  });
}
