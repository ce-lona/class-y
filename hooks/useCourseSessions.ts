import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteCourseSession,
  getMyCourseSessions,
  getTrainerStudios,
  getTrainerStudioSlots,
  logCourseSession,
} from "@/lib/courseSessions";

export function useTrainerStudios() {
  return useQuery({
    queryKey: ["trainer", "studios"],
    queryFn: getTrainerStudios,
  });
}

export function useTrainerStudioSlots() {
  return useQuery({
    queryKey: ["trainer", "studio-slots"],
    queryFn: getTrainerStudioSlots,
  });
}

export function useMyCourseSessions(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["course-sessions", "me", range?.from ?? null, range?.to ?? null],
    queryFn: () => getMyCourseSessions(range),
  });
}

export function useLogCourseSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logCourseSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-sessions"] });
    },
  });
}

export function useDeleteCourseSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCourseSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-sessions"] });
    },
  });
}
