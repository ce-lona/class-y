import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { t } from "@/i18n/de";

export const metadata: Metadata = { title: `${t.legal.agb} · class-y` };

export default function AgbPage() {
  return <LegalDocument name="agb" />;
}
