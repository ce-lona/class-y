import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCourseType,
  deleteCourseType,
  getCourseTypes,
  updateCourseType,
} from "@/lib/courseTypes";

export function useCourseTypes(companyId: string) {
  return useQuery({
    queryKey: ["course-types", companyId],
    queryFn: () => getCourseTypes(companyId),
    enabled: !!companyId,
  });
}

export function useCreateCourseType(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; default_duration_min: number }) =>
      createCourseType({ company_id: companyId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-types", companyId] });
    },
  });
}

export function useUpdateCourseType(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      default_duration_min,
    }: {
      id: string;
      name: string;
      default_duration_min: number;
    }) => updateCourseType(id, { name, default_duration_min }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-types", companyId] });
      queryClient.invalidateQueries({ queryKey: ["course-plans"] });
    },
  });
}

export function useDeleteCourseType(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCourseType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-types", companyId] });
    },
  });
}
