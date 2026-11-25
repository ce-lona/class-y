"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarRange,
  LayoutGrid,
  LogOut,
  PlusCircle,
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
const adminPrefixes = ["/monitoring", "/plans", "/studios", "/trainers"];

type WorkspaceRole = "trainer" | "admin" | "platform";

const WORKSPACE_STORAGE_KEY = "class-y:workspace-role";

const studioNavItems = [
  { href: "/monitoring", label: t.studioAdmin.nav.monitoring, icon: LayoutGrid },
  { href: "/plans", label: t.studioAdmin.nav.plans, icon: Calendar },
  { href: "/studios", label: t.studioAdmin.nav.studios, icon: Building2 },
  { href: "/trainers", label: t.studioAdmin.nav.trainers, icon: Users },
] as const;

const trainerNavItems = [
  { href: "/courses", label: t.trainer.navMyCourses, icon: CalendarCheck, exact: true },
  { href: "/courses/schedule", label: t.trainer.navSchedule, icon: CalendarRange, exact: false },
  { href: "/courses/log", label: t.trainer.navLogCourse, icon: PlusCircle, exact: false },
] as const;

function routeWorkspace(pathname: string | null): WorkspaceRole | null {
  if (!pathname) return null;
  if (pathname.startsWith("/courses")) return "trainer";
  if (pathname.startsWith("/companies")) return "platform";
  if (adminPrefixes.some((p) => pathname.startsWith(p))) return "admin";
  return null;
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { data: myCompany } = useMyCompany();
  const { data: myContracts } = useMyContracts();
  const { data: profile } = useMyProfile();

  const [lastWorkspace, setLastWorkspace] = useState<WorkspaceRole | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (stored === "trainer" || stored === "admin" || stored === "platform") {
        return stored;
      }
    } catch {
      // ignore storage errors
    }
    return null;
  });

  const fromRoute = routeWorkspace(pathname);

  useEffect(() => {
    if (!fromRoute) return;
    try {
      window.sessionStorage.setItem(WORKSPACE_STORAGE_KEY, fromRoute);
    } catch {
      // ignore storage errors
    }
  }, [fromRoute]);

  if (!session) return null;
  if (authPrefixes.some((prefix) => pathname?.startsWith(prefix))) {
    return null;
  }

  const hasActiveContract = (myContracts ?? []).some((c) => c.status === "active");
  const hasAdminRole = Boolean(myCompany);
  const hasPlatformRole = Boolean(isPlatformAdmin);

  const availableRoles: { id: WorkspaceRole; label: string; home: string }[] = [];
  if (hasActiveContract) {
    availableRoles.push({ id: "trainer", label: t.nav.roleTrainer, home: "/courses" });
  }
  if (hasAdminRole && myCompany) {
    availableRoles.push({
      id: "admin",
      label: `${t.nav.roleAdmin} · ${myCompany.name}`,
      home: "/monitoring",
    });
  }
  if (hasPlatformRole) {
    availableRoles.push({ id: "platform", label: t.nav.rolePlatform, home: "/companies" });
  }

  const defaultRole: WorkspaceRole = hasAdminRole
    ? "admin"
    : hasActiveContract
      ? "trainer"
      : "platform";

  const candidateRole = fromRoute ?? lastWorkspace ?? defaultRole;
  const activeRole: WorkspaceRole = availableRoles.some((r) => r.id === candidateRole)
    ? candidateRole
    : availableRoles[0]?.id ?? defaultRole;

  const initials = getInitials(profile?.full_name, session.user.email);

  const linkClass = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors lg:px-3",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  function switchWorkspace(role: WorkspaceRole, home: string) {
    try {
      window.sessionStorage.setItem(WORKSPACE_STORAGE_KEY, role);
    } catch {
      // ignore
    }
    setLastWorkspace(role);
    router.push(home);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-sidebar/95 backdrop-blur-sm">
      <div className="grid w-full grid-cols-[auto_1fr] items-center gap-y-0 px-4 sm:px-8 md:flex md:h-16 md:justify-between md:gap-4">
        <div className="flex h-14 items-center gap-5 md:h-auto md:shrink-0">
          <Link href="/" className="text-xl">
            <Logo aria-hidden="true" />
            <span className="sr-only">{t.common.appName}</span>
          </Link>
        </div>

        <nav
          aria-label="Hauptnavigation"
          className="col-span-2 order-3 -mx-4 flex items-center gap-0.5 overflow-x-auto border-t border-border/70 px-4 py-2 sm:-mx-8 sm:px-8 md:order-2 md:mx-0 md:flex-1 md:border-t-0 md:px-2 md:py-0"
        >
          {activeRole === "trainer" &&
            hasActiveContract &&
            trainerNavItems.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : !!pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={linkClass(active)}>
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

          {activeRole === "admin" &&
            hasAdminRole &&
            studioNavItems.map((item) => {
              const active = !!pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={linkClass(active)}>
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

          {activeRole === "platform" && hasPlatformRole && (
            <Link
              href="/companies"
              className={linkClass(!!pathname?.startsWith("/companies"))}
            >
              <Shield className="size-4 shrink-0" />
              <span>{t.companies.title}</span>
            </Link>
          )}

          <Link
            href="/settings"
            className={linkClass(!!pathname?.startsWith("/settings"))}
          >
            <Settings className="size-4 shrink-0" />
            <span>{t.settings.title}</span>
          </Link>
        </nav>

        <div className="order-2 flex h-14 items-center justify-end gap-2 sm:gap-2.5 md:order-3 md:h-auto md:shrink-0">
          {availableRoles.length > 1 && (
            <div
              role="group"
              aria-label={t.nav.workspaceLabel}
              className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5"
            >
              {availableRoles.map((role) => {
                const selected = role.id === activeRole;
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => switchWorkspace(role.id, role.home)}
                    className={cn(
                      "max-w-36 truncate rounded-md px-2 py-1 text-xs font-semibold transition-colors sm:px-2.5",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {role.label}
                  </button>
                );
              })}
            </div>
          )}

          <ThemeToggle />

          <div
            title={profile?.full_name || session.user.email || undefined}
            className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:flex"
          >
            {initials}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            aria-label={t.auth.logout}
            className="gap-1.5"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{t.auth.logout}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
