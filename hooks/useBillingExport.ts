import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import {
  getBillingExport,
  getMyBillingCompanies,
  type BillingScope,
} from "@/lib/billingExport";

export function useBillingExport(params: { companyId: string; month: string; scope: BillingScope }) {
  return useQuery({
    queryKey: ["billing-export", params.scope, params.companyId, params.month],
    queryFn: () => getBillingExport(params),
    enabled: !!params.companyId && !!params.month,
  });
}

export function useMyBillingCompanies() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: ["my-billing-companies", userId],
    queryFn: getMyBillingCompanies,
    enabled: !!userId,
  });
}
