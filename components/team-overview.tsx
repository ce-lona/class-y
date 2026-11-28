"use client";

import { useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContractStatusBadge } from "@/components/contract-status-badge";
import {
  matchesSearch,
  NoSearchResults,
  SearchInput,
  StudioFilterChips,
} from "@/components/list-toolbar";
import { useCompanyTeam } from "@/hooks/useTeam";
import { sortTeam, type TeamMember, type TeamRole } from "@/lib/team";
import { formatDateDE, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

type RoleFilter = "all" | TeamRole;

const roleLabel: Record<TeamRole, string> = {
  company_admin: t.team.roleAdmin,
  coordinator: t.team.roleStudioAdmin,
  trainer: t.team.roleTrainer,
};

const roleAvatar: Record<TeamRole, string> = {
  company_admin: "bg-primary text-primary-foreground",
  coordinator: "bg-link-500 text-white",
  trainer: "bg-muted text-foreground",
};

/**
 * Alle Personen der Company (Admins, Studio-Admins, Trainer:innen) in einer Liste.
 * Standard-Sortierung: Rolle, dann zuletzt geändert. Klick öffnet den passenden Bereich.
 */
export function TeamOverview({
  companyId,
  studios,
  onOpen,
}: {
  companyId: string;
  studios: { id: string; name: string }[];
  onOpen: (member: TeamMember) => void;
}) {
  const { data: team, isLoading, isError } = useCompanyTeam(companyId);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [studioFilter, setStudioFilter] = useState("all");
  const [search, setSearch] = useState("");

  const studioName = new Map(studios.map((s) => [s.id, s.name]));
  const studioNamesFor = (ids: string[] | null) =>
    (ids ?? []).map((id) => studioName.get(id)).filter((n): n is string => Boolean(n));

  if (isLoading) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (isError) return <p className="text-sm text-destructive">{t.team.loadError}</p>;

  const members = sortTeam(team ?? []);
  const inScope = members.filter(
    (m) =>
      // Ohne Studio-Zuordnung gilt die Person für alle Studios (Admins, unbeschränkte Verträge).
      (studioFilter === "all" || !m.studio_ids || m.studio_ids.length === 0 || m.studio_ids.includes(studioFilter)) &&
      matchesSearch(search, m.full_name, m.email, ...studioNamesFor(m.studio_ids)),
  );
  const count = (role: RoleFilter) =>
    role === "all" ? inScope.length : inScope.filter((m) => m.role === role).length;
  const visible = roleFilter === "all" ? inScope : inScope.filter((m) => m.role === roleFilter);

  const filters: { id: RoleFilter; label: string }[] = [
    { id: "all", label: t.team.filterAll },
    { id: "company_admin", label: t.team.filterAdmins },
    { id: "coordinator", label: t.team.filterStudioAdmins },
    { id: "trainer", label: t.team.filterTrainers },
  ];

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
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <StudioFilterChips studios={studios} value={studioFilter} onChange={setStudioFilter} />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t.team.searchPlaceholder}
          className="sm:ml-auto"
        />
      </div>

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
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                  selected ? "bg-primary-foreground/20" : "bg-muted text-foreground",
                )}
              >
                {count(f.id)}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <NoSearchResults
            onReset={() => {
              setSearch("");
              setStudioFilter("all");
              setRoleFilter("all");
            }}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {visible.map((m) => {
            const studiosText = m.role === "company_admin" ? t.team.allStudios : studioNamesFor(m.studio_ids).join(", ") || t.team.allStudios;
            return (
              <li key={`${m.role}:${m.user_id}`}>
                <button
                  type="button"
                  onClick={() => onOpen(m)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      roleAvatar[m.role],
                    )}
                  >
                    {getInitials(m.full_name, m.email)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {m.full_name || m.email}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.full_name ? `${m.email} · ${studiosText}` : studiosText}
                    </span>
                  </span>
                  <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <span className="flex items-center gap-1.5">
                      {m.role === "trainer" && m.contract_status && (
                        <ContractStatusBadge status={m.contract_status} />
                      )}
                      <Badge variant="secondary" className="font-semibold">
                        {roleLabel[m.role]}
                      </Badge>
                    </span>
                    {m.updated_at && (
                      <span className="text-[11px] text-muted-foreground">
                        {t.team.updatedAt} {formatDateDE(m.updated_at.slice(0, 10))}
                      </span>
                    )}
                  </span>
                  <Badge variant="secondary" className="shrink-0 font-semibold sm:hidden">
                    {roleLabel[m.role]}
                  </Badge>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
