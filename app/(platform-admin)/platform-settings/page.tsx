"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppearanceSettingsCard } from "@/components/appearance-settings-card";
import { PlatformAdminsCard } from "@/components/platform-admins-card";
import { SupportInbox } from "@/components/help/support-inbox";
import { SupportRecipientsCard } from "@/components/help/support-recipients-card";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { t } from "@/i18n/de";

export default function PlatformSettingsPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: isPlatformAdmin, isLoading: roleLoading, isError } = useIsPlatformAdmin();

  useEffect(() => {
    if (!sessionLoading && !session) router.replace("/login");
  }, [sessionLoading, session, router]);

  if (sessionLoading || !session || roleLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (isError || !isPlatformAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">{t.help.platformSettings.unauthorized}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <div>
        <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
          {t.help.platformSettings.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.help.platformSettings.subtitle}</p>
      </div>
      <PlatformAdminsCard />
      <SupportRecipientsCard />
      <SupportInbox />
      <AppearanceSettingsCard />
    </div>
  );
}
