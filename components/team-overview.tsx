"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { ContractStatusBadge, formatContractTerms } from "@/components/contract-status-badge";
import { matchesSearch, NoSearchResults, SearchInput } from "@/components/list-toolbar";
import { TeamMemberPanel } from "@/components/team-member-panel";
import { useCompanyTeam } from "@/hooks/useTeam";
import { useCompanyContracts } from "@/hooks/useContracts";
import { useStudioFilter } from "@/hooks/useStudioFilter";
import { sortTeam, type TeamMember, type TeamRole } from "@/lib/team";
import type { CompanyContract } from "@/lib/contracts";
import { fillTemplate, formatDateDE, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

type RoleFilter = "all" | TeamRole | "pending";

const roleLabel: Record<TeamRole, string> = {
  company_admin: t.team.roleAdmin,
  coordinator: t.team.roleStudioAdmin,
  trainer: t.team.roleTrainer,
};

const roleBadge: Record<TeamRole, string> = {
  company_admin: "bg-accent text-accent-foreground",
  coordinator: "bg-link-500/12 text-link-600 dark:text-link-400",
  trainer: "bg-muted text-foreground/80",
};

const roleAvatar: Record<TeamRole, string> = {
  company_admin: "bg-primary text-primary-foreground",
  coordinator: "bg-link-600 text-white",
  trainer: "border border-border bg-muted text-foreground",
};

/** Neuester Vertrag je E-Mail (aktiv/offen vor beendet). */
function latestContracts(contracts: CompanyContract[]): Map<string, CompanyContract> {
  const rank = { pending: 0, active: 0, ended: 1, declined: 2 } as const;
  const map = new Map<string, CompanyContract>();
  for (const c of contracts) {
    const key = c.trainer_email.toLowerCase();
    const prev = map.get(key);
    if (
      !prev ||
      rank[c.status] < rank[prev.status] ||
      (rank[c.status] === rank[prev.status] && c.valid_from > prev.valid_from)
    ) {
      map.set(key, c);
    }
  }
  return map;
}

/**
 * Team (Company-Admins): alle Personen in einer Tabelle mit Rollen-Chips. Klick öffnet das
 * Seitenpanel (Vertrag, Studio-Freigabe, Stammdaten, Datenschutz). Studio-Filter aus der Sidebar.
 */
export function TeamOverview({
  companyId,
  companyName,
  onOpen,
}: {
  companyId: string;
  companyName: string;
  /** Person in den bisherigen Bereichen (Verträge, Studio-Admins) bearbeiten. */
  onOpen: (member: TeamMember) => void;
}) {
  const { data: team, isLoading, isError } = useCompanyTeam(companyId);
  const { data: contracts } = useCompanyContracts(companyId);
  const { studios, studioId, isAll } = useStudioFilter();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const contractByEmail = useMemo(() => latestContracts(contracts ?? []), [contracts]);
  const studioName = new Map(studios.map((s) => [s.id, s.name]));
  const contractOf = (m: TeamMember) =>
    m.role === "trainer" ? (contractByEmail.get(m.email.toLowerCase()) ?? null) : null;
  const isPending = (m: TeamMember) => {
    const c = contractOf(m);
    return c?.status === "pending" && c.approval_status === "pending_approval";
  };
  const studioIdsOf = (m: TeamMember) =>
    m.role === "trainer" ? (contractOf(m)?.studio_ids ?? m.studio_ids ?? []) : (m.studio_ids ?? []);

  if (isLoading) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (isError) return <p className="text-sm text-destructive">{t.team.loadError}</p>;

  const members = sortTeam(team ?? []);
  const inScope = members.filter((m) => {
    const ids = studioIdsOf(m);
    // Admins und Verträge ohne Studio-Beschränkung gelten für alle Studios.
    const studioOk = isAll || m.role === "company_admin" || ids.length === 0 || ids.includes(studioId);
    const names = ids.map((id) => studioName.get(id) ?? "");
    return studioOk && matchesSearch(search, m.full_name, m.email, ...names);
  });
  const filterFn: Record<RoleFilter, (m: TeamMember) => boolean> = {
    all: () => true,
    company_admin: (m) => m.role === "company_admin",
    coordinator: (m) => m.role === "coordinator",
    trainer: (m) => m.role === "trainer",
    pending: isPending,
  };
  const visible = inScope.filter(filterFn[roleFilter]);
  // Wartende Angebote oben, damit sie nicht untergehen.
  visible.sort((a, b) => Number(isPending(b)) - Number(isPending(a)));

  const filters: { id: RoleFilter; label: string }[] = [
    { id: "all", label: t.team.filterAll },
    { id: "company_admin", label: t.team.filterAdmins },
    { id: "coordinator", label: t.team.filterStudioAdmins },
    { id: "trainer", label: t.team.filterTrainers },
    { id: "pending", label: t.team.filterPending },
  ];

  const keyOf = (m: TeamMember) => `${m.role}:${m.user_id}`;
  const openMember = members.find((m) => keyOf(m) === openKey) ?? null;

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-10 text-center">
        <Users className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t.team.empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div role="group" aria-label={t.team.roleFilterLabel} className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const selected = roleFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setRoleFilter(f.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground/80 hover:border-muted-foreground",
                )}
              >
                <span>{f.label}</span>
                <span className={cn("font-bold tabular-nums", selected ? "text-background/75" : "text-muted-foreground")}>
                  {inScope.filter(filterFn[f.id]).length}
                </span>
              </button>
            );
          })}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder={t.team.searchPlaceholder} />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <NoSearchResults
            onReset={() => {
              setSearch("");
              setRoleFilter("all");
            }}
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr className="text-left text-[12.5px] font-bold text-muted-foreground">
                {[t.team.colPerson, t.team.colRole, t.team.colStudios, t.team.colContract, t.team.colStatus, t.team.colUpdated].map(
                  (h) => (
                    <th key={h} className="border-b border-border px-3.5 py-2.5 whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => {
                const contract = contractOf(m);
                const pending = isPending(m);
                const ids = studioIdsOf(m);
                const studiosText =
                  m.role === "company_admin"
                    ? t.team.wholeCompany
                    : ids.length === 0
                      ? t.team.allStudios
                      : ids.map((id) => studioName.get(id)).filter(Boolean).join(", ");
                return (
                  <tr
                    key={keyOf(m)}
                    onClick={() => setOpenKey(keyOf(m))}
                    className={cn(
                      "cursor-pointer border-b border-border/60 last:border-b-0 hover:bg-muted/60",
                      pending && "bg-warning-bg/50",
                      openKey === keyOf(m) && "bg-accent",
                    )}
                  >
                    <td className="px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenKey(keyOf(m));
                        }}
                        className="flex items-center gap-2.5 text-left"
                      >
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-full font-heading text-[11px] font-extrabold",
                            roleAvatar[m.role],
                          )}
                        >
                          {getInitials(m.full_name, m.email)}
                        </span>
                        <span className="min-w-0">
                          <span className="block leading-tight font-semibold">{m.full_name || m.email}</span>
                          {m.full_name && (
                            <span className="block text-[12.5px] leading-tight text-muted-foreground">{m.email}</span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className={cn("rounded-md px-2 py-px text-[12.5px] font-bold whitespace-nowrap", roleBadge[m.role])}>
                        {roleLabel[m.role]}
                      </span>
                    </td>
                    <td className={cn("px-3.5 py-2.5 text-[13px]", m.role === "company_admin" && "text-muted-foreground")}>
                      {studiosText}
                    </td>
                    <td className="px-3.5 py-2.5 text-[13px]">
                      {contract ? formatContractTerms(contract) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {pending ? (
                        <>
                          <span className="rounded-md bg-warning-bg px-2 py-px text-[12.5px] font-bold whitespace-nowrap text-warning">
                            {t.team.statusPending}
                          </span>
                          {contract?.created_by_name && (
                            <div className="text-[13px] text-muted-foreground">
                              {fillTemplate(t.team.offeredBy, { name: contract.created_by_name })}
                            </div>
                          )}
                        </>
                      ) : contract ? (
                        <ContractStatusBadge status={contract.status} />
                      ) : (
                        <span className="rounded-md bg-success-bg px-2 py-px text-[12.5px] font-bold text-success">
                          {t.team.statusActive}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-[13px] whitespace-nowrap text-muted-foreground">
                      {m.updated_at ? formatDateDE(m.updated_at.slice(0, 10)) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openMember && (
        <TeamMemberPanel
          member={openMember}
          contract={contractOf(openMember)}
          companyId={companyId}
          companyName={companyName}
          studios={studios}
          canManage
          onClose={() => setOpenKey(null)}
          onOpenDetails={(m) => {
            setOpenKey(null);
            onOpen(m);
          }}
        />
      )}
    </div>
  );
}
