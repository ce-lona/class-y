"use client";

import { useState } from "react";
import { AlertTriangle, CalendarX2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gdprErrorMessage } from "@/components/privacy/company-privacy-panel";
import { useCancelCompanyDeletion, useScheduleCompanyDeletion } from "@/hooks/useGdpr";
import type { Company } from "@/lib/companies";
import { t } from "@/i18n/de";

function formatDateTimeDE(value: string) {
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Offboarding nach Kündigung: Löschung mit 30 Tagen Karenz (nur Plattform-Admins). */
export function CompanyOffboardingCard({ company }: { company: Company }) {
  const schedule = useScheduleCompanyDeletion(company.id);
  const cancel = useCancelCompanyDeletion(company.id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduledFor = company.deletion_scheduled_for;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setConfirming(false);
    } catch (err) {
      console.error(err);
      setError(gdprErrorMessage(err));
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <CalendarX2 className="size-4" />
          </div>
          <h2 className="font-heading text-lg font-bold">{t.privacy.offboarding.title}</h2>
        </div>
        {scheduledFor && (
          <Badge className="bg-destructive-bg text-destructive">{t.privacy.offboarding.badge}</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{t.privacy.offboarding.hint}</p>

      {scheduledFor ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t.privacy.offboarding.scheduledFor}</dt>
            <dd className="font-semibold">{formatDateTimeDE(scheduledFor)}</dd>
            {company.deletion_requested_at && (
              <>
                <dt className="text-muted-foreground">{t.privacy.offboarding.requestedAt}</dt>
                <dd>{formatDateTimeDE(company.deletion_requested_at)}</dd>
              </>
            )}
          </dl>
          <Button
            type="button"
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => run(() => cancel.mutateAsync())}
          >
            <Undo2 className="size-4" />
            <span>{t.privacy.offboarding.cancel}</span>
          </Button>
        </div>
      ) : confirming ? (
        <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm">{t.privacy.offboarding.scheduleConfirm}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={schedule.isPending}
              onClick={() => run(() => schedule.mutateAsync())}
            >
              {t.privacy.offboarding.schedule}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
          <CalendarX2 className="size-4" />
          <span>{t.privacy.offboarding.schedule}</span>
        </Button>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </section>
  );
}
