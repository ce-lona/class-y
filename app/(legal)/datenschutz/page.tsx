import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { t } from "@/i18n/de";

export const metadata: Metadata = { title: `${t.legal.datenschutz} · class-y` };

export default function DatenschutzPage() {
  return <LegalDocument name="datenschutz" />;
}
