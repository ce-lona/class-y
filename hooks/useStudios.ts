import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudios, getStudio, createStudio, updateStudio } from "@/lib/studios";

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

export function useUpdateStudio(id: string, companyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateStudio>[1]) => updateStudio(id, input),
    onSuccess: (studio) => {
      queryClient.setQueryData(["studios", "detail", id], studio);
      queryClient.invalidateQueries({ queryKey: ["studios", "detail", id] });
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ["studios", companyId] });
      }
    },
  });
}
