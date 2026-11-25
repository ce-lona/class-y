"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { House, RotateCcw } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/i18n/de";
import { fontVariables } from "./fonts";
import "./globals.css";

// Ersetzt das Root-Layout, wenn dort selbst ein Fehler auftritt. next-themes
// läuft hier nicht, darum setzt das Inline-Script das gespeicherte Theme selbst.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function GlobalError({
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
    <html lang="de" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <head>
        <title>{`${t.errors.serverErrorTitle} · ${t.common.appName}`}</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="flex h-16 items-center px-5 sm:px-10">
          {/* Bewusst <a> statt <Link>: lädt die App komplett neu. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="text-xl">
            <Logo aria-hidden="true" />
            <span className="sr-only">{t.common.appName}</span>
          </a>
        </header>
        <ErrorState
          code={t.errors.serverErrorCode}
          title={t.errors.serverErrorTitle}
          text={t.errors.serverErrorText}
          reference={
            error.digest ? { label: t.errors.errorReference, value: error.digest } : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <House />
            <span>{t.errors.backHome}</span>
          </a>
          <button type="button" className={buttonVariants({ size: "lg" })} onClick={() => retry()}>
            <RotateCcw />
            <span>{t.errors.retry}</span>
          </button>
        </ErrorState>
      </body>
    </html>
  );
}
