"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BillingExportPanel } from "@/components/billing-export-panel";
import { BillingDocumentsPanel } from "@/components/billing-documents-panel";
import { BillingTabs } from "@/components/billing-tabs";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { t } from "@/i18n/de";

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "export" ? "export" : "documents";
  const { data: company } = useMyCompany();
  if (!company) return null;

  const tabs = (
    <BillingTabs
      value={tab}
      onChange={(next) =>
        router.replace(next === "export" ? "/billing?tab=export" : "/billing", { scroll: false })
      }
    />
  );

  if (tab === "export") {
    return (
      <BillingExportPanel
        scope="company"
        companyId={company.id}
        companyName={company.name}
        extraControls={tabs}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">{t.billing.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.creditNotes.subtitleAdmin}</p>
        </div>
        {tabs}
      </div>
      <BillingDocumentsPanel company={company} />
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>}>
      <BillingContent />
    </Suspense>
  );
}
