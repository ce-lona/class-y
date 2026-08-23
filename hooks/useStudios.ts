import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudios, getStudio, createStudio } from "@/lib/studios";

export function useStudios(companyId: string) {
  return useQuery({
    queryKey: ["studios", companyId],
    queryFn: () => getStudios(companyId),
    enabled: !!companyId,
  });
}

export function useStudio(id: string) {
  return useQuery({
    queryKey: ["studios", "detail", id],
    queryFn: () => getStudio(id),
    enabled: !!id,
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
