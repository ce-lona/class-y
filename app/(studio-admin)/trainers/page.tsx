"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Plus,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContractStatusBadge,
  formatContractTerms,
  formatContractValidity,
} from "@/components/contract-status-badge";
import {
  NoSearchResults,
  SearchInput,
  StudioFilterChips,
  matchesSearch,
} from "@/components/list-toolbar";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useCompanyContracts, useEndContract, useOfferContract } from "@/hooks/useContracts";
import {
  useCompanyCoordinators,
  useInviteStudioCoordinator,
  useUpdateCoordinatorStudios,
} from "@/hooks/useCoordinators";
import { useStudios } from "@/hooks/useStudios";
import type { CompanyCoordinator } from "@/lib/coordinators";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  employmentTypeOptions,
  offerContractSchema,
  parseRateAmount,
  rateModelOptions,
  suggestEmailTypo,
  type OfferContractFormInput,
} from "@/lib/validators";
import { t } from "@/i18n/de";

type ContractFilter = "activeOpen" | "active" | "pending" | "archived" | "all";
type TeamSection = "contracts" | "coordinators";

export default function TrainersPage() {
  const { data: company } = useMyCompany();
  const companyId = company?.id ?? "";
  const isFullAdmin = company?.role !== "coordinator";

  const { data: contracts, isLoading, isError } = useCompanyContracts(companyId);
  const { data: studios } = useStudios(companyId);
  const { data: coordinators, isLoading: coordsLoading } = useCompanyCoordinators(
    companyId,
    isFullAdmin
  );

  const offer = useOfferContract(companyId);
  const end = useEndContract(companyId);
  const inviteCoordinator = useInviteStudioCoordinator(companyId);
  const updateCoordinatorStudios = useUpdateCoordinatorStudios(companyId);

  const [section, setSection] = useState<TeamSection>("contracts");
  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContractFilter>("activeOpen");
  const [studioFilter, setStudioFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Studio scope for new contract
  const [contractRestricted, setContractRestricted] = useState(false);
  const [contractStudioIds, setContractStudioIds] = useState<string[]>([]);
  const [contractScopeError, setContractScopeError] = useState<string | null>(null);

  // Coordinator invite / edit drawers
  const [coordInviteOpen, setCoordInviteOpen] = useState(false);
  const [coordEmail, setCoordEmail] = useState("");
  const [coordStudioIds, setCoordStudioIds] = useState<string[]>([]);
  const [coordError, setCoordError] = useState<string | null>(null);

  const [editingCoord, setEditingCoord] = useState<CompanyCoordinator | null>(null);
  const [editCoordStudioIds, setEditCoordStudioIds] = useState<string[]>([]);
  const [editCoordError, setEditCoordError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OfferContractFormInput>({
    resolver: zodResolver(offerContractSchema),
    defaultValues: { employmentType: "freelancer", rateModel: "per_course" },
  });

  const watchedEmail = useWatch({ control, name: "email" }) ?? "";
  const emailSuggestion = suggestEmailTypo(watchedEmail);
  const coordEmailSuggestion = suggestEmailTypo(coordEmail);

  const studioNameMap = new Map((studios ?? []).map((s) => [s.id, s.name]));

  function openContractDrawer() {
    setSuccess(null);
    setContractScopeError(null);
    if (!isFullAdmin && studios && studios.length > 0) {
      setContractRestricted(true);
      setContractStudioIds(studios.map((s) => s.id));
    } else {
      setContractRestricted(false);
      setContractStudioIds([]);
    }
    setFormOpen(true);
  }

  function closeContractDrawer() {
    reset();
    setContractRestricted(false);
    setContractStudioIds([]);
    setContractScopeError(null);
    setFormOpen(false);
  }

  async function onSubmit(values: OfferContractFormInput) {
    if (!company) return;
    setSuccess(null);
    setContractScopeError(null);

    const needsStudios = !isFullAdmin || contractRestricted;
    if (needsStudios && contractStudioIds.length === 0) {
      setContractScopeError(t.contracts.selectAtLeastOneStudio);
      return;
    }

    try {
      const result = await offer.mutateAsync({
        companyId: company.id,
        email: values.email,
        employmentType: values.employmentType,
        rateModel: values.rateModel,
        rateAmount: parseRateAmount(values.rateAmount),
        validFrom: values.validFrom,
        validTo: values.validTo || null,
        studioIds: needsStudios ? contractStudioIds : undefined,
      });
      setSuccess(result.invited ? t.contracts.invited : t.contracts.offered);
      closeContractDrawer();
      if (filter === "archived") {
        setFilter("activeOpen");
      }
    } catch (error) {
      console.error(error);
      setError("email", { message: t.contracts.offerError });
    }
  }

  async function handleInviteCoordinator(e: React.FormEvent) {
    e.preventDefault();
    setCoordError(null);
    setSuccess(null);
    if (!coordEmail.trim()) {
      setCoordError(t.auth.emailRequired);
      return;
    }
    if (coordStudioIds.length === 0) {
      setCoordError(t.coordinators.selectAtLeastOne);
      return;
    }
    try {
      const result = await inviteCoordinator.mutateAsync({
        email: coordEmail.trim(),
        studioIds: coordStudioIds,
      });
      setSuccess(result.invited ? t.coordinators.invitedSuccess : t.coordinators.assignedSuccess);
      setCoordEmail("");
      setCoordStudioIds([]);
      setCoordInviteOpen(false);
    } catch (error) {
      console.error(error);
      setCoordError(t.coordinators.error);
    }
  }

  async function handleSaveCoordinatorStudios(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCoord) return;
    setEditCoordError(null);
    setSuccess(null);
    try {
      await updateCoordinatorStudios.mutateAsync({
        email: editingCoord.email,
        studioIds: editCoordStudioIds,
      });
      setSuccess(
        editCoordStudioIds.length === 0
          ? t.coordinators.removedSuccess
          : t.coordinators.assignedSuccess
      );
      setEditingCoord(null);
    } catch (error) {
      console.error(error);
      setEditCoordError(t.coordinators.error);
    }
  }

  async function handleRemoveCoordinator() {
    if (!editingCoord) return;
    setEditCoordError(null);
    setSuccess(null);
    try {
      await updateCoordinatorStudios.mutateAsync({
        email: editingCoord.email,
        studioIds: [],
      });
      setSuccess(t.coordinators.removedSuccess);
      setEditingCoord(null);
    } catch (error) {
      console.error(error);
      setEditCoordError(t.coordinators.error);
    }
  }

  // Contracts ohne Studio-Einschränkung gelten für alle Studios der Company.
  const contractMatchesStudio = (studioIds: string[] | null | undefined) =>
    studioFilter === "all" || !studioIds || studioIds.length === 0 || studioIds.includes(studioFilter);

  const studioNamesFor = (studioIds: string[] | null | undefined) =>
    (studioIds ?? []).map((sid) => studioNameMap.get(sid)).filter((n): n is string => Boolean(n));

  const contractsInScope =
    contracts?.filter(
      (c) =>
        contractMatchesStudio(c.studio_ids) &&
        matchesSearch(search, c.trainer_name, c.trainer_email, ...studioNamesFor(c.studio_ids))
    ) ?? [];

  const counts = {
    activeOpen:
      contractsInScope.filter((c) => c.status === "active" || c.status === "pending").length,
    active: contractsInScope.filter((c) => c.status === "active").length,
    pending: contractsInScope.filter((c) => c.status === "pending").length,
    archived:
      contractsInScope.filter((c) => c.status === "ended" || c.status === "declined").length,
    all: contractsInScope.length,
  };

  const filteredContracts = contractsInScope.filter((c) => {
    if (filter === "activeOpen") return c.status === "active" || c.status === "pending";
    if (filter === "active") return c.status === "active";
    if (filter === "pending") return c.status === "pending";
    if (filter === "archived") return c.status === "ended" || c.status === "declined";
    return true;
  });

  const filteredCoordinators =
    coordinators?.filter(
      (coord) =>
        (studioFilter === "all" || coord.studio_ids.includes(studioFilter)) &&
        matchesSearch(search, coord.full_name, coord.email, ...studioNamesFor(coord.studio_ids))
    ) ?? [];

  const coordinatorByEmail = new Map(
    (coordinators ?? []).map((coord) => [coord.email.toLowerCase(), coord])
  );

  function resetListFilters() {
    setSearch("");
    setStudioFilter("all");
  }

  const filterTabs: { id: ContractFilter; label: string; count: number }[] = [
    { id: "activeOpen", label: t.contracts.filters.activeOpen, count: counts.activeOpen },
    { id: "active", label: t.contracts.filters.active, count: counts.active },
    { id: "pending", label: t.contracts.filters.pending, count: counts.pending },
    { id: "archived", label: t.contracts.filters.archived, count: counts.archived },
    { id: "all", label: t.contracts.filters.all, count: counts.all },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
              {t.trainers.title}
            </h1>
            {contracts && section === "contracts" && (
              <Badge variant="secondary" className="font-semibold">
                {counts.activeOpen}
              </Badge>
            )}
            {coordinators && section === "coordinators" && (
              <Badge variant="secondary" className="font-semibold">
                {coordinators.length}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.trainers.subtitle}</p>
        </div>

        {section === "contracts" ? (
          <Button onClick={openContractDrawer} className="gap-1.5">
            <Plus className="size-4" />
            <span>{t.contracts.offerTitle}</span>
          </Button>
        ) : (
          <Button
            onClick={() => {
              setSuccess(null);
              setCoordError(null);
              setCoordEmail("");
              setCoordStudioIds(studios && studios.length === 1 ? [studios[0].id] : []);
              setCoordInviteOpen(true);
            }}
            disabled={!studios || studios.length === 0}
            className="gap-1.5"
          >
            <UserPlus className="size-4" />
            <span>{t.coordinators.inviteTitle}</span>
          </Button>
        )}
      </div>

      {isFullAdmin && (
        <div role="tablist" className="inline-flex rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            role="tab"
            aria-selected={section === "contracts"}
            onClick={() => setSection("contracts")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              section === "contracts"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-4" />
            <span>{t.coordinators.tabContracts}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "coordinators"}
            onClick={() => setSection("coordinators")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              section === "coordinators"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldCheck className="size-4" />
            <span>{t.coordinators.tabCoordinators}</span>
            {coordinators && coordinators.length > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                  section === "coordinators"
                    ? "bg-primary-foreground/20"
                    : "bg-muted text-foreground"
                )}
              >
                {coordinators.length}
              </span>
            )}
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Drawer: Vertrag anbieten */}
      <Drawer
        open={formOpen}
        onClose={closeContractDrawer}
        title={t.contracts.offerTitle}
        description={t.contracts.companyHint}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contract-email">{t.contracts.email}</Label>
            <Input id="contract-email" type="email" {...register("email")} />
            {emailSuggestion && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>
                    {t.contracts.emailTypoHint}{" "}
                    <strong className="font-semibold">{emailSuggestion}</strong>?
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setValue("email", emailSuggestion, { shouldValidate: true })}
                  className="shrink-0 font-bold underline hover:opacity-80"
                >
                  {t.contracts.emailTypoFix}
                </button>
              </div>
            )}
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contract-amount">{t.contracts.rateAmount}</Label>
            <Input id="contract-amount" inputMode="decimal" {...register("rateAmount")} />
            {errors.rateAmount && (
              <p className="text-sm text-destructive">{errors.rateAmount.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
              {errors.validTo && (
                <p className="text-sm text-destructive">{errors.validTo.message}</p>
              )}
            </div>
          </div>

          {studios && studios.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/35 p-3.5">
              <p className="text-xs font-bold text-foreground">{t.contracts.studioScopeLabel}</p>
              {isFullAdmin && (
                <>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <input
                      type="radio"
                      checked={!contractRestricted}
                      onChange={() => {
                        setContractRestricted(false);
                        setContractScopeError(null);
                      }}
                      className="size-3.5 accent-primary"
                    />
                    <span>{t.contracts.allStudios}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <input
                      type="radio"
                      checked={contractRestricted}
                      onChange={() => {
                        setContractRestricted(true);
                        setContractScopeError(null);
                      }}
                      className="size-3.5 accent-primary"
                    />
                    <span>{t.contracts.selectedStudiosOnly}</span>
                  </label>
                </>
              )}
              {(!isFullAdmin || contractRestricted) && (
                <div className={cn("space-y-1.5 pt-1", isFullAdmin && "pl-5")}>
                  {studios.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={contractStudioIds.includes(s.id)}
                        onChange={() => {
                          setContractScopeError(null);
                          setContractStudioIds((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((id) => id !== s.id)
                              : [...prev, s.id]
                          );
                        }}
                        className="size-3.5 rounded accent-primary"
                      />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {contractScopeError && (
                <p className="text-xs text-destructive">{contractScopeError}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1 gap-1.5">
              <Send className="size-4" />
              <span>{t.contracts.offer}</span>
            </Button>
            <Button type="button" variant="outline" onClick={closeContractDrawer}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Kurskoordinator einladen */}
      <Drawer
        open={coordInviteOpen}
        onClose={() => setCoordInviteOpen(false)}
        title={t.coordinators.inviteTitle}
        description={t.coordinators.inviteHint}
      >
        <form onSubmit={handleInviteCoordinator} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="coord-email">{t.contracts.email}</Label>
            <Input
              id="coord-email"
              type="email"
              value={coordEmail}
              onChange={(e) => setCoordEmail(e.target.value)}
            />
            {coordEmailSuggestion && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>
                    {t.contracts.emailTypoHint}{" "}
                    <strong className="font-semibold">{coordEmailSuggestion}</strong>?
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setCoordEmail(coordEmailSuggestion)}
                  className="shrink-0 font-bold underline hover:opacity-80"
                >
                  {t.contracts.emailTypoFix}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/35 p-3.5">
            <p className="text-xs font-bold text-foreground">{t.coordinators.selectStudiosLabel}</p>
            {(studios ?? []).map((studio) => (
              <label
                key={studio.id}
                className="flex cursor-pointer items-center gap-2 text-xs font-medium"
              >
                <input
                  type="checkbox"
                  checked={coordStudioIds.includes(studio.id)}
                  onChange={() => {
                    setCoordError(null);
                    setCoordStudioIds((prev) =>
                      prev.includes(studio.id)
                        ? prev.filter((id) => id !== studio.id)
                        : [...prev, studio.id]
                    );
                  }}
                  className="size-3.5 rounded accent-primary"
                />
                <span>{studio.name}</span>
              </label>
            ))}
          </div>

          {coordError && <p className="text-sm text-destructive">{coordError}</p>}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button
              type="submit"
              disabled={inviteCoordinator.isPending}
              className="flex-1 gap-1.5"
            >
              <Send className="size-4" />
              <span>{t.coordinators.inviteButton}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCoordInviteOpen(false)}
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Kurskoordinator-Studios ändern */}
      <Drawer
        open={Boolean(editingCoord)}
        onClose={() => setEditingCoord(null)}
        title={t.coordinators.editStudiosTitle}
        description={
          editingCoord
            ? `${editingCoord.full_name || editingCoord.email} — ${t.coordinators.editStudiosHint}`
            : undefined
        }
      >
        {editingCoord && (
          <form onSubmit={handleSaveCoordinatorStudios} className="space-y-4">
            <div className="space-y-2 rounded-xl border border-border bg-muted/35 p-3.5">
              <p className="text-xs font-bold text-foreground">
                {t.coordinators.selectStudiosLabel}
              </p>
              {(studios ?? []).map((studio) => (
                <label
                  key={studio.id}
                  className="flex cursor-pointer items-center gap-2 text-xs font-medium"
                >
                  <input
                    type="checkbox"
                    checked={editCoordStudioIds.includes(studio.id)}
                    onChange={() => {
                      setEditCoordError(null);
                      setEditCoordStudioIds((prev) =>
                        prev.includes(studio.id)
                          ? prev.filter((id) => id !== studio.id)
                          : [...prev, studio.id]
                      );
                    }}
                    className="size-3.5 rounded accent-primary"
                  />
                  <span>{studio.name}</span>
                </label>
              ))}
            </div>

            {editCoordError && <p className="text-sm text-destructive">{editCoordError}</p>}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                type="submit"
                disabled={updateCoordinatorStudios.isPending}
                className="flex-1"
              >
                {t.common.save}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={updateCoordinatorStudios.isPending}
                onClick={handleRemoveCoordinator}
              >
                {t.coordinators.removeAccess}
              </Button>
            </div>
          </form>
        )}
      </Drawer>

      {((section === "contracts" && contracts && contracts.length > 0) ||
        (section === "coordinators" && coordinators && coordinators.length > 0)) && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <StudioFilterChips
            studios={studios ?? []}
            value={studioFilter}
            onChange={setStudioFilter}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t.trainers.searchPlaceholder}
            className="sm:ml-auto"
          />
        </div>
      )}

      {section === "coordinators" && isFullAdmin ? (
        !studios || studios.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-10 text-center">
            <Building2 className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t.coordinators.noStudiosYet}</p>
          </div>
        ) : coordsLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : coordinators && coordinators.length > 0 ? (
          filteredCoordinators.length === 0 ? (
            <div className="rounded-xl border border-border bg-card">
              <NoSearchResults onReset={resetListFilters} />
            </div>
          ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCoordinators.map((coord) => (
              <div
                key={coord.user_id}
                className="space-y-3 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-link-500 text-xs font-bold text-white">
                      {getInitials(coord.full_name, coord.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{coord.full_name || coord.email}</p>
                      {coord.full_name && (
                        <p className="truncate text-xs text-muted-foreground">{coord.email}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditCoordError(null);
                      setEditCoordStudioIds(coord.studio_ids);
                      setEditingCoord(coord);
                    }}
                  >
                    {t.coordinators.editStudiosButton}
                  </Button>
                </div>

                <div className="space-y-1.5 border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t.coordinators.exclusiveStudiosLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {coord.studio_ids.map((sid) => (
                      <Badge key={sid} variant="secondary" className="gap-1 font-medium">
                        <Building2 className="size-3" />
                        <span>{studioNameMap.get(sid) ?? sid}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
              <ShieldCheck className="size-5" />
            </div>
            <p className="font-medium">{t.coordinators.empty}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t.coordinators.emptyHint}</p>
          </div>
        )
      ) : (
        <>
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
                        : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                        selected ? "bg-primary-foreground/20" : "bg-muted text-foreground"
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>
            ) : isError ? (
              <p className="p-6 text-sm text-destructive">{t.common.error}</p>
            ) : contracts && contracts.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 p-10 text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
                  <Users className="size-5" />
                </div>
                <p className="font-medium">{t.contracts.companyEmpty}</p>
              </div>
            ) : filteredContracts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3.5">{t.trainers.tableTrainer}</TableHead>
                    <TableHead className="px-3">{t.trainers.tableContract}</TableHead>
                    <TableHead className="hidden px-3 md:table-cell">
                      {t.trainers.tableStudios}
                    </TableHead>
                    <TableHead className="hidden px-3 lg:table-cell">
                      {t.trainers.tableValidity}
                    </TableHead>
                    <TableHead className="px-3">{t.trainers.tableStatus}</TableHead>
                    <TableHead className="px-3.5 text-right">{t.trainers.tableAction}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((c) => {
                    const contractStudios = studioNamesFor(c.studio_ids);
                    const coordinatorRole = c.trainer_email
                      ? coordinatorByEmail.get(c.trainer_email.toLowerCase())
                      : undefined;
                    const studioBadges =
                      contractStudios.length > 0 ? (
                        contractStudios.map((name) => (
                          <Badge key={name} variant="secondary" className="gap-1 font-medium">
                            <Building2 className="size-3" />
                            <span>{name}</span>
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="font-medium">
                          {t.trainers.allStudiosBadge}
                        </Badge>
                      );
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-[240px] whitespace-normal px-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                              {getInitials(c.trainer_name, c.trainer_email)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {c.trainer_name || c.trainer_email}
                              </p>
                              {c.trainer_name && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {c.trainer_email}
                                </p>
                              )}
                              {coordinatorRole && (
                                <Badge
                                  className="mt-1 gap-1 bg-link-500/15 text-link-600 dark:text-link-400"
                                  title={studioNamesFor(coordinatorRole.studio_ids).join(", ")}
                                >
                                  <ShieldCheck className="size-3" />
                                  <span>{t.trainers.alsoCoordinator}</span>
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-normal px-3 text-muted-foreground">
                          <p className="font-medium text-foreground">{formatContractTerms(c)}</p>
                          <div className="mt-1 flex flex-wrap gap-1 md:hidden">{studioBadges}</div>
                          <p className="mt-0.5 text-xs text-muted-foreground lg:hidden">
                            {formatContractValidity(c)}
                          </p>
                        </TableCell>
                        <TableCell className="hidden whitespace-normal px-3 md:table-cell">
                          <div className="flex max-w-64 flex-wrap gap-1">{studioBadges}</div>
                        </TableCell>
                        <TableCell className="hidden whitespace-normal px-3 text-muted-foreground lg:table-cell">
                          {formatContractValidity(c)}
                        </TableCell>
                        <TableCell className="px-3">
                          <ContractStatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="px-3.5 text-right">
                          {c.status === "active" || c.status === "pending" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={end.isPending}
                              onClick={() => end.mutate(c.id)}
                            >
                              {c.status === "pending" ? t.contracts.withdraw : t.contracts.end}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : search.trim() || studioFilter !== "all" ? (
              <NoSearchResults onReset={resetListFilters} />
            ) : (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
                  <Users className="size-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {filter === "activeOpen"
                    ? t.trainers.emptyActiveOpen
                    : t.contracts.companyFilterEmpty}
                </p>
                {filter === "activeOpen" && counts.archived > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setFilter("archived")}>
                    {t.trainers.showArchive} ({counts.archived})
                  </Button>
                )}
              </div>
            )}
          </div>

          {end.isError && <p className="text-sm text-destructive">{t.contracts.endError}</p>}
        </>
      )}
    </div>
  );
}
