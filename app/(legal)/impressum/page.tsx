import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { t } from "@/i18n/de";

export const metadata: Metadata = { title: `${t.legal.impressum} · class-y` };

export default function ImpressumPage() {
  return <LegalDocument name="impressum" />;
}
