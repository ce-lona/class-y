import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCourseType,
  deleteCourseType,
  deleteCourseTypeAsStudioAdmin,
  getCourseTypes,
  isCourseTypeApproved,
  reviewCourseType,
  saveCourseTypeAsStudioAdmin,
  updateCourseType,
} from "@/lib/courseTypes";

/** `approvedOnly`: unbestätigte Vorschläge ausblenden (Planung, Kurs erfassen). */
export function useCourseTypes(companyId: string, options?: { approvedOnly?: boolean }) {
  const approvedOnly = options?.approvedOnly ?? false;
  return useQuery({
    queryKey: ["course-types", companyId],
    queryFn: () => getCourseTypes(companyId),
    enabled: !!companyId,
    select: approvedOnly ? (types) => types.filter(isCourseTypeApproved) : undefined,
  });
}

export function useCreateCourseType(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; default_duration_min: number; studio_ids?: string[] }) =>
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
      studio_ids,
    }: {
      id: string;
      name: string;
      default_duration_min: number;
      studio_ids?: string[];
    }) => updateCourseType(id, { name, default_duration_min, studio_ids }),
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

export function useSaveCourseTypeAsStudioAdmin(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string | null;
      name: string;
      default_duration_min: number;
      studio_ids: string[];
    }) => saveCourseTypeAsStudioAdmin({ company_id: companyId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-types", companyId] });
      queryClient.invalidateQueries({ queryKey: ["course-plans"] });
    },
  });
}

export function useDeleteCourseTypeAsStudioAdmin(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCourseTypeAsStudioAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-types", companyId] });
    },
  });
}

export function useReviewCourseType(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewCourseType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-types", companyId] });
      queryClient.invalidateQueries({ queryKey: ["course-plans"] });
    },
  });
}
