"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  LayoutGrid,
  Lock,
  Monitor,
  Settings,
  Smartphone,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { LegalLinks } from "@/components/legal-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useMyCompanies, useMyCompany } from "@/hooks/useCompanyAdmins";
import { PLATFORM_OVERVIEW_THRESHOLD } from "@/components/app-shell/company-switcher";
import { useMyContracts } from "@/hooks/useContracts";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const features = [
  { icon: Calendar, title: t.landing.feature1Title, text: t.landing.feature1Text },
  { icon: Users, title: t.landing.feature2Title, text: t.landing.feature2Text },
  { icon: LayoutGrid, title: t.landing.feature3Title, text: t.landing.feature3Text },
];

export default function Home() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: isPlatformAdmin, isLoading: platformAdminLoading } = useIsPlatformAdmin();
  const { data: company, isLoading: companyLoading } = useMyCompany();
  const { data: companies } = useMyCompanies();
  const { data: myContracts, isLoading: contractsLoading } = useMyContracts();

  const hasActiveTrainerContract = (myContracts ?? []).some((c) => c.status === "active");
  const roleLoading =
    sessionLoading ||
    (!!session && (platformAdminLoading || companyLoading || contractsLoading));

  useEffect(() => {
    if (roleLoading) return;
    // Plattform-Admins starten ab 20 Companies (oder ohne Company) in der Plattform-Übersicht.
    if (isPlatformAdmin && (!company || (companies?.length ?? 0) >= PLATFORM_OVERVIEW_THRESHOLD)) {
      router.replace("/companies");
    } else if (company) {
      router.replace("/overview");
    } else if (hasActiveTrainerContract) {
      router.replace("/courses");
    }
  }, [roleLoading, isPlatformAdmin, company, companies, hasActiveTrainerContract, router]);

  if (sessionLoading || (session && roleLoading)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (session) {
    // Eingeloggt als Trainer:in ohne eigenen Kurs-Bereich (folgt in Schritt 2c) —
    // direkter Einstieg zu Stammdaten & Vertragsangeboten.
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 text-center shadow-xs">
          <div className="text-3xl">
            <Logo aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-heading text-xl font-extrabold">
              {t.landing.trainerWelcomeTitle}
            </h1>
            <p className="text-sm text-muted-foreground">{session.user.email}</p>
          </div>
          <p className="text-sm text-muted-foreground">{t.landing.trainerWelcomeText}</p>
          <Link href="/profile" className={cn(buttonVariants({ size: "lg" }), "w-full gap-2")}>
            <Settings className="size-4" />
            <span>{t.landing.openSettings}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/95 px-5 backdrop-blur-sm sm:px-12">
        <div className="text-xl">
          <Logo aria-hidden="true" />
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "font-semibold")}
          >
            {t.auth.login}
          </Link>
        </div>
      </header>

      <section className="px-5 py-16 text-center sm:px-12 sm:py-24">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-100/80 px-3.5 py-1 text-xs font-bold tracking-wide text-primary-700 uppercase dark:bg-primary-900/50 dark:text-primary-200">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span>{t.landing.eyebrow}</span>
        </div>
        <h1 className="mx-auto mb-5 max-w-3xl font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">
          {t.landing.headline}
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-base text-muted-foreground sm:mb-9 sm:text-lg">
          {t.landing.subheadline}
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "gap-2 px-6")}>
            <span>{t.auth.login}</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="size-3.5" />
          <span>{t.landing.inviteOnly}</span>
        </p>
      </section>

      <section className="border-y border-border bg-card px-5 py-12 sm:px-12 sm:py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          <div className="rounded-xl border border-border bg-background/60 p-6">
            <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/40">
              <Smartphone className="size-5" strokeWidth={1.75} />
            </div>
            <h2 className="mb-2 font-heading text-lg font-bold">
              {t.landing.audienceTrainerTitle}
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {t.landing.audienceTrainerText}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-6">
            <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/40">
              <Monitor className="size-5" strokeWidth={1.75} />
            </div>
            <h2 className="mb-2 font-heading text-lg font-bold">
              {t.landing.audienceStudioTitle}
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {t.landing.audienceStudioText}
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-12 sm:py-20">
        <h2 className="mb-8 text-center font-heading text-2xl font-extrabold tracking-tight sm:mb-11">
          {t.landing.featuresTitle}
        </h2>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary-300 dark:hover:border-primary-700"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/40">
                <Icon className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="mb-2 font-heading text-base font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary px-5 py-14 text-center sm:px-12 sm:py-16">
        <h2 className="mx-auto mb-6 max-w-xl font-heading text-2xl font-extrabold text-primary-foreground sm:text-3xl">
          {t.landing.ctaFinalTitle}
        </h2>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ size: "lg" }),
            "gap-2 bg-primary-foreground px-6 text-primary hover:bg-primary-foreground/90"
          )}
        >
          <span>{t.auth.login}</span>
          <ArrowRight className="size-4" />
        </Link>
      </section>

      <footer className="flex items-center justify-between border-t border-border bg-card px-5 py-6 sm:px-12">
        <div className="text-base text-muted-foreground">
          <Logo aria-hidden="true" />
        </div>
        <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
          <LegalLinks />
          <p>{t.landing.footerCopyright}</p>
        </div>
      </footer>
    </div>
  );
}
