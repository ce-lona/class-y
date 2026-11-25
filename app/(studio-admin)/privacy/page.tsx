"use client";

import { ShieldCheck } from "lucide-react";
import { CompanyPrivacyPanel } from "@/components/privacy/company-privacy-panel";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { t } from "@/i18n/de";

export default function PrivacyPage() {
  const { data: company } = useMyCompany();

  // Koordinatoren verwalten nur Studios; Datenauskunft und Löschung sind Company-Admins vorbehalten.
  if (!company || company.role === "coordinator") {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">{t.privacy.errors.not_authorized}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
            {t.privacy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.privacy.subtitle}</p>
        </div>
      </div>

      <CompanyPrivacyPanel companyId={company.id} companyName={company.name} />
    </div>
  );
}
