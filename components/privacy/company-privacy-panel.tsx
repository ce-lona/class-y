"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileDown, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import {
  useCompanyPeople,
  useDeleteUser,
  useExportCompanyData,
  useExportUserData,
} from "@/hooks/useGdpr";
import { slugify, type CompanyPerson, type ExportFormat } from "@/lib/gdpr";
import { getInitials } from "@/lib/format";
import { t } from "@/i18n/de";

export function gdprErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
  const errors = t.privacy.errors as Record<string, string>;
  return (message && errors[message]) || t.privacy.errors.generic;
}

function ExportButtons({
  onExport,
  disabled,
  label,
}: {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {(["json", "csv"] as const).map((format) => (
        <Button
          key={format}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onExport(format)}
          aria-label={label ? `${label} ${format.toUpperCase()}` : undefined}
        >
          <Download className="size-3.5" />
          <span>{format === "json" ? t.privacy.exportJson : t.privacy.exportCsv}</span>
        </Button>
      ))}
    </div>
  );
}

export function CompanyPrivacyPanel({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const { data: people, isLoading, isError } = useCompanyPeople(companyId);
  const exportCompany = useExportCompanyData();
  const exportUser = useExportUserData();
  const deleteUser = useDeleteUser(companyId);

  const [toDelete, setToDelete] = useState<CompanyPerson | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function personLabel(person: CompanyPerson) {
    return person.full_name || person.email || person.user_id;
  }

  async function handleCompanyExport(format: ExportFormat) {
    setNotice(null);
    try {
      await exportCompany.mutateAsync({
        companyId,
        fileName: `datenexport-${slugify(companyName)}`,
        format,
      });
    } catch (error) {
      console.error(error);
      setNotice({ kind: "error", text: t.privacy.exportError });
    }
  }

  async function handlePersonExport(person: CompanyPerson, format: ExportFormat) {
    setNotice(null);
    try {
      await exportUser.mutateAsync({
        userId: person.user_id,
        fileName: `datenauskunft-${slugify(personLabel(person))}`,
        format,
      });
    } catch (error) {
      console.error(error);
      setNotice({ kind: "error", text: gdprErrorMessage(error) });
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setNotice(null);
    try {
      const result = await deleteUser.mutateAsync(toDelete.user_id);
      setNotice({
        kind: "success",
        text: result === "anonymized" ? t.privacy.anonymized : t.privacy.deleted,
      });
      setToDelete(null);
    } catch (error) {
      console.error(error);
      setNotice({ kind: "error", text: gdprErrorMessage(error) });
      setToDelete(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
            <FileDown className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold">{t.privacy.companyExportTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.privacy.companyExportHint}</p>
          </div>
        </div>
        <ExportButtons
          onExport={handleCompanyExport}
          disabled={exportCompany.isPending}
          label={t.privacy.companyExportTitle}
        />
      </section>

      {notice && (
        <div
          role="status"
          className={
            notice.kind === "success"
              ? "flex items-center gap-2 rounded-lg bg-success-bg px-3 py-2 text-sm text-success"
              : "flex items-center gap-2 rounded-lg bg-destructive-bg px-3 py-2 text-sm text-destructive"
          }
        >
          {notice.kind === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertTriangle className="size-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
              <Users className="size-4" />
            </div>
            <h2 className="font-heading text-lg font-bold">{t.privacy.peopleTitle}</h2>
          </div>
          {people && (
            <Badge variant="secondary" className="font-semibold">
              {people.length}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t.privacy.peopleHint}</p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : isError ? (
          <p className="text-sm text-destructive">{t.common.error}</p>
        ) : people && people.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {people.map((person) => {
              const blocked = person.delete_blocked_reason;
              return (
                <li
                  key={person.user_id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                      {getInitials(person.full_name, person.email ?? "")}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{personLabel(person)}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {person.full_name && person.email && (
                          <span className="truncate text-xs text-muted-foreground">
                            {person.email}
                          </span>
                        )}
                        {person.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-[11px]">
                            {t.privacy.roles[role]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t.privacy.exportPerson}
                    </span>
                    <ExportButtons
                      onExport={(format) => handlePersonExport(person, format)}
                      disabled={exportUser.isPending}
                      label={`${t.privacy.exportPerson} ${personLabel(person)}`}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={!!blocked || deleteUser.isPending}
                      title={blocked ? t.privacy.blocked[blocked] : undefined}
                      aria-label={`${t.privacy.deletePerson} ${personLabel(person)}`}
                      onClick={() => setToDelete(person)}
                    >
                      <Trash2 className="size-3.5" />
                      <span>{t.privacy.deletePerson}</span>
                    </Button>
                  </div>
                  {blocked && blocked !== "self" && (
                    <p className="text-xs text-muted-foreground sm:hidden">
                      {t.privacy.blocked[blocked]}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {t.privacy.peopleEmpty}
          </p>
        )}
      </section>

      <Drawer
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={t.privacy.deleteConfirmTitle}
        description={toDelete ? personLabel(toDelete) : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm">{t.privacy.deleteConfirmBody}</p>
          <p className="text-sm text-muted-foreground">{t.privacy.deleteConfirmHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
              <span>{t.privacy.deleteConfirmButton}</span>
            </Button>
            <Button type="button" variant="outline" onClick={() => setToDelete(null)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
