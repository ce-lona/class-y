"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Info,
  MessageSquare,
  Send,
} from "lucide-react";
import { useStudioAdminPermissions } from "@/hooks/useStudioAdminPermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { BillingStatusBadge, kindLabel } from "@/components/billing-status-badge";
import {
  useBillingComments,
  useBillingDocuments,
  useBillingPreview,
  useBillingSettings,
  useIssueBillingDocuments,
  useResolveBillingComment,
} from "@/hooks/useCreditNotes";
import { useStudios } from "@/hooks/useStudios";
import type { ManagedCompany } from "@/lib/companyAdmins";
import {
  creditNoteErrorCode,
  getBillingDocument,
  type BillingPreviewRow,
  type IssueResult,
} from "@/lib/creditNotes";
import { buildCreditNotePdf, creditNotePdfFileName } from "@/lib/creditNotePdf";
import {
  downloadFile,
  formatEuro,
  formatMonthDE,
  getDefaultBillingMonth,
  getRecentMonths,
  isMonthOpen,
} from "@/lib/billingExport";
import { fillTemplate as fill, formatDateDE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const C = t.creditNotes;

function skipLabel(reason: string): string {
  return C.skipReasons[reason as keyof typeof C.skipReasons] ?? reason;
}

export async function downloadBillingDocumentPdf(documentId: string, trainerName?: string | null) {
  const doc = await getBillingDocument(documentId);
  downloadFile(buildCreditNotePdf(doc), creditNotePdfFileName(doc, trainerName), "application/pdf");
}

function changeLabel(row: BillingPreviewRow): string {
  if (row.skip_reasons.length > 0) return C.change.skipped;
  if (row.change === "new") return C.change.new;
  if (row.change === "unchanged") return C.change.unchanged;
  return row.kind === "credit_note" ? C.change.changedCredit : C.change.changedStatement;
}

/**
 * Abrechnung → „Gutschriften & Nachweise“ für Company-Admins und Koordinator:innen.
 * Erstellen dürfen bei Abrechnung je Company nur Company-Admins, bei Abrechnung je Studio auch
 * Koordinator:innen für ihre Studios. Koordinator:innen sehen Belege, die ihre Studios betreffen.
 */
export function BillingDocumentsPanel({ company }: { company: ManagedCompany }) {
  const months = useMemo(() => getRecentMonths(13), []);
  const [month, setMonth] = useState<string>(() => getDefaultBillingMonth());
  const { data: settings } = useBillingSettings(company.id);
  const { data: allStudios } = useStudios(company.id);
  const isAdmin = company.role === "company_admin";
  const split = settings?.split_by_studio ?? false;

  const studios = useMemo(() => {
    const list = allStudios ?? [];
    if (isAdmin || !company.studio_ids) return list;
    return list.filter((s) => company.studio_ids?.includes(s.id));
  }, [allStudios, isAdmin, company.studio_ids]);

  const [studioChoice, setStudioChoice] = useState<string | null>(null);
  const studioId = split ? (studios.find((s) => s.id === studioChoice)?.id ?? studios[0]?.id ?? null) : null;
  // Nicht getrennte Abrechnung: Studio-Admins nur mit Recht „Abrechnungen ausstellen“.
  const { data: permissions } = useStudioAdminPermissions(isAdmin ? undefined : company.id);
  const canIssue = split ? !!studioId : isAdmin || permissions?.billing === "allowed";
  const monthOpen = isMonthOpen(month);

  const preview = useBillingPreview({
    companyId: company.id,
    month,
    studioId,
    enabled: !!settings && canIssue && !monthOpen,
  });
  const documents = useBillingDocuments(company.id, month);
  const comments = useBillingComments(company.id, month);
  const issue = useIssueBillingDocuments(company.id);
  const resolve = useResolveBillingComment(company.id);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [pdfError, setPdfError] = useState(false);

  const rows = useMemo(() => preview.data ?? [], [preview.data]);
  const skipped = rows.filter((r) => r.skip_reasons.length > 0);
  const actionable = rows.filter((r) => r.skip_reasons.length === 0 && r.change !== "unchanged");
  const nextNew = actionable.filter((r) => r.change === "new" && r.kind === "credit_note").length;
  const nextCorrections = actionable.filter((r) => r.change === "changed" && r.kind === "credit_note").length;
  const nextStatements = actionable.filter((r) => r.kind === "statement").length;

  const docs = useMemo(
    () => (documents.data ?? []).filter((d) => !split || !studioId || d.studio_id === studioId),
    [documents.data, split, studioId],
  );
  const lastIssue = docs.reduce<string | null>(
    (max, d) => (max == null || d.issue_date > max ? d.issue_date : max),
    null,
  );
  const commentList = comments.data ?? [];
  const docIds = new Set(docs.map((d) => d.id));
  const visibleComments = split ? commentList.filter((c) => docIds.has(c.document_id)) : commentList;

  async function onIssue() {
    setResult(null);
    try {
      const res = await issue.mutateAsync({ month, studioId });
      setResult(res);
    } catch {
      // Fehler wird unten angezeigt.
    }
  }

  async function onPdf(id: string, name: string | null) {
    setPdfError(false);
    try {
      await downloadBillingDocumentPdf(id, name);
    } catch {
      setPdfError(true);
    }
  }

  const nextParts = [
    nextNew > 0 ? fill(C.nextNew, { count: nextNew }) : null,
    nextCorrections > 0 ? fill(C.nextCorrections, { count: nextCorrections }) : null,
    nextStatements > 0 ? fill(C.nextStatements, { count: nextStatements }) : null,
    skipped.length > 0 ? fill(C.nextSkipped, { count: skipped.length }) : null,
  ].filter(Boolean);

  const issueErrorKey = issue.isError
    ? (creditNoteErrorCode(issue.error) as keyof typeof C.errors)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {settings &&
            [
              split ? C.perStudio : C.perCompany,
              settings.mode === "scheduled" ? fill(C.modeScheduled, { day: settings.run_day }) : C.modeManual,
            ].join(" · ")}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {split && studios.length > 0 && (
            <Select value={studioId ?? ""} onValueChange={(v) => v && setStudioChoice(v)}>
              <SelectTrigger aria-label={C.studioLabel} className="min-w-44">
                <SelectValue>{(value: string) => studios.find((s) => s.id === value)?.name ?? ""}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {studios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={month}
            onValueChange={(v) => {
              if (!v) return;
              setMonth(v);
              setResult(null);
            }}
          >
            <SelectTrigger aria-label={t.billing.monthLabel} className="min-w-40">
              <SelectValue>{(value: string) => formatMonthDE(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthDE(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Erstellen */}
      {!canIssue ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>{C.coordinatorNoButton}</p>
        </div>
      ) : monthOpen ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>{C.monthOpen}</p>
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-bold">{formatMonthDE(month)}</h2>
              <p className="text-sm text-muted-foreground">
                {lastIssue
                  ? [
                      fill(C.statusCreatedAt, { date: formatDateDE(lastIssue) }),
                      actionable.length === 1
                        ? C.statusChangesOne
                        : actionable.length > 1
                          ? fill(C.statusChanges, { count: actionable.length })
                          : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : C.statusNone}
              </p>
              {!preview.isLoading && rows.length > 0 && (
                <p className="text-sm">
                  {nextParts.length > 0 && actionable.length > 0
                    ? fill(C.nextClick, { parts: nextParts.join(", ") })
                    : C.nextClickNothing}
                </p>
              )}
            </div>
            <Button
              className="gap-1.5"
              disabled={issue.isPending || !settings?.billing_address_complete || actionable.length === 0}
              onClick={onIssue}
              data-testid="issue-billing-documents"
            >
              <Send className="size-4" />
              <span>{issue.isPending ? C.issuing : C.issue}</span>
            </Button>
          </div>

          {result && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-success-bg px-3.5 py-2.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              {fill(C.issued, { ...result })}
            </p>
          )}
          {issueErrorKey && <p className="mt-4 text-sm text-destructive">{C.errors[issueErrorKey]}</p>}

          {/* Prüfliste */}
          <div className="mt-5 space-y-2 border-t border-border pt-4">
            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{C.checklistTitle}</p>
            {settings?.billing_address_complete ? (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                {C.checkAddressOk}
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{C.checkAddressMissing}</span>
                <Link href="/settings?tab=billing#company-address" className="font-semibold underline">
                  {C.checkAddressLink}
                </Link>
              </p>
            )}
            {skipped.length === 0 ? (
              rows.length > 0 && (
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                  {C.checkNothingSkipped}
                </p>
              )
            ) : (
              <div className="space-y-1.5 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-warning">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    {skipped.length === 1 ? C.checkSkippedOne : fill(C.checkSkipped, { count: skipped.length })}
                  </span>
                  <Link href="/trainers" className="font-semibold underline">
                    {C.checkContractsLink}
                  </Link>
                </p>
                <ul className="ml-6 list-disc space-y-0.5 text-muted-foreground">
                  {skipped.map((r) => (
                    <li key={`${r.trainer_id}-${r.kind}`}>
                      <span className="font-medium text-foreground">{r.trainer_name}</span>:{" "}
                      {r.skip_reasons.map(skipLabel).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Vorschau */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {fill(C.previewTitle, { month: formatMonthDE(month) })}
            </p>
            {preview.isLoading ? (
              <p className="text-sm text-muted-foreground">{t.common.loading}</p>
            ) : preview.isError ? (
              <p className="text-sm text-destructive">{t.common.error}</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{C.previewEmpty}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3.5">{C.cols.person}</TableHead>
                      <TableHead className="px-3">{C.cols.document}</TableHead>
                      <TableHead className="px-3 text-right">{C.cols.courses}</TableHead>
                      <TableHead className="px-3 text-right">{C.cols.gross}</TableHead>
                      <TableHead className="px-3">{C.cols.status}</TableHead>
                      <TableHead className="px-3.5">{C.cols.next}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={`${r.trainer_id}-${r.kind}`} data-testid="billing-preview-row">
                        <TableCell className="px-3.5 font-semibold">
                          {r.trainer_name}
                          {r.kind === "credit_note" && r.kleinunternehmer && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{C.kleinunternehmer}</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 text-muted-foreground">
                          {kindLabel(r.kind)}
                          {r.current_number && <span className="ml-1.5 tabular-nums">{r.current_number}</span>}
                        </TableCell>
                        <TableCell className="px-3 text-right tabular-nums">{r.course_count}</TableCell>
                        <TableCell className="px-3 text-right tabular-nums">{formatEuro(Number(r.gross))}</TableCell>
                        <TableCell className="px-3">
                          {r.current_status ? (
                            <BillingStatusBadge status={r.current_status} reviewDue={null} />
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3.5">
                          <span
                            className={cn(
                              "text-sm",
                              r.skip_reasons.length > 0
                                ? "font-medium text-warning"
                                : r.change === "unchanged"
                                  ? "text-muted-foreground"
                                  : "font-medium",
                            )}
                            title={r.skip_reasons.map(skipLabel).join(", ") || undefined}
                          >
                            {changeLabel(r)}
                          </span>
                          {r.change === "changed" && r.changed_lines > 0 && r.skip_reasons.length === 0 && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              (
                              {r.changed_lines === 1
                                ? C.change.linesOne
                                : fill(C.change.lines, { count: r.changed_lines })}
                              )
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Korrekturwünsche */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="font-heading text-lg font-bold">{C.commentsTitle}</h2>
          {visibleComments.filter((c) => !c.resolved_at).length > 0 && (
            <Badge className="bg-warning-bg text-warning">
              {fill(C.openComments, { count: visibleComments.filter((c) => !c.resolved_at).length })}
            </Badge>
          )}
        </div>
        {comments.isLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : visibleComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{C.commentsEmpty}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {visibleComments.map((c) => (
              <li
                key={c.id}
                className={cn("flex flex-wrap items-start justify-between gap-3 p-4", c.resolved_at && "opacity-60")}
                data-testid="billing-comment"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm">
                    <span className="font-semibold">{c.trainer_name}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {fill(C.commentOn, {
                        kind: kindLabel(c.document_kind),
                        number: c.document_number ?? fill(C.version, { version: c.document_version }),
                      })}
                      {" · "}
                      {new Date(c.created_at).toLocaleDateString("de-DE")}
                    </span>
                  </p>
                  <p className="text-sm whitespace-pre-line">„{c.body}“</p>
                  {c.resolved_at && (
                    <p className="text-xs text-muted-foreground">
                      {C.resolved}{" "}
                      {fill(C.resolvedBy, {
                        name: c.resolved_by_name ?? "",
                        date: new Date(c.resolved_at).toLocaleDateString("de-DE"),
                      })}
                    </p>
                  )}
                </div>
                {!c.resolved_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate(c.id)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>{C.resolve}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {resolve.isError && <p className="mt-3 text-sm text-destructive">{C.errors.generic}</p>}
      </section>

      {/* Belege */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <h2 className="font-heading text-lg font-bold">
            {fill(C.documentsTitle, { month: formatMonthDE(month) })}
          </h2>
        </div>
        {documents.isLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : documents.isError ? (
          <p className="text-sm text-destructive">{t.common.error}</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{C.documentsEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3.5">{C.cols.person}</TableHead>
                  <TableHead className="px-3">{C.cols.document}</TableHead>
                  <TableHead className="px-3 text-right">{C.cols.courses}</TableHead>
                  <TableHead className="px-3 text-right">{C.cols.gross}</TableHead>
                  <TableHead className="px-3">{C.cols.status}</TableHead>
                  <TableHead className="px-3.5 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id} data-testid="billing-document-row">
                    <TableCell className="px-3.5 font-semibold">
                      {d.trainer_name}
                      {d.studio_name && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{d.studio_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 text-muted-foreground">
                      {kindLabel(d.kind)}{" "}
                      <span className="tabular-nums">
                        {d.number ?? fill(C.version, { version: d.version })}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 text-right tabular-nums">{d.course_count}</TableCell>
                    <TableCell className="px-3 text-right tabular-nums">
                      {d.can_view_amounts && d.gross != null ? (
                        formatEuro(Number(d.gross))
                      ) : (
                        <span className="text-xs text-muted-foreground">{C.amountsHidden}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <BillingStatusBadge status={d.status} reviewDue={d.review_due} />
                        {d.open_comments > 0 && (
                          <Badge className="gap-1 bg-warning-bg text-warning">
                            <MessageSquare className="size-3" />
                            {d.open_comments}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3.5 text-right">
                      {d.can_view_amounts && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => onPdf(d.id, d.trainer_name)}
                        >
                          <Download className="size-3.5" />
                          <span>{C.downloadPdf}</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {pdfError && <p className="mt-3 text-sm text-destructive">{C.errors.generic}</p>}
      </section>
    </div>
  );
}
