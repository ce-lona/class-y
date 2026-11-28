"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarRange, Plus, Receipt, User } from "lucide-react";
import { isActive, type NavItem } from "@/components/app-shell/sidebar";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const left: NavItem[] = [
  { href: "/courses", label: t.shell.bottomWeek, icon: CalendarCheck, exact: true },
  { href: "/courses/schedule", label: t.shell.bottomPlan, icon: CalendarRange },
];
const right: NavItem[] = [
  { href: "/courses/billing", label: t.shell.bottomBilling, icon: Receipt },
  { href: "/profile", label: t.shell.bottomProfile, icon: User },
];

/** Mobile Bottom-Bar der Trainer:innen: Woche, Plan, Plus (Kurs eintragen), Abrechnung, Profil. */
export function TrainerBottomBar() {
  const pathname = usePathname() ?? "";

  const link = (item: NavItem) => {
    const active = isActive(pathname, item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={t.shell.mainNav}
      data-testid="trainer-bottom-bar"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-border bg-card px-1.5 pt-1.5 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden"
    >
      {left.map(link)}
      <Link
        href="/courses/log"
        aria-label={t.shell.trainerLogCourse}
        className="mx-auto -mt-6 grid size-[52px] place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(31,95,92,0.35)]"
      >
        <Plus className="size-6" />
      </Link>
      {right.map(link)}
    </nav>
  );
}
