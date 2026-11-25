import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelCompanyDeletion,
  deleteUser,
  downloadExport,
  exportCompanyData,
  exportUserData,
  getCompanyPeople,
  scheduleCompanyDeletion,
  type ExportFormat,
} from "@/lib/gdpr";

export function useCompanyPeople(companyId: string) {
  return useQuery({
    queryKey: ["company-people", companyId],
    queryFn: () => getCompanyPeople(companyId),
    enabled: !!companyId,
  });
}

export function useDeleteUser(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-people", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-admins", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-contracts", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-coordinators", companyId] });
    },
  });
}

export function useExportUserData() {
  return useMutation({
    mutationFn: async ({
      userId,
      fileName,
      format,
    }: {
      userId: string;
      fileName: string;
      format: ExportFormat;
    }) => {
      const data = await exportUserData(userId);
      downloadExport(data, fileName, format);
    },
  });
}

export function useExportCompanyData() {
  return useMutation({
    mutationFn: async ({
      companyId,
      fileName,
      format,
    }: {
      companyId: string;
      fileName: string;
      format: ExportFormat;
    }) => {
      const data = await exportCompanyData(companyId);
      downloadExport(data, fileName, format);
    },
  });
}

function useInvalidateCompany(companyId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["companies", companyId] });
    queryClient.invalidateQueries({ queryKey: ["companies"] });
  };
}

export function useScheduleCompanyDeletion(companyId: string) {
  const invalidate = useInvalidateCompany(companyId);
  return useMutation({
    mutationFn: () => scheduleCompanyDeletion(companyId),
    onSuccess: invalidate,
  });
}

export function useCancelCompanyDeletion(companyId: string) {
  const invalidate = useInvalidateCompany(companyId);
  return useMutation({
    mutationFn: () => cancelCompanyDeletion(companyId),
    onSuccess: invalidate,
  });
}
