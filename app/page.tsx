"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, Users, LayoutGrid, Smartphone, Monitor } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
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

  const roleLoading = sessionLoading || (!!session && (platformAdminLoading || companyLoading));

  useEffect(() => {
    if (roleLoading) return;
    if (isPlatformAdmin) {
      router.replace("/companies");
    } else if (company) {
      router.replace("/studios");
    }
  }, [roleLoading, isPlatformAdmin, company, router]);

  if (sessionLoading || (session && roleLoading)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (session) {
    // Eingeloggt, aber keine bekannte Rolle mit eigenem Bereich (z. B. Trainer,
    // noch nicht gebaut) — Weiterleitung oben greift nicht, minimaler Status.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="text-4xl">
          <Logo aria-hidden="true" />
        </div>
        <p className="text-muted-foreground">{session.user.email}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-12">
        <div className="text-xl">
          <Logo aria-hidden="true" />
        </div>
        <div className="flex items-center gap-5">
          <Link href="/login" className="text-sm font-semibold text-muted-foreground">
            {t.auth.login}
          </Link>
          <Link href="/register" className={buttonVariants()}>
            {t.landing.ctaRegister}
          </Link>
        </div>
      </header>

      <section className="px-12 py-24 text-center">
        <p className="mb-5 text-xs font-bold tracking-wide text-accent-foreground uppercase">
          {t.landing.eyebrow}
        </p>
        <h1 className="mx-auto mb-5 max-w-3xl font-heading text-5xl font-extrabold text-balance">
          {t.landing.headline}
        </h1>
        <p className="mx-auto mb-9 max-w-xl text-lg text-muted-foreground">
          {t.landing.subheadline}
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/register" className={buttonVariants({ size: "lg" })}>
            {t.landing.ctaRegister}
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
            {t.auth.login}
          </Link>
        </div>
      </section>

      <section className="border-y border-border bg-card px-12 py-16">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <Smartphone className="mb-3.5 size-[30px] text-primary" strokeWidth={1.75} />
            <h2 className="mb-2 font-heading text-lg font-bold">{t.landing.audienceTrainerTitle}</h2>
            <p className="text-[15px] text-muted-foreground">{t.landing.audienceTrainerText}</p>
          </div>
          <div>
            <Monitor className="mb-3.5 size-[30px] text-primary" strokeWidth={1.75} />
            <h2 className="mb-2 font-heading text-lg font-bold">{t.landing.audienceStudioTitle}</h2>
            <p className="text-[15px] text-muted-foreground">{t.landing.audienceStudioText}</p>
          </div>
        </div>
      </section>

      <section className="px-12 py-18">
        <h2 className="mb-11 text-center font-heading text-2xl font-bold">
          {t.landing.featuresTitle}
        </h2>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6.5">
              <Icon className="mb-3.5 size-6.5 text-primary" strokeWidth={1.75} />
              <h3 className="mb-2 font-heading text-base font-bold">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary px-12 py-16 text-center">
        <h2 className="mb-6 font-heading text-3xl font-extrabold text-primary-foreground">
          {t.landing.ctaFinalTitle}
        </h2>
        <Link
          href="/register"
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          )}
        >
          {t.landing.ctaRegister}
        </Link>
      </section>

      <footer className="flex items-center justify-between border-t border-border bg-card px-12 py-6">
        <div className="text-base text-muted-foreground">
          <Logo aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground">{t.landing.footerCopyright}</p>
      </footer>
    </div>
  );
}
