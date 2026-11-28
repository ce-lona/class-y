"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Plus,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  UsersRound,
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
import { useAddCompanyAdmin, useMyCompany } from "@/hooks/useCompanyAdmins";
import { TeamOverview } from "@/components/team-overview";
import { CompanyAdminsPanel } from "@/components/company-admins-panel";
import { setTeamMemberName, type TeamMember } from "@/lib/team";
import {
  useCompanyContracts,
  useEndContract,
  useOfferContract,
  useReviewContract,
  useSetContractStudios,
} from "@/hooks/useContracts";
import { useStudioAdminPermissions } from "@/hooks/useStudioAdminPermissions";
import { useConfirmContract } from "@/hooks/useCreditNotes";
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
type TeamSection = "all" | "admins" | "contracts" | "coordinators";
type AddKind = "admin" | "coordinator" | "trainer";

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
  const review = useReviewContract(companyId);
  const setStudios = useSetContractStudios(companyId);
  const { data: permissions } = useStudioAdminPermissions(isFullAdmin ? undefined : companyId);
  // Studio-Admins: Recht „Verträge“ (darf / mit Bestätigung / darf nicht), Company-Admins dürfen alles.
  const contractPermission = isFullAdmin ? "allowed" : (permissions?.contracts ?? "approval");
  const canOffer = contractPermission !== "denied";
  const canEndContracts = contractPermission === "allowed";
  const confirm = useConfirmContract(companyId);
  const inviteCoordinator = useInviteStudioCoordinator(companyId);
  const updateCoordinatorStudios = useUpdateCoordinatorStudios(companyId);

  const queryClient = useQueryClient();
  const addAdmin = useAddCompanyAdmin(companyId);
  // Team-Tab: Company-Admins starten bei „Alle“, Studio-Admins sehen nur die Verträge.
  // /team zeigt zuerst alle Personen, /trainers (Studio-Admins, alte Links) die Verträge.
  const pathname = usePathname();
  const [sectionChoice, setSection] = useState<TeamSection | null>(null);
  const section: TeamSection = !isFullAdmin
    ? "contracts"
    : (sectionChoice ?? (pathname?.startsWith("/team") ? "all" : "contracts"));
  const [addChooserOpen, setAddChooserOpen] = useState(false);
  const [adminInviteOpen, setAdminInviteOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [coordName, setCoordName] = useState("");
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

  // Company-Admin: Studio-Freigabe eines Vertrags ändern
  const [editingContract, setEditingContract] = useState<{ id: string; label: string } | null>(null);
  const [editContractStudioIds, setEditContractStudioIds] = useState<string[]>([]);

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

  // Name beim Anlegen ins Profil übernehmen (nur wenn die Person noch keinen eingetragen hat).
  async function saveMemberName(email: string, fullName: string | undefined) {
    if (!company || !isFullAdmin || !fullName?.trim()) return;
    try {
      await setTeamMemberName({ companyId: company.id, email, fullName });
    } catch (error) {
      console.error(error);
    }
  }

  function refreshTeam() {
    queryClient.invalidateQueries({ queryKey: ["company-team", companyId] });
    queryClient.invalidateQueries({ queryKey: ["company-contracts", companyId] });
    queryClient.invalidateQueries({ queryKey: ["company-coordinators", companyId] });
  }

  function openCoordinatorDrawer() {
    setSuccess(null);
    setCoordError(null);
    setCoordEmail("");
    setCoordName("");
    setCoordStudioIds(studios && studios.length === 1 ? [studios[0].id] : []);
    setCoordInviteOpen(true);
  }

  function openAdminDrawer() {
    setSuccess(null);
    setAdminError(null);
    setAdminEmail("");
    setAdminName("");
    setAdminInviteOpen(true);
  }

  function startAdd(kind: AddKind) {
    setAddChooserOpen(false);
    if (kind === "admin") openAdminDrawer();
    else if (kind === "coordinator") openCoordinatorDrawer();
    else openContractDrawer();
  }

  function openMember(member: TeamMember) {
    if (member.role === "company_admin") {
      setSection("admins");
      return;
    }
    setSearch(member.email);
    setStudioFilter("all");
    if (member.role === "coordinator") {
      setSection("coordinators");
    } else {
      setFilter("all");
      setSection("contracts");
    }
  }

  async function handleInviteAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    setSuccess(null);
    const email = adminEmail.trim();
    if (!email) {
      setAdminError(t.auth.emailRequired);
      return;
    }
    try {
      const result = await addAdmin.mutateAsync(email);
      await saveMemberName(email, adminName);
      refreshTeam();
      setSuccess(result.invited ? t.team.adminInvited : t.team.adminAdded);
      setAdminInviteOpen(false);
    } catch (error) {
      console.error(error);
      setAdminError(t.team.adminError);
    }
  }

  function openContractDrawer() {
    setSuccess(null);
    setContractScopeError(null);
    // Verträge gelten company-weit; nur Company-Admins beschränken sie auf Studios.
    setContractRestricted(false);
    setContractStudioIds([]);
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

    const needsStudios = isFullAdmin && contractRestricted;
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
      await saveMemberName(values.email, values.fullName);
      refreshTeam();
      setSuccess(
        contractPermission === "approval"
          ? t.roleModel.offerNeedsApproval
          : result.invited
            ? t.contracts.invited
            : t.contracts.offered
      );
      closeContractDrawer();
      if (filter === "archived") {
        setFilter("activeOpen");
      }
    } catch (error) {
      console.error(error);
      setError("email", { message: t.contracts.offerError });
    }
  }

  async function handleSaveContractStudios(e: React.FormEvent) {
    e.preventDefault();
    if (!editingContract) return;
    try {
      await setStudios.mutateAsync({
        contractId: editingContract.id,
        studioIds: editContractStudioIds,
      });
      setSuccess(t.roleModel.studiosSaved);
      setEditingContract(null);
    } catch (error) {
      console.error(error);
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
      await saveMemberName(coordEmail.trim(), coordName);
      refreshTeam();
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
              {isFullAdmin ? t.team.title : t.trainers.title}
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
          <p className="mt-1 text-sm text-muted-foreground">
            {isFullAdmin ? t.team.subtitle : t.trainers.subtitle}
          </p>
        </div>

        {section === "all" ? (
          <Button onClick={() => setAddChooserOpen(true)} className="gap-1.5">
            <UserPlus className="size-4" />
            <span>{t.team.addPerson}</span>
          </Button>
        ) : section === "admins" ? (
          <Button onClick={openAdminDrawer} className="gap-1.5">
            <UserPlus className="size-4" />
            <span>{t.team.inviteAdmin}</span>
          </Button>
        ) : section === "contracts" ? (
          canOffer && (
            <Button onClick={openContractDrawer} className="gap-1.5">
              <Plus className="size-4" />
              <span>{t.contracts.offerTitle}</span>
            </Button>
          )
        ) : (
          <Button
            onClick={openCoordinatorDrawer}
            disabled={!studios || studios.length === 0}
            className="gap-1.5"
          >
            <UserPlus className="size-4" />
            <span>{t.coordinators.inviteTitle}</span>
          </Button>
        )}
      </div>

      {isFullAdmin && (
        <div
          role="tablist"
          className="flex max-w-full overflow-x-auto rounded-xl border border-border bg-card p-1 sm:inline-flex"
        >
          {(
            [
              { key: "all", label: t.team.tabAll, Icon: UsersRound },
              { key: "admins", label: t.team.tabAdmins, Icon: ShieldCheck },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={section === key}
              onClick={() => setSection(key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                section === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={section === "contracts"}
            onClick={() => setSection("contracts")}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
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
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
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
          {isFullAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="contract-name">{t.team.fullName}</Label>
              <Input id="contract-name" autoComplete="off" {...register("fullName")} />
              <p className="text-xs text-muted-foreground">{t.team.fullNameHint}</p>
            </div>
          )}
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

          {!isFullAdmin && (
            <div className="space-y-1.5 rounded-xl border border-border bg-muted/35 p-3.5 text-xs text-muted-foreground">
              <p>{t.roleModel.contractScopeCompanyWide}</p>
              {contractPermission === "approval" && <p>{t.roleModel.contractApprovalHint}</p>}
            </div>
          )}

          {isFullAdmin && studios && studios.length > 0 && (
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
              {contractRestricted && (
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

      {/* Drawer: Person hinzufügen (Auswahl der Rolle) */}
      <Drawer
        open={addChooserOpen}
        onClose={() => setAddChooserOpen(false)}
        title={t.team.addPerson}
        description={t.team.addPersonHint}
      >
        <div className="space-y-2">
          {(
            [
              { kind: "admin", label: t.team.roleAdmin, hint: t.team.addAdminHint, Icon: ShieldCheck, disabled: false },
              {
                kind: "coordinator",
                label: t.team.roleStudioAdmin,
                hint: !studios || studios.length === 0 ? t.coordinators.noStudiosYet : t.team.addStudioAdminHint,
                Icon: Building2,
                disabled: !studios || studios.length === 0,
              },
              { kind: "trainer", label: t.team.roleTrainer, hint: t.team.addTrainerHint, Icon: Users, disabled: false },
            ] as const
          ).map(({ kind, label, hint, Icon, disabled }) => (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              onClick={() => startAdd(kind)}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Drawer>

      {/* Drawer: Admin einladen */}
      <Drawer
        open={adminInviteOpen}
        onClose={() => setAdminInviteOpen(false)}
        title={t.team.inviteAdmin}
        description={t.team.inviteAdminHint}
      >
        <form onSubmit={handleInviteAdmin} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-name">{t.team.fullName}</Label>
            <Input
              id="admin-name"
              autoComplete="off"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.team.fullNameHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">{t.contracts.email}</Label>
            <Input
              id="admin-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>
          {adminError && <p className="text-sm text-destructive">{adminError}</p>}
          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={addAdmin.isPending} className="flex-1 gap-1.5">
              <Send className="size-4" />
              <span>{t.team.inviteAdminButton}</span>
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdminInviteOpen(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Studio-Admin einladen */}
      <Drawer
        open={coordInviteOpen}
        onClose={() => setCoordInviteOpen(false)}
        title={t.coordinators.inviteTitle}
        description={t.coordinators.inviteHint}
      >
        <form onSubmit={handleInviteCoordinator} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="coord-name">{t.team.fullName}</Label>
            <Input
              id="coord-name"
              autoComplete="off"
              value={coordName}
              onChange={(e) => setCoordName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.team.fullNameHint}</p>
          </div>
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

      {/* Drawer: Studio-Freigabe eines Vertrags (nur Company-Admins) */}
      <Drawer
        open={Boolean(editingContract)}
        onClose={() => setEditingContract(null)}
        title={t.roleModel.editStudiosTitle}
        description={
          editingContract
            ? `${editingContract.label} — ${t.roleModel.editStudiosHint}`
            : undefined
        }
      >
        {editingContract && (
          <form onSubmit={handleSaveContractStudios} className="space-y-4">
            <div className="space-y-2 rounded-xl border border-border bg-muted/35 p-3.5">
              {(studios ?? []).map((studio) => (
                <label
                  key={studio.id}
                  className="flex cursor-pointer items-center gap-2 text-xs font-medium"
                >
                  <input
                    type="checkbox"
                    checked={editContractStudioIds.includes(studio.id)}
                    onChange={() =>
                      setEditContractStudioIds((prev) =>
                        prev.includes(studio.id)
                          ? prev.filter((id) => id !== studio.id)
                          : [...prev, studio.id]
                      )
                    }
                    className="size-3.5 rounded accent-primary"
                  />
                  <span>{studio.name}</span>
                </label>
              ))}
            </div>
            {setStudios.isError && (
              <p className="text-sm text-destructive">{t.roleModel.studiosError}</p>
            )}
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Button type="submit" disabled={setStudios.isPending} className="flex-1">
                {t.common.save}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingContract(null)}>
                {t.common.cancel}
              </Button>
            </div>
          </form>
        )}
      </Drawer>

      {/* Drawer: Studio-Admin-Studios ändern */}
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

      {section === "all" ? (
        <TeamOverview companyId={companyId} studios={studios ?? []} onOpen={openMember} />
      ) : section === "admins" ? (
        <CompanyAdminsPanel companyId={companyId} />
      ) : section === "coordinators" && isFullAdmin ? (
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
                          {c.approval_status === "pending_approval" ? (
                            <div className="space-y-1">
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                {t.roleModel.awaitingApproval}
                              </Badge>
                              {c.created_by_name && (
                                <p className="text-xs text-muted-foreground">
                                  {t.roleModel.requestedBy.replace("{name}", c.created_by_name)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <ContractStatusBadge status={c.status} />
                          )}
                          {c.status === "active" && (
                            <ContractBillingHint
                              gaps={c.master_data_gaps ?? []}
                              confirmed={!!c.confirmed_at}
                              changed={c.master_data_changed}
                            />
                          )}
                        </TableCell>
                        <TableCell className="px-3.5 text-right">
                          {c.approval_status === "pending_approval" ? (
                            isFullAdmin ? (
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  disabled={review.isPending}
                                  onClick={() => review.mutate({ contractId: c.id, approve: true })}
                                  data-testid={`approve-contract-${c.id}`}
                                >
                                  {t.roleModel.approve}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={review.isPending}
                                  onClick={() => review.mutate({ contractId: c.id, approve: false })}
                                >
                                  {t.roleModel.reject}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : c.status === "active" || c.status === "pending" ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {c.status === "active" &&
                                (c.master_data_gaps?.length ?? 0) === 0 &&
                                (!c.confirmed_at || c.master_data_changed) && (
                                  <Button
                                    size="sm"
                                    disabled={confirm.isPending}
                                    onClick={() => confirm.mutate(c.id)}
                                    data-testid={`confirm-contract-${c.id}`}
                                  >
                                    {c.confirmed_at ? t.creditNotes.reconfirm : t.creditNotes.confirm}
                                  </Button>
                                )}
                              {isFullAdmin && studios && studios.length > 1 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSuccess(null);
                                    setEditContractStudioIds(c.studio_ids ?? []);
                                    setEditingContract({
                                      id: c.id,
                                      label: c.trainer_name || c.trainer_email,
                                    });
                                  }}
                                  data-testid={`contract-studios-${c.id}`}
                                >
                                  {t.roleModel.editStudiosButton}
                                </Button>
                              )}
                              {canEndContracts && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={end.isPending}
                                  onClick={() => end.mutate(c.id)}
                                >
                                  {c.status === "pending" ? t.contracts.withdraw : t.contracts.end}
                                </Button>
                              )}
                            </div>
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
          {review.isError && <p className="text-sm text-destructive">{t.roleModel.approveError}</p>}
          {confirm.isError && <p className="text-sm text-destructive">{t.creditNotes.confirmError}</p>}
        </>
      )}
    </div>
  );
}

function ContractBillingHint({
  gaps,
  confirmed,
  changed,
}: {
  gaps: string[];
  confirmed: boolean;
  changed: boolean;
}) {
  if (gaps.length > 0) {
    const labels = gaps
      .map((gap) => t.creditNotes.skipReasons[gap as keyof typeof t.creditNotes.skipReasons] ?? gap)
      .join(", ");
    return (
      <p className="mt-1 text-xs font-medium text-destructive" title={labels}>
        {t.creditNotes.masterDataMissing}
      </p>
    );
  }
  if (!confirmed) {
    return <p className="mt-1 text-xs font-medium text-warning">{t.creditNotes.notConfirmed}</p>;
  }
  if (changed) {
    return <p className="mt-1 text-xs font-medium text-warning">{t.creditNotes.masterDataChanged}</p>;
  }
  return null;
}
