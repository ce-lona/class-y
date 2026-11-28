"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, Layers, Search, Star } from "lucide-react";
import { CompanyBadge } from "@/components/app-shell/company-badge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStudioFilter } from "@/hooks/useStudioFilter";
import { useCompanyStore } from "@/store/companyStore";
import type { ManagedCompany } from "@/lib/companyAdmins";
import { fillTemplate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

/** Ab so vielen Companies gibt es für Plattform-Admins die Plattform-Übersicht als Start. */
export const PLATFORM_OVERVIEW_THRESHOLD = 20;
const QUICK_LIMIT = 9;

/** Gestaffelt: 1 Company = nur Name; 2–5 = Liste; 6–19 = Suche, Angepinnt, Zuletzt; ab 20 + Übersicht. */
export function companyTier(count: number): 1 | 2 | 3 {
  if (count <= 5) return 1;
  return count < PLATFORM_OVERVIEW_THRESHOLD ? 2 : 3;
}

/** Plattform-Seiten, auf denen keine Company gewählt ist (für Plattform-Admins ab 20 Companies). */
export const PLATFORM_PATHS = ["/companies", "/platform-admins", "/support"];

export function CompanySwitcher({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { myCompany, myCompanies, hasPlatformRole } = useWorkspace();
  const { studios } = useStudioFilter();
  const selectCompany = useCompanyStore((s) => s.selectCompany);
  const pins = useCompanyStore((s) => s.pinnedCompanyIds);
  const recent = useCompanyStore((s) => s.recentCompanyIds);
  const togglePin = useCompanyStore((s) => s.togglePin);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);

  const count = myCompanies.length;
  const tier = companyTier(count);
  const multi = count > 1;
  const showOverview = hasPlatformRole && tier === 3;
  const onPlatformPage = showOverview && PLATFORM_PATHS.some((p) => pathname.startsWith(p));

  const quick = useMemo<ManagedCompany[]>(() => {
    if (tier === 1) return myCompanies;
    const byId = new Map(myCompanies.map((c) => [c.id, c]));
    const ids = [...new Set([...pins, ...recent, ...(myCompany ? [myCompany.id] : [])])];
    return ids
      .map((id) => byId.get(id))
      .filter((c): c is ManagedCompany => Boolean(c))
      .slice(0, QUICK_LIMIT);
  }, [tier, myCompanies, pins, recent, myCompany]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return myCompanies
      .filter((c) => c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [query, myCompanies]);

  function openPopover() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ left: rect.left, top: rect.bottom + 6 });
    setQuery("");
    setOpen(true);
  }

  function choose(id: string) {
    selectCompany(id);
    setOpen(false);
    if (PLATFORM_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith("/studios/")) {
      router.push("/overview");
    }
  }

  // Strg K / ⌘ K öffnet den Wechsler; im offenen Wechsler wählen die Ziffern direkt.
  useEffect(() => {
    if (!multi) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPopover();
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" && (target as HTMLInputElement).value !== "";
      if (!typing && /^[1-9]$/.test(e.key)) {
        const company = quick[Number(e.key) - 1];
        if (company) {
          e.preventDefault();
          choose(company.id);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (open && tier > 1) inputRef.current?.focus();
  }, [open, tier]);

  if (!myCompany && !onPlatformPage) return null;

  const roleText = hasPlatformRole
    ? t.switcher.rolePlatform
    : myCompany?.role === "coordinator"
      ? t.switcher.roleStudioAdmin
      : t.switcher.roleAdmin;
  const studiosText =
    studios.length === 1
      ? t.switcher.studiosCountOne
      : fillTemplate(t.switcher.studiosCount, { count: studios.length });

  const item = (company: ManagedCompany, key: number | null) => {
    const pinned = pins.includes(company.id);
    return (
      <div
        key={company.id}
        role="option"
        aria-selected={company.id === myCompany?.id && !onPlatformPage}
        tabIndex={0}
        onClick={() => choose(company.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose(company.id);
          }
        }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
          company.id === myCompany?.id && !onPlatformPage && "bg-accent",
        )}
      >
        <CompanyBadge id={company.id} name={company.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight font-semibold">{company.name}</span>
          {company.role === "coordinator" && (
            <span className="block text-xs leading-tight text-muted-foreground">
              {t.switcher.roleStudioAdmin}
            </span>
          )}
        </span>
        {key !== null && (
          <kbd className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">
            {key}
          </kbd>
        )}
        {tier > 1 && (
          <button
            type="button"
            aria-label={pinned ? t.switcher.unpin : t.switcher.pin}
            aria-pressed={pinned}
            title={pinned ? t.switcher.unpin : t.switcher.pin}
            onClick={(e) => {
              e.stopPropagation();
              togglePin(company.id);
            }}
            className={cn(
              "grid place-items-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
              pinned && "text-[#C98A12] hover:text-[#C98A12]",
            )}
          >
            <Star className={cn("size-3.5", pinned && "fill-current")} />
          </button>
        )}
      </div>
    );
  };

  const pinnedQuick = quick.filter((c) => pins.includes(c.id));
  const recentQuick = quick.filter((c) => !pins.includes(c.id));
  const sectionTitle = (label: string) => (
    <div className="px-2 pt-1.5 pb-1 text-xs font-bold text-muted-foreground">{label}</div>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        data-testid="company-switcher"
        aria-label={multi ? t.switcher.label : undefined}
        aria-haspopup={multi ? "listbox" : undefined}
        aria-expanded={multi ? open : undefined}
        disabled={!multi}
        title={
          onPlatformPage
            ? t.switcher.openCompany
            : `${myCompany?.name ?? ""}${multi ? ` · ${t.switcher.shortcut}` : ""}`
        }
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] border border-border bg-card px-2.5 py-2 text-left transition-colors disabled:cursor-default",
          multi && "hover:border-muted-foreground",
          collapsed && "justify-center border-transparent bg-transparent px-0",
        )}
      >
        {onPlatformPage ? (
          <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-muted-foreground text-white">
            <Search className="size-4" />
          </span>
        ) : (
          myCompany && <CompanyBadge id={myCompany.id} name={myCompany.name} />
        )}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] leading-tight font-bold">
                {onPlatformPage ? t.switcher.openCompany : myCompany?.name}
              </span>
              <span className="block truncate text-[12.5px] leading-tight text-muted-foreground">
                {onPlatformPage
                  ? `${fillTemplate(t.switcher.companiesCount, { count })} · ${t.switcher.shortcut}`
                  : `${studiosText} · ${roleText}`}
              </span>
            </span>
            {multi && <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />}
          </>
        )}
      </button>

      {open && anchor && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={t.switcher.label}
            style={{ left: anchor.left, top: anchor.top }}
            className="fixed z-50 w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          >
            <div role="listbox" className="max-h-[420px] overflow-y-auto">
              {tier === 1 ? (
                <>
                  {sectionTitle(t.switcher.yourCompanies)}
                  {myCompanies.map((c, i) => item(c, i + 1))}
                </>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={fillTemplate(t.switcher.searchPlaceholder, { count })}
                    aria-label={fillTemplate(t.switcher.searchPlaceholder, { count })}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && hits[0]) choose(hits[0].id);
                    }}
                    className="mb-1 h-9 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-accent"
                  />
                  {query.trim() ? (
                    <>
                      {sectionTitle(t.switcher.results)}
                      {hits.map((c) => item(c, null))}
                      {hits.length === 0 && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">{t.switcher.noHit}</p>
                      )}
                    </>
                  ) : (
                    <>
                      {pinnedQuick.length > 0 && sectionTitle(t.switcher.pinned)}
                      {pinnedQuick.map((c) => item(c, quick.indexOf(c) + 1))}
                      {recentQuick.length > 0 && sectionTitle(t.switcher.recent)}
                      {recentQuick.map((c) => item(c, quick.indexOf(c) + 1))}
                    </>
                  )}
                  {showOverview && (
                    <Link
                      href="/companies"
                      onClick={() => setOpen(false)}
                      className="mt-1 flex items-center gap-2.5 rounded-lg border-t border-border px-2 py-2 text-sm font-semibold hover:bg-muted"
                    >
                      <Layers className="size-4" />
                      {fillTemplate(t.switcher.allInOverview, { count })}
                    </Link>
                  )}
                </>
              )}
            </div>
            <div className="mt-1 border-t border-border px-2 pt-1.5 pb-0.5 text-xs text-muted-foreground">
              {tier === 1
                ? fillTemplate(t.switcher.footTier1, { count: Math.min(count, 9) })
                : tier === 2 || !showOverview
                  ? t.switcher.footTier2
                  : t.switcher.footTier3}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
