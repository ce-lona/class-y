"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { House, RotateCcw } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/i18n/de";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorState
      code={t.errors.serverErrorCode}
      title={t.errors.serverErrorTitle}
      text={t.errors.serverErrorText}
      reference={
        error.digest ? { label: t.errors.errorReference, value: error.digest } : undefined
      }
    >
      <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
        <House />
        <span>{t.errors.backHome}</span>
      </Link>
      <Button size="lg" onClick={() => retry()}>
        <RotateCcw />
        <span>{t.errors.retry}</span>
      </Button>
    </ErrorState>
  );
}
