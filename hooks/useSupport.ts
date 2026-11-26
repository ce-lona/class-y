import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addSupportRecipient,
  getRecentSupportMessages,
  getSupportRecipients,
  markOnboardingSeen,
  removeSupportRecipient,
  sendSupportMessage,
} from "@/lib/support";
import type { HelpRole } from "@/hooks/useWorkspace";
import type { Profile } from "@/lib/profiles";

export function useSendSupportMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendSupportMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-messages"] });
    },
  });
}

export function useSupportRecipients(enabled = true) {
  return useQuery({
    queryKey: ["support-recipients"],
    queryFn: getSupportRecipients,
    enabled,
  });
}

export function useAddSupportRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addSupportRecipient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support-recipients"] }),
  });
}

export function useRemoveSupportRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeSupportRecipient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support-recipients"] }),
  });
}

export function useRecentSupportMessages(enabled = true) {
  return useQuery({
    queryKey: ["support-messages"],
    queryFn: () => getRecentSupportMessages(),
    enabled,
  });
}

export function useMarkOnboardingSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: HelpRole) => markOnboardingSeen(role),
    onMutate: (role) => {
      // Sofort lokal vermerken, damit der Dialog nicht erneut aufgeht.
      queryClient.setQueryData<Profile>(["profile", "me"], (old) =>
        old ? { ...old, onboarding_seen: [...(old.onboarding_seen ?? []), role] } : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["profile", "me"] }),
  });
}
