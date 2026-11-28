import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addPlatformAdmin, getPlatformAdmins, removePlatformAdmin } from "@/lib/platformAdmins";

export function usePlatformAdmins(enabled = true) {
  return useQuery({
    queryKey: ["platform-admins"],
    queryFn: getPlatformAdmins,
    enabled,
  });
}

export function useAddPlatformAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addPlatformAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
    },
  });
}

export function useRemovePlatformAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removePlatformAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
    },
  });
}
