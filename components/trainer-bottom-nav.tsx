"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const items = [
  { href: "/courses", label: t.trainer.navMyCourses, icon: CalendarCheck, exact: true },
  { href: "/courses/log", label: t.trainer.navLogCourse, icon: PlusCircle, exact: false },
  { href: "/settings", label: t.trainer.navProfile, icon: User, exact: false },
] as const;

export function TrainerBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
      <div className="grid grid-cols-3">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : !!pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
