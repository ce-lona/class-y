"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  FileText,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  User,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/address-fields";
import {
  ContractStatusBadge,
  formatContractTerms,
  formatContractValidity,
} from "@/components/contract-status-badge";
import { useAuthStore } from "@/store/authStore";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useProfile";
import { useMyContracts, useRespondToContract } from "@/hooks/useContracts";
import { ContractAcceptanceDrawer } from "@/components/contract-acceptance-drawer";
import { BillingDetailsSection } from "@/components/billing-details-section";
import { MailPreferencesSection } from "@/components/mail-preferences-section";
import type { MyContract } from "@/lib/contracts";
import { fillTemplate } from "@/lib/format";
import type { ProfileCountry } from "@/lib/profiles";
import { formatAddress } from "@/lib/address";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { profileSchema, type ProfileFormInput } from "@/lib/validators";
import { t } from "@/i18n/de";

function normalizeCountry(country: string | null | undefined): ProfileCountry {
  return country === "AT" || country === "CH" ? country : "DE";
}

function MyProfileSection({ userEmail }: { userEmail: string | undefined }) {
  const { data: profile, isLoading, isError } = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const [editing, setEditing] = useState(false);
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
      setEditing(false);
      setSaved(true);
    } catch (error) {
      console.error(error);
    }
  }

  const formattedAddress = profile ? formatAddress(profile) : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:flex-nowrap sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
            <User className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold">{t.profile.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t.profile.hint}</p>
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
            <span>{t.profile.saved}</span>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : isError ? (
          <p className="text-sm text-destructive">{t.common.error}</p>
        ) : editing ? (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
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

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || updateProfile.isPending}
                className="gap-1.5"
              >
                <Check className="size-4" />
                <span>{t.common.save}</span>
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                {t.common.cancel}
              </Button>
              {updateProfile.isError && (
                <p className="text-sm text-destructive">{t.profile.saveError}</p>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {getInitials(profile?.full_name, userEmail)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-heading text-base font-bold">
                  {profile?.full_name || t.profile.emptyName}
                </p>
                {userEmail && (
                  <p className="truncate text-sm text-muted-foreground">{userEmail}</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
              <div className="flex items-start gap-2.5 rounded-lg bg-background/60 p-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    {t.profile.phone}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium">
                    {profile?.phone || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-background/60 p-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    {t.profile.addressGroup}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{formattedAddress ?? "—"}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-background/60 p-3">
                <Receipt className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    {t.profile.taxGroup}
                  </div>
                  <div className="mt-1">
                    {profile?.kleinunternehmer ? (
                      <Badge className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
                        {t.profile.kleinunternehmerShort}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{t.profile.regularTax}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MyContractsSection() {
  const { data: contracts, isLoading, isError } = useMyContracts();
  const respond = useRespondToContract();
  const [accepting, setAccepting] = useState<MyContract | null>(null);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3.5 border-b border-border px-5 py-4 sm:px-6">
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
                    <ContractStatusBadge status={c.status} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatContractTerms(c)} · {formatContractValidity(c)}
                  </p>
                  {c.status === "active" && (c.master_data_gaps?.length ?? 0) > 0 && (
                    <p className="text-sm font-medium text-destructive">
                      {t.creditNotes.needsMasterData}:{" "}
                      {c.master_data_gaps
                        .map(
                          (gap) =>
                            t.creditNotes.skipReasons[
                              gap as keyof typeof t.creditNotes.skipReasons
                            ] ?? gap,
                        )
                        .join(", ")}
                    </p>
                  )}
                  {c.status === "active" && (c.master_data_gaps?.length ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {c.confirmed_at
                        ? fillTemplate(t.creditNotes.confirmedAt, {
                            date: new Date(c.confirmed_at).toLocaleDateString("de-DE"),
                          })
                        : t.creditNotes.waitingConfirmation}
                    </p>
                  )}
                </div>
                {c.status === "active" && (c.master_data_gaps?.length ?? 0) > 0 && (
                  <Button size="sm" className="gap-1.5" onClick={() => setAccepting(c)}>
                    <Pencil className="size-3.5" />
                    <span>{t.creditNotes.completeAction}</span>
                  </Button>
                )}
                {c.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={respond.isPending}
                      onClick={() => setAccepting(c)}
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
      <ContractAcceptanceDrawer contract={accepting} onClose={() => setAccepting(null)} />
    </section>
  );
}

type ProfileTab = "profile" | "contracts";

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: myContracts } = useMyContracts();

  const tabParam = searchParams.get("tab");
  const activeTab: ProfileTab = tabParam === "contracts" ? "contracts" : "profile";

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
    myContracts?.filter(
      (c) => c.status === "pending" || (c.status === "active" && (c.master_data_gaps?.length ?? 0) > 0),
    ).length ?? 0;
  const hasContracts = (myContracts?.length ?? 0) > 0;

  function setTab(next: ProfileTab) {
    router.replace(next === "contracts" ? "/profile?tab=contracts" : "/profile", {
      scroll: false,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            {t.profilePage.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.profilePage.subtitle}</p>
        </div>

        <div
          role="tablist"
          className="inline-flex rounded-xl border border-border bg-card p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            onClick={() => setTab("profile")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              activeTab === "profile"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="size-4" />
            <span>{t.profilePage.tabProfile}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "contracts"}
            onClick={() => setTab("contracts")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              activeTab === "contracts"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="size-4" />
            <span>{t.profilePage.tabMyContracts}</span>
            {pendingMyContracts > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold",
                  activeTab === "contracts"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-warning-bg text-warning"
                )}
              >
                {pendingMyContracts}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === "profile" ? (
        <>
          <MyProfileSection userEmail={session.user.email} />
          {hasContracts && <BillingDetailsSection />}
          <MailPreferencesSection />
        </>
      ) : (
        <MyContractsSection />
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
