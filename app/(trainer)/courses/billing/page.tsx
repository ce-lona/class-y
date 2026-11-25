"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { BillingExportPanel } from "@/components/billing-export-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyBillingCompanies } from "@/hooks/useBillingExport";
import { t } from "@/i18n/de";

export default function TrainerBillingPage() {
  const { data: companies, isLoading } = useMyBillingCompanies();
  const [selected, setSelected] = useState<string | null>(null);

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>;
  }

  const list = companies ?? [];
  const company = list.find((c) => c.company_id === selected) ?? list[0];

  if (!company) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
          <Receipt className="size-5" />
        </div>
        <p className="text-sm text-muted-foreground">{t.billing.noCompanies}</p>
      </div>
    );
  }

  const companySelect =
    list.length > 1 ? (
      <Select value={company.company_id} onValueChange={(v) => v && setSelected(v)}>
        <SelectTrigger aria-label={t.billing.companyLabel} className="min-w-44">
          <SelectValue>
            {(value: string) => list.find((c) => c.company_id === value)?.company_name ?? ""}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {list.map((c) => (
            <SelectItem key={c.company_id} value={c.company_id}>
              {c.company_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  return (
    <BillingExportPanel
      key={company.company_id}
      scope="mine"
      companyId={company.company_id}
      companyName={company.company_name}
      extraControls={companySelect}
    />
  );
}
