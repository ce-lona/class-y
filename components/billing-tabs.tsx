"use client";

import { FileSpreadsheet, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

export type BillingTab = "documents" | "export";

/** Umschalter auf der Abrechnungsseite: Gutschriften & Nachweise | Monats-Export. */
export function BillingTabs({ value, onChange }: { value: BillingTab; onChange: (tab: BillingTab) => void }) {
  const tabs = [
    { key: "documents" as const, label: t.creditNotes.tabDocuments, Icon: Receipt },
    { key: "export" as const, label: t.creditNotes.tabExport, Icon: FileSpreadsheet },
  ];
  return (
    <div role="tablist" className="inline-flex rounded-xl border border-border bg-card p-1">
      {tabs.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
            value === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
