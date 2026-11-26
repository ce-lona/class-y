"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/address-fields";
import { useMyProfile } from "@/hooks/useProfile";
import { useAcceptContractWithMasterData, useMyBillingDetails } from "@/hooks/useCreditNotes";
import { creditNoteErrorCode, formatIban } from "@/lib/creditNotes";
import type { MyContract } from "@/lib/contracts";
import {
  contractMasterDataSchema,
  type ContractMasterDataFormInput,
} from "@/lib/validators";
import { fillTemplate as fill } from "@/lib/format";
import { t } from "@/i18n/de";

/**
 * Vertragsannahme mit Pflicht-Stammdaten (und bei Freiberufler:innen Zustimmung zum
 * Gutschriftverfahren). Dient auch zum Ergänzen fehlender Daten bei aktiven Verträgen.
 */
export function ContractAcceptanceDrawer({
  contract,
  onClose,
}: {
  contract: MyContract | null;
  onClose: () => void;
}) {
  const { data: profile } = useMyProfile();
  const { data: details } = useMyBillingDetails();
  const accept = useAcceptContractWithMasterData();
  const isFreelancer = contract?.employment_type === "freelancer";
  const isCompletion = contract?.status === "active";

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContractMasterDataFormInput>({
    resolver: zodResolver(contractMasterDataSchema(isFreelancer)),
    defaultValues: {
      full_name: "",
      street: "",
      house_number: "",
      postal_code: "",
      city: "",
      country: "DE",
      iban: "",
      tax_number: "",
      vat_id: "",
      kleinunternehmer: false,
      consent: false,
    },
  });

  useEffect(() => {
    if (!contract) return;
    accept.reset();
    reset({
      full_name: profile?.full_name ?? "",
      street: profile?.street ?? "",
      house_number: profile?.house_number ?? "",
      postal_code: profile?.postal_code ?? "",
      city: profile?.city ?? "",
      country: profile?.country ?? "DE",
      iban: formatIban(details?.iban),
      tax_number: details?.tax_number ?? "",
      vat_id: details?.vat_id ?? "",
      kleinunternehmer: profile?.kleinunternehmer ?? false,
      consent: !!contract.credit_note_consent_at,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.id, profile, details, reset]);

  async function onSubmit(values: ContractMasterDataFormInput) {
    if (!contract) return;
    try {
      await accept.mutateAsync({
        contractId: contract.id,
        fullName: values.full_name,
        street: values.street,
        houseNumber: values.house_number,
        postalCode: values.postal_code,
        city: values.city,
        iban: values.iban,
        taxNumber: values.tax_number || null,
        vatId: values.vat_id || null,
        kleinunternehmer: isFreelancer ? values.kleinunternehmer : false,
        consent: isFreelancer ? values.consent : false,
      });
      onClose();
    } catch {
      // Fehler wird unten angezeigt.
    }
  }

  const company = contract?.company_name ?? "";
  const errorKey = accept.isError
    ? (creditNoteErrorCode(accept.error) as keyof typeof t.creditNotes.errors)
    : null;

  return (
    <Drawer
      open={!!contract}
      onClose={onClose}
      title={isCompletion ? t.creditNotes.completeTitle : t.creditNotes.acceptTitle}
      description={fill(isCompletion ? t.creditNotes.completeHint : t.creditNotes.acceptHint, {
        company,
      })}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t.profile.fullName}</Label>
          <Input id="full_name" autoComplete="name" {...register("full_name")} />
          {errors.full_name && (
            <p className="text-sm text-destructive">{errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-4">
          <AddressFields register={register} control={control} />
          {errors.street && <p className="text-sm text-destructive">{errors.street.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="iban">{t.creditNotes.ibanLabel}</Label>
          <Input
            id="iban"
            autoComplete="off"
            placeholder="DE00 0000 0000 0000 0000 00"
            {...register("iban")}
          />
          {errors.iban && <p className="text-sm text-destructive">{errors.iban.message}</p>}
        </div>

        {isFreelancer && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tax_number">{t.creditNotes.taxNumberLabel}</Label>
                <Input id="tax_number" autoComplete="off" {...register("tax_number")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vat_id">{t.creditNotes.vatIdLabel}</Label>
                <Input id="vat_id" autoComplete="off" {...register("vat_id")} />
              </div>
            </div>
            {errors.tax_number && (
              <p className="-mt-3 text-sm text-destructive">{errors.tax_number.message}</p>
            )}

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                {...register("kleinunternehmer")}
              />
              <span>{t.creditNotes.kleinunternehmerConfirm}</span>
            </label>

            <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  {...register("consent")}
                  data-testid="credit-note-consent"
                />
                <span>{fill(t.creditNotes.consentLabel, { company })}</span>
              </label>
              {errors.consent && (
                <p className="text-sm text-destructive">{errors.consent.message}</p>
              )}
            </div>
          </>
        )}

        {errorKey && (
          <p className="text-sm text-destructive">{t.creditNotes.errors[errorKey]}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={isSubmitting || accept.isPending}>
            {isCompletion ? t.creditNotes.completeSubmit : t.creditNotes.acceptSubmit}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
