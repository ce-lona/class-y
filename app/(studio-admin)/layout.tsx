"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, Calendar, Building2, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";
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
  const pathname = usePathname();
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
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-sidebar px-8">
        <div className="flex items-center gap-9">
          <div className="text-xl">
            <Logo aria-hidden="true" />
          </div>

          <nav className="flex items-center gap-0.5">
            {navItems.map((item) => {
              const enabled = enabledHrefs.has(item.href);
              const active = pathname?.startsWith(item.href);
              const Icon = item.icon;
              const className = cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : enabled
                    ? "text-muted-foreground hover:bg-muted"
                    : "cursor-not-allowed text-muted-foreground/50"
              );

              return enabled ? (
                <Link key={item.href} href={item.href} className={className}>
                  <Icon className="size-[17px]" />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span key={item.href} className={className}>
                  <Icon className="size-[17px]" />
                  <span>{item.label}</span>
                </span>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">{company.name}</span>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials}
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            {t.auth.logout}
          </Button>
        </div>
      </header>

      <div className="min-w-0 flex-1 bg-background p-10">{children}</div>
    </div>
  );
}
