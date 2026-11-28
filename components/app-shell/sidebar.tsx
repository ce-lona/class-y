"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  CircleHelp,
  Home,
  Inbox,
  Layers,
  List,
  PanelLeft,
  Plus,
  Receipt,
  Shield,
  SlidersHorizontal,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import {
  CompanySwitcher,
  PLATFORM_PATHS,
  companyTier,
} from "@/components/app-shell/company-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStudioFilter } from "@/hooks/useStudioFilter";
import { useCompanyContracts } from "@/hooks/useContracts";
import { ALL_STUDIOS } from "@/store/studioFilterStore";
import { useLogCourseStore } from "@/store/logCourseStore";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Weitere Pfade, bei denen der Eintrag aktiv ist. */
  also?: string[];
  exact?: boolean;
  count?: number;
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "also" | "exact">) {
  const paths = [item.href, ...(item.also ?? [])];
  return paths.some((p) =>
    item.exact ? pathname === p : pathname === p || pathname.startsWith(`${p}/`),
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-tour={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14.5px] font-semibold transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-foreground/75 hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && !!item.count && (
        <span className="ml-auto rounded-full bg-destructive-bg px-1.5 text-xs leading-[19px] font-bold text-destructive">
          {item.count}
        </span>
      )}
      {collapsed && <span className="sr-only">{item.label}</span>}
    </Link>
  );
}

function Section({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 border-t border-border" />;
  return <div className="px-2.5 pt-3.5 pb-1.5 text-xs font-bold text-muted-foreground">{label}</div>;
}

function StudioFilterSelect() {
  const { studios, studioId, setStudioId, isAll } = useStudioFilter();
  const { isCoordinator } = useWorkspace();
  if (studios.length < 2 && !(isCoordinator && studios.length >= 1)) return null;
  return (
    <select
      aria-label={t.studioFilter.label}
      data-testid="studio-filter"
      value={isAll ? ALL_STUDIOS : studioId}
      onChange={(e) => setStudioId(e.target.value)}
      className="mt-1.5 h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value={ALL_STUDIOS}>
        {isCoordinator ? t.studioFilter.myStudios : t.studioFilter.allStudios}
      </option>
      {studios.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function useAdminNavItems(): NavItem[] {
  const { myCompany, isCoordinator } = useWorkspace();
  const { data: contracts } = useCompanyContracts(
    myCompany && !isCoordinator ? myCompany.id : undefined,
  );
  const pending = (contracts ?? []).filter(
    (c) => c.status === "pending" && c.approval_status === "pending_approval",
  ).length;
  return [
    { href: "/overview", label: t.shell.overview, icon: Home },
    { href: "/monitoring", label: t.shell.courses, icon: List },
    { href: "/plans", label: t.shell.plans, icon: CalendarDays },
    isCoordinator
      ? { href: "/trainers", label: t.shell.trainers, icon: Users }
      : { href: "/team", label: t.shell.team, icon: Users, also: ["/trainers"], count: pending },
    { href: "/billing", label: t.shell.billing, icon: Receipt },
  ];
}

export const trainerNavItems: NavItem[] = [
  {
    href: "/courses",
    label: t.shell.trainerMyCourses,
    icon: CalendarCheck,
    exact: true,
    also: ["/courses/schedule"],
  },
  { href: "/courses/billing", label: t.shell.trainerBilling, icon: Receipt },
  { href: "/profile", label: t.shell.trainerProfile, icon: User },
];

const platformItems: NavItem[] = [
  { href: "/companies", label: t.shell.platformOverview, icon: Layers },
  { href: "/platform-admins", label: t.shell.platformAdmins, icon: Shield },
  { href: "/support", label: t.shell.support, icon: Inbox },
];

export function Sidebar({
  collapsed,
  canToggle,
  onToggle,
  className,
}: {
  collapsed: boolean;
  canToggle: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const {
    hasAdminRole,
    hasPlatformRole,
    showTrainerArea,
    hasNoRole,
    isCoordinator,
    myCompanies,
  } = useWorkspace();
  const adminItems = useAdminNavItems();
  const openLogCourse = useLogCourseStore((s) => s.setOpen);

  const tier3Platform = hasPlatformRole && companyTier(myCompanies.length) === 3;
  const onPlatformPage = tier3Platform && PLATFORM_PATHS.some((p) => pathname.startsWith(p));
  const showCompanyItems = hasAdminRole && !onPlatformPage;

  const roleLabel = hasPlatformRole
    ? t.nav.rolePlatform
    : hasAdminRole
      ? isCoordinator
        ? t.nav.roleCoordinator
        : t.nav.roleAdmin
      : t.nav.roleTrainer;

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-dvh shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-3.5 text-sidebar-foreground transition-[width] duration-150",
        collapsed ? "w-16 px-2" : "w-[248px]",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-2 pt-1 pb-3.5",
          collapsed && "flex-col gap-2 px-0",
        )}
      >
        <Link href="/" className="text-[22px]" aria-label={t.common.appName}>
          {collapsed ? <LogoMark className="text-primary" /> : <Logo aria-hidden="true" />}
        </Link>
        {canToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? t.shell.expand : t.shell.collapse}
            title={collapsed ? t.shell.expand : t.shell.collapse}
            className={cn(
              "grid place-items-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
              !collapsed && "ml-auto",
            )}
          >
            <PanelLeft className="size-4" />
          </button>
        )}
      </div>

      <nav aria-label={t.shell.mainNav} className="flex flex-col gap-0.5">
        {showTrainerArea && (
          <>
            <button
              type="button"
              onClick={() => openLogCourse(true)}
              data-tour="/courses/log"
              title={collapsed ? t.shell.trainerLogCourse : undefined}
              className={cn(
                "mb-2 flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary p-2.5 font-bold text-primary-foreground hover:bg-primary/90",
                collapsed && "px-0",
              )}
            >
              <Plus className="size-[18px]" />
              {!collapsed && <span>{t.shell.trainerLogCourse}</span>}
              {collapsed && <span className="sr-only">{t.shell.trainerLogCourse}</span>}
            </button>
            {trainerNavItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </>
        )}

        {hasNoRole && (
          <NavLink item={trainerNavItems[2]} pathname={pathname} collapsed={collapsed} />
        )}

        {hasPlatformRole && (
          <>
            <Section label={t.shell.sectionPlatform} collapsed={collapsed} />
            {platformItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
            {(hasAdminRole || onPlatformPage) && (
              <Section label={t.shell.sectionCompany} collapsed={collapsed} />
            )}
          </>
        )}

        {(hasAdminRole || onPlatformPage) && (
          <div className="mt-0.5 mb-1.5">
            <CompanySwitcher collapsed={collapsed} />
            {showCompanyItems && !collapsed && <StudioFilterSelect />}
          </div>
        )}

        {showCompanyItems &&
          adminItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
      </nav>

      <div className="min-h-3 flex-1" />

      <div className="flex flex-col gap-0.5">
        {showCompanyItems && (
          <NavLink
            item={{
              href: "/settings",
              label: t.shell.settings,
              icon: SlidersHorizontal,
              also: ["/studios", "/privacy"],
            }}
            pathname={pathname}
            collapsed={collapsed}
          />
        )}
        <NavLink
          item={{ href: "/help", label: t.shell.help, icon: CircleHelp }}
          pathname={pathname}
          collapsed={collapsed}
        />
        <div className="mt-1 border-t border-border pt-1">
          <UserMenu roleLabel={roleLabel} collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
