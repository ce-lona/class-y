import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStudioAdminPermissions,
  setStudioAdminPermissions,
  type StudioAdminPermissions,
} from "@/lib/studioAdminPermissions";

export function useStudioAdminPermissions(companyId: string | undefined) {
  return useQuery({
    queryKey: ["studio-admin-permissions", companyId],
    queryFn: () => getStudioAdminPermissions(companyId!),
    enabled: !!companyId,
  });
}

export function useSetStudioAdminPermissions(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissions: StudioAdminPermissions) =>
      setStudioAdminPermissions(companyId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-admin-permissions", companyId] });
    },
  });
}
