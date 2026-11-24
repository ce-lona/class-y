"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Check,
  CheckCircle2,
  FileText,
  MapPin,
  Receipt,
  Send,
  User,
  X,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressFields } from "@/components/address-fields";
import { useAuthStore } from "@/store/authStore";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useProfile";
import {
  useCompanyContracts,
  useEndContract,
  useMyContracts,
  useOfferContract,
  useRespondToContract,
} from "@/hooks/useContracts";
import type { ContractStatus } from "@/lib/contracts";
import type { ProfileCountry } from "@/lib/profiles";
import { formatDateDE, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  employmentTypeOptions,
  offerContractSchema,
  parseRateAmount,
  profileSchema,
  rateModelOptions,
  type OfferContractFormInput,
  type ProfileFormInput,
} from "@/lib/validators";
import { t } from "@/i18n/de";

const statusStyles: Record<ContractStatus, { badge: string; dot: string }> = {
  pending: {
    badge: "bg-warning-bg text-warning",
    dot: "bg-warning",
  },
  active: {
    badge: "bg-success-bg text-success",
    dot: "bg-success",
  },
  ended: {
    badge: "border border-border bg-muted/60 text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  declined: {
    badge: "bg-destructive-bg text-destructive",
    dot: "bg-destructive",
  },
};

function StatusBadge({ status }: { status: ContractStatus }) {
  const style = statusStyles[status];
  return (
    <Badge className={cn("gap-1.5", style.badge)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" />
      <span>{t.contracts.status[status]}</span>
    </Badge>
  );
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
  const from = formatDateDE(c.valid_from);
  const range = c.valid_to
    ? `${t.contracts.validity} ${from} ${t.contracts.until} ${formatDateDE(c.valid_to)}`
    : `${t.contracts.validity} ${from}`;
  return `${employment} · ${amount} ${model} · ${range}`;
}

function normalizeCountry(country: string | null | undefined): ProfileCountry {
  return country === "AT" || country === "CH" ? country : "DE";
}

function MyProfileSection() {
  const { data: profile, isLoading, isError } = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const [saved, setSaved] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      street: "",
      house_number: "",
      postal_code: "",
      city: "",
      country: "DE",
      kleinunternehmer: false,
    },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      street: profile.street ?? "",
      house_number: profile.house_number ?? "",
      postal_code: profile.postal_code ?? "",
      city: profile.city ?? "",
      country: normalizeCountry(profile.country),
      kleinunternehmer: profile.kleinunternehmer,
    });
  }, [profile, reset]);

  async function onSubmit(values: ProfileFormInput) {
    setSaved(false);
    try {
      await updateProfile.mutateAsync({
        full_name: values.full_name,
        phone: values.phone ?? null,
        street: values.street ?? null,
        house_number: values.house_number ?? null,
        postal_code: values.postal_code ?? null,
        city: values.city ?? null,
        country: values.country,
        kleinunternehmer: values.kleinunternehmer,
      });
      setSaved(true);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <section
      id="profile"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-start gap-3.5 border-b border-border px-5 py-4 sm:px-6">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
          <User className="size-4" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold">{t.profile.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.profile.hint}</p>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : isError ? (
          <p className="text-sm text-destructive">{t.common.error}</p>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            onChange={() => saved && setSaved(false)}
            noValidate
            className="space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                <User className="size-3.5" />
                <span>{t.profile.contactGroup}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-full-name">{t.profile.fullName}</Label>
                  <Input
                    id="profile-full-name"
                    autoComplete="name"
                    {...register("full_name")}
                  />
                  {errors.full_name && (
                    <p className="text-sm text-destructive">{errors.full_name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-phone">{t.profile.phone}</Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    autoComplete="tel"
                    {...register("phone")}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                <MapPin className="size-3.5" />
                <span>{t.profile.addressGroup}</span>
              </div>
              <AddressFields register={register} control={control} />
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                <Receipt className="size-3.5" />
                <span>{t.profile.taxGroup}</span>
              </div>
              <label
                htmlFor="profile-kleinunternehmer"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/60 p-3.5 transition-colors hover:border-primary-300 dark:hover:border-primary-700"
              >
                <input
                  id="profile-kleinunternehmer"
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-input accent-primary"
                  {...register("kleinunternehmer")}
                />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">{t.profile.kleinunternehmer}</span>
                  <p className="text-xs text-muted-foreground">
                    {t.profile.kleinunternehmerHint}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || updateProfile.isPending}
                className="gap-1.5"
              >
                <Check className="size-4" />
                <span>{t.common.save}</span>
              </Button>
              {saved && (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-success-bg px-3 py-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" />
                  <span>{t.profile.saved}</span>
                </div>
              )}
              {updateProfile.isError && (
                <p className="text-sm text-destructive">{t.profile.saveError}</p>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function MyContractsSection() {
  const { data: contracts, isLoading, isError } = useMyContracts();
  const respond = useRespondToContract();

  return (
    <section
      id="my-contracts"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
            <FileText className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-bold">{t.contracts.myTitle}</h2>
              {contracts && contracts.length > 0 && (
                <Badge variant="secondary" className="font-semibold">
                  {contracts.length}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{t.contracts.myHint}</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : isError ? (
          <p className="text-sm text-destructive">{t.common.error}</p>
        ) : contracts && contracts.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {contracts.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span>{c.company_name}</span>
                    <StatusBadge status={c.status} />
                  </p>
                  <p className="text-sm text-muted-foreground">{describeContract(c)}</p>
                </div>
                {c.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: c.id, accept: true })}
                    >
                      <Check className="size-3.5" />
                      <span>{t.contracts.accept}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: c.id, accept: false })}
                    >
                      <X className="size-3.5" />
                      <span>{t.contracts.decline}</span>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            <FileText className="size-4 shrink-0 opacity-50" />
            <p>{t.contracts.myEmpty}</p>
          </div>
        )}

        {respond.isError && (
          <p className="mt-3 text-sm text-destructive">{t.contracts.respondError}</p>
        )}
      </div>
    </section>
  );
}

type ContractFilter = "all" | "active" | "pending" | "archived";

function CompanyContractsSection({ companyId }: { companyId: string }) {
  const { data: contracts, isLoading, isError } = useCompanyContracts(companyId);
  const offer = useOfferContract(companyId);
  const end = useEndContract(companyId);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContractFilter>("all");

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OfferContractFormInput>({
    resolver: zodResolver(offerContractSchema),
    defaultValues: { employmentType: "freelancer", rateModel: "per_course" },
  });

  async function onSubmit(values: OfferContractFormInput) {
    setSuccess(null);
    try {
      const result = await offer.mutateAsync({
        companyId,
        email: values.email,
        employmentType: values.employmentType,
        rateModel: values.rateModel,
        rateAmount: parseRateAmount(values.rateAmount),
        validFrom: values.validFrom,
        validTo: values.validTo || null,
      });
      setSuccess(result.invited ? t.contracts.invited : t.contracts.offered);
      reset();
    } catch (error) {
      console.error(error);
      setError("email", { message: t.contracts.offerError });
    }
  }

  const counts = {
    all: contracts?.length ?? 0,
    active: contracts?.filter((c) => c.status === "active").length ?? 0,
    pending: contracts?.filter((c) => c.status === "pending").length ?? 0,
    archived:
      contracts?.filter((c) => c.status === "ended" || c.status === "declined").length ?? 0,
  };

  const filteredContracts =
    contracts?.filter((c) => {
      if (filter === "active") return c.status === "active";
      if (filter === "pending") return c.status === "pending";
      if (filter === "archived") return c.status === "ended" || c.status === "declined";
      return true;
    }) ?? [];

  const filterTabs: { id: ContractFilter; label: string; count: number }[] = [
    { id: "all", label: t.contracts.filters.all, count: counts.all },
    { id: "active", label: t.contracts.filters.active, count: counts.active },
    { id: "pending", label: t.contracts.filters.pending, count: counts.pending },
    { id: "archived", label: t.contracts.filters.archived, count: counts.archived },
  ];

  return (
    <section
      id="company-contracts"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-start gap-3.5 border-b border-border px-5 py-4 sm:px-6">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
          <Briefcase className="size-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-bold">{t.contracts.companyTitle}</h2>
            {contracts && (
              <Badge variant="secondary" className="font-semibold">
                {contracts.length}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.contracts.companyHint}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-4 border-b border-border bg-background/50 p-5 sm:grid-cols-2 sm:p-6"
      >
        <div className="flex items-center gap-2 sm:col-span-2">
          <Send className="size-4 text-primary" />
          <h3 className="font-heading text-sm font-bold">{t.contracts.offerTitle}</h3>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="contract-email">{t.contracts.email}</Label>
          <Input id="contract-email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contract-employment">{t.contracts.employmentType}</Label>
          <Controller
            control={control}
            name="employmentType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="contract-employment" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      employmentTypeOptions.find((option) => option.value === value)?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employmentTypeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contract-model">{t.contracts.rateModel}</Label>
          <Controller
            control={control}
            name="rateModel"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="contract-model" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      rateModelOptions.find((option) => option.value === value)?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {rateModelOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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

        <div className="flex flex-wrap items-center gap-3 pt-1 sm:col-span-2">
          <Button type="submit" disabled={isSubmitting} className="gap-1.5">
            <Send className="size-4" />
            <span>{t.contracts.offer}</span>
          </Button>
          {success && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-success-bg px-3 py-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>
      </form>

      <div className="space-y-4 p-5 sm:p-6">
        {contracts && contracts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map((tab) => {
              const selected = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                      selected ? "bg-primary-foreground/20" : "bg-background text-foreground"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : isError ? (
          <p className="text-sm text-destructive">{t.common.error}</p>
        ) : contracts && contracts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            <Briefcase className="size-4 shrink-0 opacity-50" />
            <p>{t.contracts.companyEmpty}</p>
          </div>
        ) : filteredContracts.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {filteredContracts.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 sm:flex dark:bg-primary-900/60 dark:text-primary-200">
                    {getInitials(c.trainer_name, c.trainer_email)}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="break-all">{c.trainer_name || c.trainer_email}</span>
                      <StatusBadge status={c.status} />
                    </p>
                    {c.trainer_name && (
                      <p className="truncate text-xs text-muted-foreground">{c.trainer_email}</p>
                    )}
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      {describeContract(c)}
                    </p>
                  </div>
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
          <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            {t.contracts.companyFilterEmpty}
          </p>
        )}

        {end.isError && <p className="text-sm text-destructive">{t.contracts.endError}</p>}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: myCompany } = useMyCompany();
  const { data: myContracts } = useMyContracts();

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

  const pendingMyContracts =
    myContracts?.filter((c) => c.status === "pending").length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-7 px-4 py-6 sm:px-8 sm:py-10">
      <div className="space-y-4">
        <div>
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
            {t.settings.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.settings.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="#profile"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary-300 hover:text-primary"
          >
            <User className="size-3.5 text-primary" />
            <span>{t.settings.jumpProfile}</span>
          </a>
          <a
            href="#my-contracts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary-300 hover:text-primary"
          >
            <FileText className="size-3.5 text-primary" />
            <span>{t.settings.jumpMyContracts}</span>
            {pendingMyContracts > 0 && (
              <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-[11px] leading-none text-warning">
                {pendingMyContracts}
              </span>
            )}
          </a>
          {myCompany && (
            <a
              href="#company-contracts"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary-300 hover:text-primary"
            >
              <Briefcase className="size-3.5 text-primary" />
              <span>{t.settings.jumpCompanyContracts}</span>
            </a>
          )}
        </div>
      </div>

      <MyProfileSection />
      <MyContractsSection />
      {myCompany && <CompanyContractsSection companyId={myCompany.id} />}
    </div>
  );
}
