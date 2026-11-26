import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptContractWithMasterData,
  approveBillingDocument,
  commentBillingDocument,
  confirmContract,
  getBillingComments,
  getBillingDocuments,
  getBillingPreview,
  getBillingSettings,
  getMyBillingDetails,
  getMyBillingDocuments,
  issueBillingDocuments,
  resolveBillingComment,
  saveBillingSettings,
  saveMyBillingDetails,
  type BillingSettingsInput,
  type MyBillingDetails,
} from "@/lib/creditNotes";
import { useAuthStore } from "@/store/authStore";

export function useBillingSettings(companyId: string | undefined) {
  return useQuery({
    queryKey: ["billing-settings", companyId],
    queryFn: () => getBillingSettings(companyId!),
    enabled: !!companyId,
  });
}

export function useSaveBillingSettings(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BillingSettingsInput) => saveBillingSettings(companyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["billing-preview", companyId] });
    },
  });
}

export function useBillingPreview(params: {
  companyId: string | undefined;
  month: string;
  studioId: string | null;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["billing-preview", params.companyId, params.month, params.studioId],
    queryFn: () =>
      getBillingPreview({ companyId: params.companyId!, month: params.month, studioId: params.studioId }),
    enabled: !!params.companyId && params.enabled,
  });
}

export function useBillingDocuments(companyId: string | undefined, month: string) {
  return useQuery({
    queryKey: ["billing-documents", companyId, month],
    queryFn: () => getBillingDocuments(companyId!, month),
    enabled: !!companyId,
  });
}

export function useBillingComments(companyId: string | undefined, month: string) {
  return useQuery({
    queryKey: ["billing-comments", companyId, month],
    queryFn: () => getBillingComments(companyId!, month),
    enabled: !!companyId,
  });
}

function invalidateBilling(queryClient: ReturnType<typeof useQueryClient>, companyId: string) {
  queryClient.invalidateQueries({ queryKey: ["billing-preview", companyId] });
  queryClient.invalidateQueries({ queryKey: ["billing-documents", companyId] });
  queryClient.invalidateQueries({ queryKey: ["billing-comments", companyId] });
}

export function useIssueBillingDocuments(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { month: string; studioId: string | null }) =>
      issueBillingDocuments({ companyId, ...params }),
    onSuccess: () => invalidateBilling(queryClient, companyId),
  });
}

export function useResolveBillingComment(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resolveBillingComment,
    onSuccess: () => invalidateBilling(queryClient, companyId),
  });
}

export function useMyBillingDocuments() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: ["my-billing-documents", userId],
    queryFn: getMyBillingDocuments,
    enabled: !!userId,
  });
}

export function useApproveBillingDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveBillingDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-billing-documents"] }),
  });
}

export function useCommentBillingDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => commentBillingDocument(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-billing-documents"] }),
  });
}

export function useMyBillingDetails() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: ["my-billing-details", userId],
    queryFn: getMyBillingDetails,
    enabled: !!userId,
  });
}

export function useSaveMyBillingDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MyBillingDetails) => saveMyBillingDetails(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-billing-details"] });
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
    },
  });
}

export function useAcceptContractWithMasterData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptContractWithMasterData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      queryClient.invalidateQueries({ queryKey: ["my-billing-details"] });
    },
  });
}

export function useConfirmContract(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-contracts", companyId] });
      queryClient.invalidateQueries({ queryKey: ["billing-preview", companyId] });
    },
  });
}
