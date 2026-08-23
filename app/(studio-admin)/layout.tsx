"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, Calendar, Building2, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuthStore } from "@/store/authStore";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { t } from "@/i18n/de";

const navItems = [
  { href: "/monitoring", label: t.studioAdmin.nav.monitoring, icon: LayoutGrid },
  { href: "/plans", label: t.studioAdmin.nav.plans, icon: Calendar },
  { href: "/studios", label: t.studioAdmin.nav.studios, icon: Building2 },
  { href: "/trainers", label: t.studioAdmin.nav.trainers, icon: Users },
];

// Nav-Ziele, die es noch nicht gibt (kommen in späteren Schritten) — sichtbar,
// aber nicht anklickbar.
const enabledHrefs = new Set(["/studios"]);

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
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">{t.studioAdmin.noCompany}</p>
      </div>
    );
  }

  const initials = (session?.user.email ?? "??").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card px-4 py-6">
        <div className="mb-8 px-2 text-xl">
          <Logo aria-hidden="true" />
        </div>

        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const enabled = enabledHrefs.has(item.href);
            const Icon = item.icon;
            const className =
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold " +
              (enabled
                ? "text-foreground/80 hover:bg-muted"
                : "cursor-not-allowed text-muted-foreground/50");

            return enabled ? (
              <Link key={item.href} href={item.href} className={className}>
                <Icon className="size-[18px]" />
                <span>{item.label}</span>
              </Link>
            ) : (
              <span key={item.href} className={className}>
                <Icon className="size-[18px]" />
                <span>{item.label}</span>
              </span>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2.5 border-t border-border pt-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{company.name}</div>
            <div className="text-xs text-muted-foreground">{t.studioAdmin.roleLabel}</div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 p-10">{children}</div>
    </div>
  );
}
