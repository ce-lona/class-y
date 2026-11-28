"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt } from "lucide-react";
import { BillingExportPanel } from "@/components/billing-export-panel";
import { BillingTabs } from "@/components/billing-tabs";
import { MyBillingDocumentsPanel } from "@/components/my-billing-documents-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyBillingCompanies } from "@/hooks/useBillingExport";
import { t } from "@/i18n/de";

function TrainerBillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "export" ? "export" : "documents";
  const { data: companies, isLoading } = useMyBillingCompanies();
  const [selected, setSelected] = useState<string | null>(null);

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>;
  }

  const list = companies ?? [];
  const company = list.find((c) => c.company_id === selected) ?? list[0];

  const tabs = (
    <BillingTabs
      value={tab}
      onChange={(next) =>
        router.replace(next === "export" ? "/courses/billing?tab=export" : "/courses/billing", {
          scroll: false,
        })
      }
    />
  );

  if (tab === "documents") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">{t.billing.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.creditNotes.subtitleTrainer}</p>
          </div>
          {tabs}
        </div>
        <MyBillingDocumentsPanel />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {tabs}
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
            <Receipt className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">{t.billing.noCompanies}</p>
        </div>
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
      extraControls={
        <>
          {tabs}
          {companySelect}
        </>
      }
    />
  );
}

export default function TrainerBillingPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>}>
      <TrainerBillingContent />
    </Suspense>
  );
}
