"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useMyProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const themes = [
  { value: "light", label: t.theme.light, Icon: Sun },
  { value: "dark", label: t.theme.dark, Icon: Moon },
  { value: "system", label: t.theme.system, Icon: Monitor },
] as const;

/** Avatar unten in der Sidebar: Profil, Darstellung (Hell/Dunkel/System), Abmelden. */
export function UserMenu({
  roleLabel,
  collapsed,
  compact = false,
}: {
  roleLabel: string;
  collapsed: boolean;
  /** Nur der runde Avatar (mobile Kopfleiste der Trainer:innen). */
  compact?: boolean;
}) {
  const session = useAuthStore((s) => s.session);
  const { data: profile } = useMyProfile();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLButtonElement>(null);

  const name = profile?.full_name || session?.user.email || "";
  const initials = getInitials(profile?.full_name, session?.user.email);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setPos(
        compact
          ? { right: Math.max(12, window.innerWidth - rect.right), top: rect.bottom + 6 }
          : { left: rect.left, bottom: window.innerHeight - rect.top + 6 },
      );
    }
    setOpen(true);
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-muted";

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={toggle}
        data-tour="/profile"
        aria-label={t.userMenu.label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        className={cn(
          compact
            ? "grid size-8 place-items-center rounded-full"
            : "flex w-full items-center gap-2.5 rounded-[10px] p-2 text-left hover:bg-muted",
          collapsed && !compact && "justify-center px-0",
        )}
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-primary font-heading text-xs font-extrabold text-primary-foreground">
          {initials}
        </span>
        {!collapsed && !compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-tight font-bold">{name}</span>
              <span className="block truncate text-[12.5px] leading-tight text-muted-foreground">
                {roleLabel}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label={t.userMenu.label}
            style={pos}
            className="fixed z-50 w-60 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          >
            <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <User className="size-4" />
              {t.userMenu.profile}
            </Link>
            <div className="px-2 pt-2 pb-1 text-xs font-bold text-muted-foreground">
              {t.userMenu.appearance}
            </div>
            {themes.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={cn(itemClass, theme === value && "bg-accent text-accent-foreground")}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <button type="button" role="menuitem" onClick={() => signOut()} className={itemClass}>
              <LogOut className="size-4" />
              {t.auth.logout}
            </button>
          </div>
        </>
      )}
    </>
  );
}
