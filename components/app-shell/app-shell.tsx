"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { Logo } from "@/components/logo";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TrainerBottomBar } from "@/components/app-shell/trainer-bottom-bar";
import { UserMenu } from "@/components/app-shell/user-menu";
import { CompanyBadge } from "@/components/app-shell/company-badge";
import { PLATFORM_PATHS, companyTier } from "@/components/app-shell/company-switcher";
import { useAuthStore } from "@/store/authStore";
import { useSidebarStore } from "@/store/sidebarStore";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { t } from "@/i18n/de";

const authPrefixes = ["/login", "/forgot-password", "/reset-password", "/auth"];

/** Kontextleiste für Plattform-Admins ab 20 Companies: „Du bist in X · Zur Plattform“. */
function ContextBar() {
  const pathname = usePathname() ?? "";
  const { hasPlatformRole, myCompanies, myCompany } = useWorkspace();
  if (!hasPlatformRole || !myCompany || companyTier(myCompanies.length) < 3) return null;
  if (PLATFORM_PATHS.some((p) => pathname.startsWith(p))) return null;
  return (
    <div
      data-testid="context-bar"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-accent px-5 py-2 text-sm sm:px-8"
    >
      <CompanyBadge id={myCompany.id} name={myCompany.name} className="size-[22px] rounded-md text-[10px]" />
      <span>
        {t.shell.contextIn} <b>{myCompany.name}</b>
      </span>
      <span className="flex-1" />
      <Link href="/companies" className="font-semibold text-primary hover:underline">
        {t.shell.toPlatform}
      </Link>
    </div>
  );
}

/**
 * App-Rahmen nach dem Login: Sidebar (248 px, einklappbar auf 64 px, unter 900 px automatisch
 * eingeklappt) und Inhalt. Trainer:innen bekommen mobil statt der Sidebar eine Bottom-Bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const session = useAuthStore((s) => s.session);
  const { showTrainerArea, hasNoRole } = useWorkspace();
  const manualCollapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const narrow = useMediaQuery("(max-width: 899px)");

  if (!session || authPrefixes.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  const trainerLike = showTrainerArea || hasNoRole;
  const collapsed = manualCollapsed || narrow;

  return (
    <div className="flex min-h-dvh w-full flex-1">
      <Sidebar
        collapsed={collapsed}
        canToggle={!narrow}
        onToggle={toggle}
        className={trainerLike ? "max-md:hidden" : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {trainerLike && (
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-sidebar px-4 md:hidden">
            <Link href="/" className="text-xl" aria-label={t.common.appName}>
              <Logo aria-hidden="true" />
            </Link>
            <span className="flex-1" />
            <Link
              href="/help"
              aria-label={t.shell.help}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <CircleHelp className="size-[18px]" />
            </Link>
            <UserMenu roleLabel={t.nav.roleTrainer} collapsed compact />
          </header>
        )}
        <ContextBar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
      {showTrainerArea && <TrainerBottomBar />}
    </div>
  );
}
