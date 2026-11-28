"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { t } from "@/i18n/de";

export default function StudioAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: company, isLoading: companyLoading } = useMyCompany();

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login");
    }
  }, [sessionLoading, session, router]);

  if (sessionLoading || companyLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
            <Building2 className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">{t.studioAdmin.noCompany}</p>
        </div>
      </div>
    );
  }

  return <div className="w-full min-w-0 max-w-[1480px] flex-1 px-4 py-6 sm:px-8">{children}</div>;
}
