"use client";

import { useState } from "react";
import { Check, Download } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  ContractStatusBadge,
  formatContractTerms,
  formatContractValidity,
} from "@/components/contract-status-badge";
import { useReviewContract } from "@/hooks/useContracts";
import { useExportUserData } from "@/hooks/useGdpr";
import { gdprErrorMessage } from "@/components/privacy/company-privacy-panel";
import type { CompanyContract } from "@/lib/contracts";
import type { TeamMember, TeamRole } from "@/lib/team";
import { fillTemplate, getInitials } from "@/lib/format";
import { slugify } from "@/lib/gdpr";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const roleLabel: Record<TeamRole, string> = {
  company_admin: t.team.roleAdmin,
  coordinator: t.team.roleStudioAdmin,
  trainer: t.team.roleTrainer,
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border/60 py-3.5 last:border-b-0">
      <h3 className="mb-2 font-heading text-sm font-bold">{title}</h3>
      {hint && <p className="-mt-1 mb-2 text-[13px] text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="m-0 font-semibold break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function StudioChips({ studios, selected }: { studios: { id: string; name: string }[]; selected: (id: string) => boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {studios.map((s) => {
        const on = selected(s.id);
        return (
          <span
            key={s.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold",
              on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
            )}
          >
            {on && <Check className="size-3.5" />}
            {s.name}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Seitenpanel einer Person im Team: Vertrag, Studio-Freigabe, Stammdaten, Datenschutz.
 * Bearbeiten (Vertrag beenden, Studios ändern) läuft weiter über die bestehenden Bereiche.
 */
export function TeamMemberPanel({
  member,
  contract,
  companyId,
  companyName,
  studios,
  canManage,
  onClose,
  onOpenDetails,
}: {
  member: TeamMember | null;
  contract: CompanyContract | null;
  companyId: string;
  companyName: string;
  studios: { id: string; name: string }[];
  /** Company-Admin (bestätigen, Datenauskunft). */
  canManage: boolean;
  onClose: () => void;
  onOpenDetails: (member: TeamMember) => void;
}) {
  const review = useReviewContract(companyId);
  const exportUser = useExportUserData();
  const [error, setError] = useState<string | null>(null);

  if (!member) return null;
  const name = member.full_name || member.email;
  const pending =
    contract?.status === "pending" && contract.approval_status === "pending_approval";

  async function decide(approve: boolean) {
    if (!contract) return;
    setError(null);
    try {
      await review.mutateAsync({ contractId: contract.id, approve });
      onClose();
    } catch (e) {
      console.error(e);
      setError(t.team.approveError);
    }
  }

  async function exportData(format: "json" | "csv") {
    if (!member) return;
    setError(null);
    try {
      await exportUser.mutateAsync({
        userId: member.user_id,
        fileName: `datenauskunft-${slugify(name)}`,
        format,
      });
    } catch (e) {
      console.error(e);
      setError(gdprErrorMessage(e));
    }
  }

  const contractStudios = contract?.studio_ids ?? [];
  const coordinatorStudios = member.role === "coordinator" ? (member.studio_ids ?? []) : [];

  return (
    <Drawer open onClose={onClose} title={name} description={`${roleLabel[member.role]} · ${companyName}`} className="max-w-[480px]">
      <div className="-mt-2">
        <div className="flex items-center gap-3 pb-2">
          <span className="grid size-11 place-items-center rounded-full bg-muted font-heading text-[15px] font-extrabold">
            {getInitials(member.full_name, member.email)}
          </span>
          <div className="min-w-0 text-sm text-muted-foreground">{member.email}</div>
        </div>

        {pending && (
          <Section title={t.team.panelContract}>
            <div className="rounded-lg bg-warning-bg px-3 py-2.5 text-sm">
              {fillTemplate(t.team.panelPendingBanner, { name: contract?.created_by_name ?? "—" })}
            </div>
            {canManage && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => decide(true)} disabled={review.isPending} className="gap-1.5">
                  <Check className="size-3.5" />
                  {t.team.approve}
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(false)} disabled={review.isPending}>
                  {t.team.reject}
                </Button>
              </div>
            )}
          </Section>
        )}

        {member.role === "trainer" && (
          <Section title={pending ? t.team.panelTerms : t.team.panelContract}>
            {contract ? (
              <KeyValues
                rows={[
                  [t.team.panelTerms, formatContractTerms(contract)],
                  [t.team.panelValidity, formatContractValidity(contract)],
                  [t.team.colStatus, <ContractStatusBadge key="s" status={contract.status} />],
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t.team.panelNoContract}</p>
            )}
          </Section>
        )}

        {member.role === "trainer" && contract && (
          <Section title={t.team.panelStudios} hint={t.team.panelStudiosHint}>
            <StudioChips
              studios={studios}
              selected={(id) => contractStudios.length === 0 || contractStudios.includes(id)}
            />
          </Section>
        )}

        {member.role === "coordinator" && (
          <Section title={t.team.panelCoordinatorStudios} hint={t.team.panelCoordinatorHint}>
            <StudioChips studios={studios} selected={(id) => coordinatorStudios.includes(id)} />
          </Section>
        )}

        {member.role === "company_admin" && (
          <Section title={t.team.colStudios}>
            <p className="text-sm text-muted-foreground">{t.team.panelAdminStudios}</p>
          </Section>
        )}

        <Section title={t.team.panelMasterData} hint={t.team.panelMasterDataHint}>
          <KeyValues
            rows={[
              [t.team.panelName, member.full_name || "—"],
              [t.team.panelEmail, member.email],
              ...(member.role === "trainer" && contract
                ? ([
                    [
                      t.team.panelBilling,
                      (contract.master_data_gaps?.length ?? 0) === 0 ? (
                        <span key="b" className="rounded-md bg-success-bg px-2 py-px text-[12.5px] font-bold text-success">
                          {t.team.panelDataComplete}
                        </span>
                      ) : (
                        <span key="b" className="rounded-md bg-destructive-bg px-2 py-px text-[12.5px] font-bold text-destructive">
                          {t.team.panelDataGaps}
                        </span>
                      ),
                    ],
                  ] as [string, React.ReactNode][])
                : []),
            ]}
          />
        </Section>

        {canManage && (
          <Section title={t.team.panelPrivacy} hint={t.team.panelDeleteHint}>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => exportData("json")} disabled={exportUser.isPending} className="gap-1.5">
                <Download className="size-3.5" />
                {t.privacy.exportPerson} ({t.privacy.exportJson})
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportData("csv")} disabled={exportUser.isPending} className="gap-1.5">
                <Download className="size-3.5" />
                {t.privacy.exportCsv}
              </Button>
            </div>
          </Section>
        )}

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

        {member.role !== "company_admin" && (
          <div className="mt-4 border-t border-border pt-4">
            <Button variant="outline" onClick={() => onOpenDetails(member)} className="w-full">
              {member.role === "coordinator" ? t.team.panelEditStudioAdmins : t.team.panelEditContracts}
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
