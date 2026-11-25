"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, History, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeeklyTimetable } from "@/components/weekly-timetable";
import { CoursePlanEditor } from "@/components/course-plan-editor";
import { useCoursePlans, usePlanSlots } from "@/hooks/useCoursePlans";
import type { CoursePlan } from "@/lib/coursePlans";
import { formatDateDE } from "@/lib/format";
import { t } from "@/i18n/de";

function formatPlanLabel(plan: CoursePlan): string {
  const from = formatDateDE(plan.valid_from);
  if (plan.status === "active") {
    return `${t.plans.currentVersion} · ${t.contracts.validity} ${from}`;
  }
  const to = plan.valid_to ? ` – ${formatDateDE(plan.valid_to)}` : "";
  return `${t.plans.archivedVersion} · ${from}${to}`;
}

export function StudioScheduleSection({
  studioId,
  companyId,
  initialEditSlotId = null,
  onEditDone,
}: {
  studioId: string;
  companyId: string;
  /** Öffnet den Editor direkt mit diesem Slot im Bearbeiten-Modus. */
  initialEditSlotId?: string | null;
  onEditDone?: () => void;
}) {
  const { data: plans, isLoading: plansLoading } = useCoursePlans(studioId);
  const activePlan = plans?.find((p) => p.status === "active") ?? null;

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editing, setEditing] = useState(Boolean(initialEditSlotId));
  const [editSlotId, setEditSlotId] = useState<string | null>(initialEditSlotId);
  const [publishedBanner, setPublishedBanner] = useState(false);

  const displayedPlan =
    (selectedPlanId ? plans?.find((p) => p.id === selectedPlanId) : null) ??
    activePlan ??
    plans?.[0] ??
    null;

  const { data: displayedSlots, isLoading: slotsLoading } = usePlanSlots(displayedPlan?.id);
  const { data: activeSlots, isLoading: activeSlotsLoading } = usePlanSlots(activePlan?.id);

  if (plansLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (editing) {
    if (activePlan && activeSlotsLoading) {
      return (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        </div>
      );
    }
    return (
      <CoursePlanEditor
        studioId={studioId}
        companyId={companyId}
        existingPlan={activePlan}
        existingSlots={activeSlots ?? []}
        initialEditSlotId={editSlotId}
        onCancel={() => {
          setEditing(false);
          setEditSlotId(null);
          onEditDone?.();
        }}
        onPublished={() => {
          setEditing(false);
          setEditSlotId(null);
          setSelectedPlanId(null);
          setPublishedBanner(true);
          onEditDone?.();
        }}
      />
    );
  }

  function startEditing(slotId: string | null) {
    setPublishedBanner(false);
    setEditSlotId(slotId);
    setEditing(true);
  }

  const archivedCount = plans?.filter((p) => p.status === "archived").length ?? 0;
  const slotCount = displayedSlots?.length ?? 0;

  return (
    <div className="space-y-4">
      {publishedBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{t.plans.publishedSuccess}</span>
        </div>
      )}

      {!displayedPlan ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
            <Calendar className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-heading text-base font-bold">{t.plans.emptySchedule}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t.plans.emptyScheduleHint}</p>
          </div>
          <Button
            type="button"
            onClick={() => startEditing(null)}
            className="mt-1 gap-1.5"
          >
            <Plus className="size-4" />
            <span>{t.plans.createPlan}</span>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {displayedPlan.status === "active" ? (
                <Badge className="gap-1.5 bg-success-bg text-success">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  <span>
                    {t.plans.validSince} {formatDateDE(displayedPlan.valid_from)}
                  </span>
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5">
                  <History className="size-3" />
                  <span>
                    {t.plans.archivedVersion} · {formatDateDE(displayedPlan.valid_from)}
                    {displayedPlan.valid_to ? ` – ${formatDateDE(displayedPlan.valid_to)}` : ""}
                  </span>
                </Badge>
              )}

              <span className="text-xs font-semibold text-muted-foreground">
                {slotCount} {slotCount === 1 ? t.plans.courseSingular : t.plans.coursesPerWeek}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {plans && plans.length > 1 && (
                <Select
                  value={displayedPlan.id}
                  onValueChange={(v) => v && setSelectedPlanId(v)}
                >
                  <SelectTrigger size="sm" className="min-w-48">
                    <SelectValue>
                      {(value: string) => {
                        const found = plans.find((p) => p.id === value);
                        return found ? formatPlanLabel(found) : t.plans.history;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatPlanLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {archivedCount > 0 && plans?.length === 1 && (
                <span className="text-xs text-muted-foreground">
                  {t.plans.history}: {archivedCount}
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startEditing(null)}
                className="gap-1.5"
              >
                <Pencil className="size-3.5" />
                <span>{t.plans.editPlan}</span>
              </Button>
            </div>
          </div>

          {slotsLoading ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">{t.common.loading}</p>
            </div>
          ) : (
            <WeeklyTimetable
              slots={displayedSlots ?? []}
              onEditSlot={
                displayedPlan.status === "active" ? (slot) => startEditing(slot.id) : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}
