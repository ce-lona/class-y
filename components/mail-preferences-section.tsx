"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { useMyProfile, useUpdateMyMailPreferences } from "@/hooks/useProfile";
import type { MailPreferences } from "@/lib/profiles";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const OPTIONS: { key: keyof MailPreferences; label: string; hint: string }[] = [
  {
    key: "mail_document_ready",
    label: t.creditNotes.myMailDocumentReadyLabel,
    hint: t.creditNotes.myMailDocumentReadyHint,
  },
  {
    key: "mail_review_reminder",
    label: t.creditNotes.myMailReviewReminderLabel,
    hint: t.creditNotes.myMailReviewReminderHint,
  },
  {
    key: "mail_correction_request",
    label: t.creditNotes.myMailCorrectionRequestLabel,
    hint: t.creditNotes.myMailCorrectionRequestHint,
  },
];

/** Profil → Stammdaten: Abrechnungs-Mails persönlich abbestellen. Jede Änderung wird sofort gespeichert. */
export function MailPreferencesSection() {
  const { data: profile } = useMyProfile();
  const update = useUpdateMyMailPreferences();
  const [saved, setSaved] = useState(false);
  // Sofort anzeigen, was angeklickt wurde; bei einem Fehler zurück auf den gespeicherten Stand.
  const [pending, setPending] = useState<MailPreferences | null>(null);

  if (!profile) return null;

  const current: MailPreferences = pending ?? {
    mail_document_ready: profile.mail_document_ready,
    mail_review_reminder: profile.mail_review_reminder,
    mail_correction_request: profile.mail_correction_request,
  };

  function toggle(key: keyof MailPreferences, value: boolean) {
    const next = { ...current, [key]: value };
    setSaved(false);
    setPending(next);
    update.mutate(next, {
      onSuccess: () => setSaved(true),
      onSettled: () => setPending(null),
    });
  }

  return (
    <section id="mail-preferences" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3.5 border-b border-border px-5 py-4 sm:px-6">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
          <Mail className="size-4" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold">{t.creditNotes.myMailTitle}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.creditNotes.myMailHint}</p>
        </div>
      </div>
      <div className="space-y-3 p-5 sm:p-6">
        {OPTIONS.map((option) => (
          <label
            key={option.key}
            htmlFor={option.key}
            className={cn(
              "flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3.5",
              !update.isPending && "cursor-pointer hover:border-primary-300 dark:hover:border-primary-700",
            )}
          >
            <input
              id={option.key}
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={current[option.key]}
              disabled={update.isPending}
              onChange={(e) => toggle(option.key, e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
        {saved && !update.isPending && (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" />
            {t.creditNotes.myMailSaved}
          </p>
        )}
        {update.isError && <p className="text-sm text-destructive">{t.common.error}</p>}
      </div>
    </section>
  );
}
