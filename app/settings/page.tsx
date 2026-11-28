"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Palette, Receipt, Shield, SlidersHorizontal } from "lucide-react";
import { CourseTypesConfig } from "@/components/course-types-config";
import { BillingSettingsPanel } from "@/components/billing-settings-panel";
import { StudioAdminPermissionsCard } from "@/components/studio-admin-permissions-card";
import { AppearanceSettingsCard } from "@/components/appearance-settings-card";
import { PlatformSettingsPanel } from "@/components/platform-settings-panel";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useAuthStore } from "@/store/authStore";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios } from "@/hooks/useStudios";
import { useStudioAdminPermissions } from "@/hooks/useStudioAdminPermissions";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: company, isLoading: companyLoading } = useMyCompany();
  const { data: isPlatformAdmin, isLoading: platformLoading } = useIsPlatformAdmin();
  // Plattform-Admins ohne Company (z. B. noch keine angelegt) sehen nur Plattform und Darstellung.
  const tabs = [
    ...(company
      ? ([
          { key: "config", label: t.settings.tabConfig, Icon: SlidersHorizontal },
          { key: "billing", label: t.creditNotes.settingsTab, Icon: Receipt },
        ] as const)
      : []),
    ...(isPlatformAdmin
      ? ([{ key: "platform", label: t.help.platformSettings.tab, Icon: Shield }] as const)
      : []),
    { key: "appearance", label: t.appearance.tab, Icon: Palette } as const,
  ];
  const activeTab = tabs.find((tab) => tab.key === tabParam)?.key ?? tabs[0].key;
  const { data: studios } = useStudios(company?.id ?? "");
  const { data: permissions } = useStudioAdminPermissions(company?.id);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login");
    }
  }, [sessionLoading, session, router]);

  // Einstellungen sind Admin-Konfiguration. Ohne Company- oder Plattform-Rolle → Profil.
  const noAccess = !companyLoading && !platformLoading && !company && !isPlatformAdmin;
  useEffect(() => {
    if (!sessionLoading && session && noAccess) {
      router.replace("/profile");
    }
  }, [sessionLoading, session, noAccess, router]);

  if (sessionLoading || !session || companyLoading || platformLoading || noAccess) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  const isCoordinator = company?.role === "coordinator";
  const courseTypesMode = !isCoordinator
    ? "admin"
    : (permissions?.course_types ?? "approval") === "denied"
      ? "readOnly"
      : "studioAdmin";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
            {t.settings.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.settings.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="inline-flex rounded-xl border border-border bg-card p-1">
            {tabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() =>
                  router.replace(key === "config" ? "/settings" : `/settings?tab=${key}`, {
                    scroll: false,
                  })
                }
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  activeTab === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "appearance" ? (
        <AppearanceSettingsCard />
      ) : activeTab === "platform" ? (
        <PlatformSettingsPanel />
      ) : !company ? null : activeTab === "billing" ? (
        <BillingSettingsPanel company={company} />
      ) : (
        <>
          {isCoordinator && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>{t.settings.coordinatorReadOnly}</p>
            </div>
          )}

          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <CourseTypesConfig
              companyId={company.id}
              studios={studios ?? []}
              mode={courseTypesMode}
            />
          </section>

          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <StudioAdminPermissionsCard companyId={company.id} canEdit={!isCoordinator} />
          </section>
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
