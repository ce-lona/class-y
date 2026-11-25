import type { Metadata } from "next";
import Link from "next/link";
import { House } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/i18n/de";

export const metadata: Metadata = {
  title: `${t.errors.notFoundTitle} · ${t.common.appName}`,
};

export default function NotFound() {
  return (
    <ErrorState
      code={t.errors.notFoundCode}
      title={t.errors.notFoundTitle}
      text={t.errors.notFoundText}
    >
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        <House />
        <span>{t.errors.backHome}</span>
      </Link>
    </ErrorState>
  );
}
