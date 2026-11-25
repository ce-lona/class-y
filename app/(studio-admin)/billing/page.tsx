"use client";

import { BillingExportPanel } from "@/components/billing-export-panel";
import { useMyCompany } from "@/hooks/useCompanyAdmins";

export default function BillingPage() {
  const { data: company } = useMyCompany();
  if (!company) return null;

  return <BillingExportPanel scope="company" companyId={company.id} companyName={company.name} />;
}
