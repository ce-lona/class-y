"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSetStudioAdminPermissions,
  useStudioAdminPermissions,
} from "@/hooks/useStudioAdminPermissions";
import type { PermissionLevel, StudioAdminPermissions } from "@/lib/studioAdminPermissions";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const levelLabels: Record<PermissionLevel, string> = {
  allowed: t.roleModel.levelAllowed,
  approval: t.roleModel.levelApproval,
  denied: t.roleModel.levelDenied,
};

function LevelPicker<L extends PermissionLevel>({
  name,
  value,
  levels,
  disabled,
  onChange,
}: {
  name: string;
  value: L;
  levels: readonly L[];
  disabled: boolean;
  onChange: (next: L) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
      {levels.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          disabled={disabled}
          onClick={() => onChange(level)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-default",
            value === level
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground enabled:hover:text-foreground"
          )}
        >
          {levelLabels[level]}
        </button>
      ))}
    </div>
  );
}

/** Einstellungen → Konfiguration: Company-Admins legen fest, was Studio-Admins dürfen. */
export function StudioAdminPermissionsCard({
  companyId,
  canEdit,
}: {
  companyId: string;
  canEdit: boolean;
}) {
  const { data: saved, isLoading } = useStudioAdminPermissions(companyId);
  const save = useSetStudioAdminPermissions(companyId);
  const [draft, setDraft] = useState<StudioAdminPermissions | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (isLoading || !saved) {
    return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  }

  const current = draft ?? saved;
  const dirty =
    draft !== null &&
    (draft.course_types !== saved.course_types ||
      draft.contracts !== saved.contracts ||
      draft.billing !== saved.billing);

  function update(patch: Partial<StudioAdminPermissions>) {
    setMessage(null);
    setDraft({ ...current, ...patch });
  }

  async function handleSave() {
    if (!draft) return;
    try {
      await save.mutateAsync(draft);
      setDraft(null);
      setMessage(t.roleModel.permissionsSaved);
    } catch (error) {
      console.error(error);
      setMessage(t.roleModel.permissionsError);
    }
  }

  const rows = [
    {
      key: "course_types" as const,
      label: t.roleModel.permCourseTypes,
      hint: t.roleModel.permCourseTypesHint,
    },
    {
      key: "contracts" as const,
      label: t.roleModel.permContracts,
      hint: t.roleModel.permContractsHint,
    },
  ];

  return (
    <div className="space-y-4" data-testid="studio-admin-permissions">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <ShieldCheck className="size-5 text-primary" />
          <span>{t.roleModel.permissionsTitle}</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          {canEdit ? t.roleModel.permissionsHint : t.roleModel.permissionsReadOnly}
        </p>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.hint}</p>
            </div>
            <LevelPicker
              name={row.label}
              value={current[row.key]}
              levels={["allowed", "approval", "denied"] as const}
              disabled={!canEdit}
              onChange={(next) => update({ [row.key]: next })}
            />
          </div>
        ))}
        <div className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.roleModel.permBilling}</p>
            <p className="text-xs text-muted-foreground">{t.roleModel.permBillingHint}</p>
          </div>
          <LevelPicker
            name={t.roleModel.permBilling}
            value={current.billing}
            levels={["allowed", "denied"] as const}
            disabled={!canEdit}
            onChange={(next) => update({ billing: next })}
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="button" disabled={!dirty || save.isPending} onClick={handleSave}>
            {t.common.save}
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      )}
    </div>
  );
}
