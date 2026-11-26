"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Building2, CheckCircle2, Receipt } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/address-fields";
import { useBillingSettings, useSaveBillingSettings } from "@/hooks/useCreditNotes";
import { useUpdateCompanyAddress } from "@/hooks/useCompanies";
import type { ManagedCompany } from "@/lib/companyAdmins";
import { creditNoteErrorCode } from "@/lib/creditNotes";
import { fillTemplate } from "@/lib/format";
import { addressFields } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const settingsSchema = z.object({
  mode: z.enum(["manual", "scheduled"]),
  run_day: z.coerce.number().int().min(1).max(28),
  review_days: z.coerce.number().int().min(1).max(14),
  split_by_studio: z.boolean(),
  employee_statements: z.boolean(),
  payment_days: z.coerce.number().int().min(0).max(90),
  number_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/, t.creditNotes.prefixInvalid),
});
type SettingsForm = z.input<typeof settingsSchema>;
type SettingsValues = z.output<typeof settingsSchema>;

const addressSchema = z.object({
  name: z.string().trim().min(1, t.companies.nameRequired),
  ...addressFields,
});
type AddressForm = z.infer<typeof addressSchema>;

function normalizeCountry(country: string | null | undefined): "DE" | "AT" | "CH" {
  return country === "AT" || country === "CH" ? country : "DE";
}

function Toggle({
  id,
  label,
  hint,
  disabled,
  ...props
}: { id: string; label: string; hint: string; disabled: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3.5",
        !disabled && "cursor-pointer hover:border-primary-300 dark:hover:border-primary-700",
      )}
    >
      <input id={id} type="checkbox" className="mt-0.5 size-4 accent-primary" disabled={disabled} {...props} />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function CompanyAddressCard({ company, canEdit }: { company: ManagedCompany; canEdit: boolean }) {
  const update = useUpdateCompanyAddress(company.id);
  const [saved, setSaved] = useState(false);
  const { register, control, handleSubmit, reset, formState } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      name: company.name,
      street: company.street ?? "",
      house_number: company.house_number ?? "",
      postal_code: company.postal_code ?? "",
      city: company.city ?? "",
      country: normalizeCountry(company.country),
    },
  });

  useEffect(() => {
    reset({
      name: company.name,
      street: company.street ?? "",
      house_number: company.house_number ?? "",
      postal_code: company.postal_code ?? "",
      city: company.city ?? "",
      country: normalizeCountry(company.country),
    });
  }, [company, reset]);

  async function onSubmit(values: AddressForm) {
    setSaved(false);
    const clean = (v: string | undefined) => (v?.trim() ? v.trim() : null);
    await update.mutateAsync({
      name: values.name.trim(),
      street: clean(values.street),
      house_number: clean(values.house_number),
      postal_code: clean(values.postal_code),
      city: clean(values.city),
      country: values.country,
    });
    setSaved(true);
  }

  return (
    <section id="company-address" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3.5">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
          <Building2 className="size-4" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold">{t.creditNotes.companyAddressTitle}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.creditNotes.companyAddressHint}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">{t.creditNotes.companyNameLabel}</Label>
            <Input id="company-name" {...register("name")} />
            {formState.errors.name && (
              <p className="text-sm text-destructive">{formState.errors.name.message}</p>
            )}
          </div>
          <AddressFields register={register} control={control} />
        </fieldset>
        {saved && (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" />
            {t.creditNotes.companyAddressSaved}
          </p>
        )}
        {update.isError && <p className="text-sm text-destructive">{t.creditNotes.errors.generic}</p>}
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={formState.isSubmitting}>
              {t.common.save}
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}

/** Einstellungen → Abrechnung. Nur Company-Admins bearbeiten, Koordinator:innen sehen lesend. */
export function BillingSettingsPanel({ company }: { company: ManagedCompany }) {
  const { data: settings, isLoading, isError } = useBillingSettings(company.id);
  const save = useSaveBillingSettings(company.id);
  const [saved, setSaved] = useState(false);
  const canEdit = settings?.can_edit ?? false;

  const { register, control, handleSubmit, reset, formState } = useForm<SettingsForm, unknown, SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      mode: "manual",
      run_day: 1,
      review_days: 3,
      split_by_studio: false,
      employee_statements: false,
      payment_days: 10,
      number_prefix: "GS",
    },
  });
  const mode = useWatch({ control, name: "mode" });
  const prefix = useWatch({ control, name: "number_prefix" });

  useEffect(() => {
    if (!settings) return;
    reset({
      mode: settings.mode,
      run_day: settings.run_day,
      review_days: settings.review_days,
      split_by_studio: settings.split_by_studio,
      employee_statements: settings.employee_statements,
      payment_days: settings.payment_days,
      number_prefix: settings.number_prefix,
    });
  }, [settings, reset]);

  async function onSubmit(values: SettingsValues) {
    setSaved(false);
    try {
      await save.mutateAsync(values);
      setSaved(true);
    } catch {
      // Fehler wird unten angezeigt.
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (isError || !settings) return <p className="text-sm text-destructive">{t.common.error}</p>;

  const errorKey = save.isError
    ? (creditNoteErrorCode(save.error) as keyof typeof t.creditNotes.errors)
    : null;
  const example = `${(prefix || "GS").toUpperCase()}-${new Date().getFullYear()}-00001`;

  return (
    <div className="flex flex-col gap-6">
      {!settings.billing_address_complete && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{t.creditNotes.addressMissingSettings}</p>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3.5">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
            <Receipt className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold">{t.creditNotes.settingsTitle}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {canEdit ? t.creditNotes.settingsHint : t.creditNotes.settingsReadOnly}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <fieldset disabled={!canEdit} className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t.creditNotes.modeLabel}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["manual", "scheduled"] as const).map((value) => (
                  <label
                    key={value}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-sm",
                      mode === value ? "border-primary bg-primary-50/50 dark:bg-primary-900/20" : "border-border",
                      canEdit && "cursor-pointer",
                    )}
                  >
                    <input type="radio" value={value} className="accent-primary" {...register("mode")} />
                    <span>
                      {value === "manual" ? t.creditNotes.modeManualOption : t.creditNotes.modeScheduledOption}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {mode === "scheduled" && (
                <div className="space-y-1.5">
                  <Label htmlFor="run_day">{t.creditNotes.runDayLabel}</Label>
                  <Input id="run_day" type="number" min={1} max={28} {...register("run_day")} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="review_days">{t.creditNotes.reviewDaysLabel}</Label>
                <Input id="review_days" type="number" min={1} max={14} {...register("review_days")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment_days">{t.creditNotes.paymentDaysLabel}</Label>
                <Input id="payment_days" type="number" min={0} max={90} {...register("payment_days")} />
              </div>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">{t.creditNotes.reviewDaysHint}</p>

            <Toggle
              id="split_by_studio"
              label={t.creditNotes.splitLabel}
              hint={t.creditNotes.splitHint}
              disabled={!canEdit}
              {...register("split_by_studio")}
            />
            <Toggle
              id="employee_statements"
              label={t.creditNotes.statementsLabel}
              hint={t.creditNotes.statementsHint}
              disabled={!canEdit}
              {...register("employee_statements")}
            />

            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="number_prefix">{t.creditNotes.prefixLabel}</Label>
              <Input id="number_prefix" maxLength={8} {...register("number_prefix")} />
              {formState.errors.number_prefix ? (
                <p className="text-sm text-destructive">{formState.errors.number_prefix.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {fillTemplate(t.creditNotes.prefixHint, { example })}
                </p>
              )}
            </div>
          </fieldset>

          {saved && (
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" />
              {t.creditNotes.saved}
            </p>
          )}
          {errorKey && <p className="text-sm text-destructive">{t.creditNotes.errors[errorKey]}</p>}
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" disabled={formState.isSubmitting || save.isPending}>
                {t.common.save}
              </Button>
            </div>
          )}
        </form>
      </section>

      <CompanyAddressCard company={company} canEdit={canEdit} />
    </div>
  );
}
