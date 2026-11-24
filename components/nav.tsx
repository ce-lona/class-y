"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calendar,
  CalendarCheck,
  LayoutGrid,
  LogOut,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useMyContracts } from "@/hooks/useContracts";
import { useMyProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const authPrefixes = ["/login", "/forgot-password", "/reset-password", "/auth"];

const studioNavItems = [
  { href: "/monitoring", label: t.studioAdmin.nav.monitoring, icon: LayoutGrid, enabled: false },
  { href: "/plans", label: t.studioAdmin.nav.plans, icon: Calendar, enabled: true },
  { href: "/studios", label: t.studioAdmin.nav.studios, icon: Building2, enabled: true },
  { href: "/trainers", label: t.studioAdmin.nav.trainers, icon: Users, enabled: true },
] as const;

export function Nav() {
  const pathname = usePathname();
  const session = useAuthStore((state) => state.session);
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { data: myCompany } = useMyCompany();
  const { data: myContracts } = useMyContracts();
  const { data: profile } = useMyProfile();

  if (!session) return null;
  if (authPrefixes.some((prefix) => pathname?.startsWith(prefix))) {
    return null;
  }

  const hasActiveContract = (myContracts ?? []).some((c) => c.status === "active");
  const initials = getInitials(profile?.full_name, session.user.email);

  const linkClass = (active: boolean, enabled = true) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors lg:px-3",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : enabled
          ? "text-muted-foreground hover:bg-muted hover:text-foreground"
          : "cursor-not-allowed text-muted-foreground/45"
    );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-sidebar/95 backdrop-blur-sm">
      <div className="grid w-full grid-cols-[auto_1fr] items-center gap-y-0 px-4 sm:px-8 md:flex md:h-16 md:justify-between md:gap-4">
        <div className="flex h-14 items-center gap-6 md:h-auto md:shrink-0">
          <Link href="/" className="text-xl">
            <Logo aria-hidden="true" />
            <span className="sr-only">{t.common.appName}</span>
          </Link>
        </div>

        <nav
          aria-label="Hauptnavigation"
          className="col-span-2 order-3 -mx-4 flex items-center gap-0.5 overflow-x-auto border-t border-border/70 px-4 py-2 sm:-mx-8 sm:px-8 md:order-2 md:mx-0 md:flex-1 md:border-t-0 md:px-2 md:py-0"
        >
          {hasActiveContract && (
            <Link
              href="/courses"
              className={linkClass(!!pathname?.startsWith("/courses"), true)}
            >
              <CalendarCheck className="size-4 shrink-0" />
              <span>{t.trainer.navMyCourses}</span>
            </Link>
          )}

          {myCompany &&
            studioNavItems.map((item) => {
              const active = !!pathname?.startsWith(item.href);
              const Icon = item.icon;
              return item.enabled ? (
                <Link key={item.href} href={item.href} className={linkClass(active, true)}>
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  key={item.href}
                  className={cn(linkClass(false, false), "hidden md:inline-flex")}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
              );
            })}

          <Link
            href="/settings"
            className={linkClass(!!pathname?.startsWith("/settings"), true)}
          >
            <Settings className="size-4 shrink-0" />
            <span>{t.settings.title}</span>
          </Link>

          {isPlatformAdmin && (
            <>
              <span
                aria-hidden="true"
                className="mx-1 hidden h-5 w-px bg-border md:inline-block"
              />
              <Link
                href="/companies"
                className={linkClass(!!pathname?.startsWith("/companies"), true)}
              >
                <Shield className="size-4 shrink-0" />
                <span>{t.companies.title}</span>
              </Link>
            </>
          )}
        </nav>

        <div className="order-2 flex h-14 items-center justify-end gap-2 sm:gap-3 md:order-3 md:h-auto md:shrink-0">
          <ThemeToggle />
          {myCompany && (
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground 2xl:inline">
              {myCompany.name}
            </span>
          )}
          <div
            title={profile?.full_name || session.user.email || undefined}
            className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:flex"
          >
            {initials}
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1.5">
            <LogOut className="size-4" />
            <span>{t.auth.logout}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
