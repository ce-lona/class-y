"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import {
  useCompanyContracts,
  useEndContract,
  useMyContracts,
  useOfferContract,
  useRespondToContract,
} from "@/hooks/useContracts";
import type { ContractStatus } from "@/lib/contracts";
import {
  employmentTypeOptions,
  offerContractSchema,
  parseRateAmount,
  rateModelOptions,
  type OfferContractFormInput,
} from "@/lib/validators";
import { t } from "@/i18n/de";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const statusVariant: Record<ContractStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  active: "default",
  ended: "outline",
  declined: "destructive",
};

function StatusBadge({ status }: { status: ContractStatus }) {
  return <Badge variant={statusVariant[status]}>{t.contracts.status[status]}</Badge>;
}

function describeContract(c: {
  employment_type: string;
  rate_model: string;
  rate_amount: number;
  valid_from: string;
  valid_to: string | null;
}) {
  const employment =
    t.contracts.employmentTypes[c.employment_type as keyof typeof t.contracts.employmentTypes] ??
    c.employment_type;
  const model =
    t.contracts.rateModels[c.rate_model as keyof typeof t.contracts.rateModels] ?? c.rate_model;
  const amount = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    Number(c.rate_amount)
  );
  const range = c.valid_to
    ? `${t.contracts.validity} ${c.valid_from} ${t.contracts.until} ${c.valid_to}`
    : `${t.contracts.validity} ${c.valid_from}`;
  return `${employment} · ${amount} ${model} · ${range}`;
}

function MyContractsSection() {
  const { data: contracts, isLoading, isError } = useMyContracts();
  const respond = useRespondToContract();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t.contracts.myTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.contracts.myHint}</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t.common.loading}</p>
      ) : isError ? (
        <p className="text-destructive">{t.common.error}</p>
      ) : contracts && contracts.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border">
          {contracts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-2 font-medium">
                  {c.company_name} <StatusBadge status={c.status} />
                </p>
                <p className="text-sm text-muted-foreground">{describeContract(c)}</p>
              </div>
              {c.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: c.id, accept: true })}
                  >
                    {t.contracts.accept}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: c.id, accept: false })}
                  >
                    {t.contracts.decline}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t.contracts.myEmpty}</p>
      )}

      {respond.isError && <p className="text-sm text-destructive">{t.contracts.respondError}</p>}
    </section>
  );
}

function CompanyContractsSection({ companyId }: { companyId: string }) {
  const { data: contracts, isLoading, isError } = useCompanyContracts(companyId);
  const offer = useOfferContract(companyId);
  const end = useEndContract(companyId);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OfferContractFormInput>({
    resolver: zodResolver(offerContractSchema),
    defaultValues: { employmentType: "freelancer", rateModel: "per_course" },
  });

  async function onSubmit(values: OfferContractFormInput) {
    setSuccess(false);
    try {
      await offer.mutateAsync({
        companyId,
        email: values.email,
        employmentType: values.employmentType,
        rateModel: values.rateModel,
        rateAmount: parseRateAmount(values.rateAmount),
        validFrom: values.validFrom,
        validTo: values.validTo || null,
      });
      setSuccess(true);
      reset();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "";
      setError("email", {
        message: message.includes("user_not_found")
          ? t.contracts.userNotFound
          : t.contracts.offerError,
      });
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t.contracts.companyTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.contracts.companyHint}</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
      >
        <h3 className="text-sm font-semibold sm:col-span-2">{t.contracts.offerTitle}</h3>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="contract-email">{t.contracts.email}</Label>
          <Input id="contract-email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contract-employment">{t.contracts.employmentType}</Label>
          <select id="contract-employment" className={selectClassName} {...register("employmentType")}>
            {employmentTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contract-model">{t.contracts.rateModel}</Label>
          <select id="contract-model" className={selectClassName} {...register("rateModel")}>
            {rateModelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contract-amount">{t.contracts.rateAmount}</Label>
          <Input id="contract-amount" inputMode="decimal" {...register("rateAmount")} />
          {errors.rateAmount && (
            <p className="text-sm text-destructive">{errors.rateAmount.message}</p>
          )}
        </div>

        <div className="hidden sm:block" />

        <div className="space-y-1.5">
          <Label htmlFor="contract-from">{t.contracts.validFrom}</Label>
          <Input id="contract-from" type="date" {...register("validFrom")} />
          {errors.validFrom && (
            <p className="text-sm text-destructive">{errors.validFrom.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contract-to">{t.contracts.validTo}</Label>
          <Input id="contract-to" type="date" {...register("validTo")} />
          {errors.validTo && <p className="text-sm text-destructive">{errors.validTo.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            {t.contracts.offer}
          </Button>
          {success && <p className="mt-2 text-sm text-success">{t.contracts.offered}</p>}
        </div>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">{t.common.loading}</p>
      ) : isError ? (
        <p className="text-destructive">{t.common.error}</p>
      ) : contracts && contracts.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border">
          {contracts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-2 font-medium">
                  {c.trainer_name || c.trainer_email} <StatusBadge status={c.status} />
                </p>
                {c.trainer_name && (
                  <p className="text-sm text-muted-foreground">{c.trainer_email}</p>
                )}
                <p className="text-sm text-muted-foreground">{describeContract(c)}</p>
              </div>
              {(c.status === "active" || c.status === "pending") && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={end.isPending}
                  onClick={() => end.mutate(c.id)}
                >
                  {c.status === "pending" ? t.contracts.withdraw : t.contracts.end}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t.contracts.companyEmpty}</p>
      )}

      {end.isError && <p className="text-sm text-destructive">{t.contracts.endError}</p>}
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: myCompany } = useMyCompany();

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login");
    }
  }, [sessionLoading, session, router]);

  if (sessionLoading || !session) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
      <MyContractsSection />
      {myCompany && <CompanyContractsSection companyId={myCompany.id} />}
    </div>
  );
}
