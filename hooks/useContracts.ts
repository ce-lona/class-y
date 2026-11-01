import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptContract,
  declineContract,
  endContract,
  getCompanyContracts,
  getMyContracts,
  offerContract,
} from "@/lib/contracts";
import { useAuthStore } from "@/store/authStore";

export function useMyContracts() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: ["my-contracts", userId],
    queryFn: getMyContracts,
    enabled: !!userId,
  });
}

export function useRespondToContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? acceptContract(id) : declineContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
    },
  });
}

export function useCompanyContracts(companyId: string | undefined) {
  return useQuery({
    queryKey: ["company-contracts", companyId],
    queryFn: () => getCompanyContracts(companyId!),
    enabled: !!companyId,
  });
}

export function useOfferContract(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: offerContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-contracts", companyId] });
    },
  });
}

export function useEndContract(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: endContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-contracts", companyId] });
    },
  });
}
