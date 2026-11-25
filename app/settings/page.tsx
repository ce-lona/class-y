"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, SlidersHorizontal, User } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CourseTypesConfig } from "@/components/course-types-config";
import { useAuthStore } from "@/store/authStore";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios } from "@/hooks/useStudios";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

function SettingsContent() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: company, isLoading: companyLoading } = useMyCompany();
  const { data: studios } = useStudios(company?.id ?? "");

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login");
    }
  }, [sessionLoading, session, router]);

  // Einstellungen sind reine Admin-Konfiguration. Ohne Company-Rolle → Profil.
  useEffect(() => {
    if (!sessionLoading && session && !companyLoading && !company) {
      router.replace("/profile");
    }
  }, [sessionLoading, session, companyLoading, company, router]);

  if (sessionLoading || !session || companyLoading || !company) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  const isCoordinator = company.role === "coordinator";

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
            <button
              type="button"
              role="tab"
              aria-selected
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
            >
              <SlidersHorizontal className="size-4" />
              <span>{t.settings.tabConfig}</span>
            </button>
          </div>
          <Link
            href="/profile"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <User className="size-3.5" />
            <span>{t.profilePage.openProfile}</span>
          </Link>
        </div>
      </div>

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
          canEdit={!isCoordinator}
        />
      </section>
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
