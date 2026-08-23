import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudios, createStudio } from "@/lib/studios";

export function useStudios(companyId: string) {
  return useQuery({
    queryKey: ["studios", companyId],
    queryFn: () => getStudios(companyId),
    enabled: !!companyId,
  });
}

export function useCreateStudio(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStudio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studios", companyId] });
    },
  });
}
