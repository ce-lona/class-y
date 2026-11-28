"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { t } from "@/i18n/de";

/** Rahmen für Plattform-Seiten: nur Plattform-Admins, sonst zurück zur Startseite. */
export function PlatformPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: isPlatformAdmin, isLoading } = useIsPlatformAdmin();

  useEffect(() => {
    if (!sessionLoading && !session) router.replace("/login");
    else if (!sessionLoading && !isLoading && isPlatformAdmin === false) router.replace("/");
  }, [sessionLoading, session, isLoading, isPlatformAdmin, router]);

  if (sessionLoading || isLoading || !isPlatformAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[1480px] flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
