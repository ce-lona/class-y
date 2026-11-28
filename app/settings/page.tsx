"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Info, Layers, Lock, Receipt, Shield, Tag, type LucideIcon } from "lucide-react";
import { CourseTypesConfig } from "@/components/course-types-config";
import {
  BillingSettingsPanel,
  CompanyAddressCard,
} from "@/components/billing-settings-panel";
import { StudioAdminPermissionsCard } from "@/components/studio-admin-permissions-card";
import { StudiosSection } from "@/components/settings/studios-section";
import { CompanyPrivacyPanel } from "@/components/privacy/company-privacy-panel";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useAuthStore } from "@/store/authStore";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios } from "@/hooks/useStudios";
import { useStudioAdminPermissions } from "@/hooks/useStudioAdminPermissions";
import { useBillingSettings } from "@/hooks/useCreditNotes";
import { fillTemplate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

type Section = "company" | "studios" | "courseTypes" | "permissions" | "billing" | "privacy";

// Alte Links (?tab=…) aus Mails, Handbuch und Lesezeichen weiter auflösen.
const legacyTabs: Record<string, Section> = {
  config: "courseTypes",
  billing: "billing",
  appearance: "company",
};

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: company, isLoading: companyLoading } = useMyCompany();
  const { data: isPlatformAdmin, isLoading: platformLoading } = useIsPlatformAdmin();
  const { data: studios } = useStudios(company?.id ?? "");
  const { data: permissions } = useStudioAdminPermissions(company?.id);
  const { data: billingSettings } = useBillingSettings(company?.id);

  const isCoordinator = company?.role === "coordinator";
  const sections: { key: Section; label: string; Icon: LucideIcon }[] = isCoordinator
    ? [
        { key: "studios", label: t.settingsNav.studios, Icon: Building2 },
        { key: "courseTypes", label: t.settingsNav.courseTypes, Icon: Tag },
        { key: "permissions", label: t.settingsNav.permissionsStudioAdmin, Icon: Lock },
      ]
    : [
        { key: "company", label: t.settingsNav.company, Icon: Building2 },
        { key: "studios", label: t.settingsNav.studios, Icon: Layers },
        { key: "courseTypes", label: t.settingsNav.courseTypes, Icon: Tag },
        { key: "permissions", label: t.settingsNav.permissions, Icon: Lock },
        { key: "billing", label: t.settingsNav.billing, Icon: Receipt },
        { key: "privacy", label: t.settingsNav.privacy, Icon: Shield },
      ];

  const tabParam = searchParams.get("tab");
  const requested = (searchParams.get("section") ?? (tabParam ? legacyTabs[tabParam] : null)) as
    | Section
    | null;
  const active = sections.find((s) => s.key === requested)?.key ?? sections[0].key;

  useEffect(() => {
    if (tabParam === "platform") router.replace("/platform-admins");
  }, [tabParam, router]);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace("/login");
  }, [sessionLoading, session, router]);

  // Einstellungen sind Company-Konfiguration. Plattform-Admins ohne Company → Plattform-Übersicht,
  // alle anderen ohne Company-Rolle → Profil.
  const noAccess = !companyLoading && !platformLoading && !company;
  useEffect(() => {
    if (!sessionLoading && session && noAccess) {
      router.replace(isPlatformAdmin ? "/companies" : "/profile");
    }
  }, [sessionLoading, session, noAccess, isPlatformAdmin, router]);

  if (sessionLoading || !session || companyLoading || platformLoading || noAccess || !company) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  const courseTypesMode = !isCoordinator
    ? "admin"
    : (permissions?.course_types ?? "approval") === "denied"
      ? "readOnly"
      : "studioAdmin";

  return (
    <div className="flex w-full max-w-[1480px] flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fillTemplate(t.settingsNav.subtitle, { company: company.name })}
        </p>
      </div>

      <div className="grid items-start gap-6 min-[900px]:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label={t.settingsNav.label}
          className="flex flex-row flex-wrap gap-0.5 min-[900px]:sticky min-[900px]:top-4 min-[900px]:flex-col"
        >
          {sections.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              aria-current={active === key ? "page" : undefined}
              onClick={() => router.replace(`/settings?section=${key}`, { scroll: false })}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14.5px] font-semibold transition-colors",
                active === key
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/75 hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {active === "company" && (
            <CompanyAddressCard company={company} canEdit={billingSettings?.can_edit ?? true} />
          )}
          {active === "studios" && (
            <>
              <StudiosSection />
              {isCoordinator && (
                <p className="text-sm text-muted-foreground">{t.settingsNav.studiosReadOnly}</p>
              )}
            </>
          )}
          {active === "courseTypes" && (
            <>
              {isCoordinator && (
                <div className="flex items-start gap-2.5 rounded-xl border border-border bg-accent/50 px-4 py-3 text-sm text-muted-foreground">
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
            </>
          )}
          {active === "permissions" && (
            <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <StudioAdminPermissionsCard companyId={company.id} canEdit={!isCoordinator} />
            </section>
          )}
          {active === "billing" && <BillingSettingsPanel company={company} />}
          {active === "privacy" && (
            <CompanyPrivacyPanel companyId={company.id} companyName={company.name} />
          )}
        </div>
      </div>
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
