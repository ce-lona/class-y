import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  code: string;
  title: string;
  text: string;
  /** Technische Referenz (z.B. Next.js-Error-Digest) für Support-Anfragen. */
  reference?: { label: string; value: string };
  children?: ReactNode;
  className?: string;
};

/**
 * Gemeinsames Layout für 404- und 500-Seiten: große, gedämpfte Statuszahl in
 * Petrol, Titel, Erklärung und Aktionen.
 */
export function ErrorState({ code, title, text, reference, children, className }: ErrorStateProps) {
  return (
    <main
      className={cn(
        "flex flex-1 flex-col items-center justify-center bg-background px-4 py-16",
        className,
      )}
    >
      <div className="w-full max-w-md text-center">
        <p
          aria-hidden="true"
          className="font-heading text-[5.5rem] leading-none font-extrabold tracking-tighter text-primary-200 select-none sm:text-[7rem] dark:text-primary-800"
        >
          {code}
        </p>
        <div className="mt-6 space-y-2">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-muted-foreground">{text}</p>
        </div>
        {children ? (
          <div className="mt-8 flex flex-col-reverse items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            {children}
          </div>
        ) : null}
        {reference ? (
          <p className="mt-8 text-xs text-muted-foreground">
            {reference.label}: <code className="font-mono">{reference.value}</code>
          </p>
        ) : null}
      </div>
    </main>
  );
}
