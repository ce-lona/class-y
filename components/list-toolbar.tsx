"use client";

import { Building2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

/** Normalisierter Vergleich für Listen-Suchen (Groß-/Kleinschreibung, Umlaute bleiben erhalten). */
export function matchesSearch(query: string, ...values: (string | null | undefined)[]): boolean {
  const q = query.trim().toLocaleLowerCase("de");
  if (!q) return true;
  return values.some((v) => v?.toLocaleLowerCase("de").includes(q));
}

export function SearchInput({
  value,
  onChange,
  placeholder = t.lists.searchPlaceholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full min-w-0 rounded-lg border border-input bg-card pr-8 pl-9 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t.lists.clearSearch}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Chip-Leiste „Alle Studios | Studio A | Studio B“. Wird nur bei mehr als einem Studio gezeigt. */
export function StudioFilterChips({
  studios,
  value,
  onChange,
  counts,
}: {
  studios: { id: string; name: string }[];
  value: string;
  onChange: (next: string) => void;
  counts?: Record<string, number>;
}) {
  if (studios.length < 2) return null;

  const chip = (id: string, label: string, withIcon: boolean) => {
    const selected = value === id;
    const count = counts?.[id];
    return (
      <button
        key={id}
        type="button"
        aria-pressed={selected}
        onClick={() => onChange(id)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {withIcon && <Building2 className="size-3.5" />}
        <span>{label}</span>
        {count !== undefined && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
              selected ? "bg-primary-foreground/20" : "bg-muted text-foreground"
            )}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={t.lists.studioFilterLabel}
      className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
    >
      {chip("all", t.lists.allStudios, false)}
      {studios.map((s) => chip(s.id, s.name, true))}
    </div>
  );
}

export function NoSearchResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2.5 p-10 text-center">
      <Search className="size-7 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{t.lists.noResults}</p>
      <button
        type="button"
        onClick={onReset}
        className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
      >
        {t.lists.resetFilters}
      </button>
    </div>
  );
}
