"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Landmark, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyBillingDetails, useSaveMyBillingDetails } from "@/hooks/useCreditNotes";
import { creditNoteErrorCode, formatIban } from "@/lib/creditNotes";
import { billingDetailsSchema, type BillingDetailsFormInput } from "@/lib/validators";
import { t } from "@/i18n/de";

/** Eigene Abrechnungsdaten (IBAN, Steuernummer, USt-IdNr.) im Profil – nur für die Person selbst sichtbar. */
export function BillingDetailsSection() {
  const { data: details, isLoading, isError } = useMyBillingDetails();
  const save = useSaveMyBillingDetails();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BillingDetailsFormInput>({
    resolver: zodResolver(billingDetailsSchema),
    defaultValues: { iban: "", tax_number: "", vat_id: "" },
  });

  useEffect(() => {
    if (!details) return;
    reset({
      iban: formatIban(details.iban),
      tax_number: details.tax_number ?? "",
      vat_id: details.vat_id ?? "",
    });
  }, [details, reset]);

  async function onSubmit(values: BillingDetailsFormInput) {
    setSaved(false);
    try {
      await save.mutateAsync({
        iban: values.iban || null,
        tax_number: values.tax_number || null,
        vat_id: values.vat_id || null,
      });
      setEditing(false);
      setSaved(true);
    } catch {
      // Fehler wird unten angezeigt.
    }
  }

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: t.creditNotes.ibanLabel, value: formatIban(details?.iban) },
    { label: t.creditNotes.taxNumberLabel, value: details?.tax_number },
    { label: t.creditNotes.pdf.vatId, value: details?.vat_id },
  ];

  const errorKey = save.isError
    ? (creditNoteErrorCode(save.error) as keyof typeof t.creditNotes.errors)
    : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:flex-nowrap sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
            <Landmark className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold">{t.creditNotes.detailsTitle}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t.creditNotes.detailsHint}</p>
          </div>
        </div>
        {!isLoading && !isError && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setSaved(false);
              setEditing((open) => !open);
            }}
          >
            {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
            <span>{editing ? t.common.cancel : t.studioAdmin.edit}</span>
          </Button>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {saved && !editing && (
          <div className="mb-5 flex items-center gap-2 rounded-lg bg-success-bg px-3.5 py-2.5 text-sm font-medium text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{t.creditNotes.detailsSaved}</span>
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : isError ? (
          <p className="text-sm text-destructive">{t.common.error}</p>
        ) : editing ? (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="billing-iban">{t.creditNotes.ibanLabel}</Label>
              <Input id="billing-iban" autoComplete="off" {...register("iban")} />
              {errors.iban && <p className="text-sm text-destructive">{errors.iban.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="billing-tax-number">{t.creditNotes.taxNumberLabel}</Label>
                <Input id="billing-tax-number" autoComplete="off" {...register("tax_number")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing-vat-id">{t.creditNotes.vatIdLabel}</Label>
                <Input id="billing-vat-id" autoComplete="off" {...register("vat_id")} />
              </div>
            </div>
            {errorKey && <p className="text-sm text-destructive">{t.creditNotes.errors[errorKey]}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || save.isPending}>
                {t.common.save}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            {rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  {row.label}
                </dt>
                <dd className="mt-1 truncate text-sm font-medium">{row.value || "–"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
