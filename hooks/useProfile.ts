import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyMailPreferences, updateMyProfile } from "@/lib/profiles";

export function useMyProfile() {
  return useQuery({
    queryKey: ["profile", "me"],
    queryFn: getMyProfile,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(["profile", "me"], profile);
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useUpdateMyMailPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyMailPreferences,
    onSuccess: (profile) => {
      queryClient.setQueryData(["profile", "me"], profile);
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });
}
