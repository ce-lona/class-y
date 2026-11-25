import { createClient } from "@/lib/supabase/client";

// DSGVO-Flows (Migration 20261125220000): Konto-Löschung durch Admins, Datenauskunft
// (Person/Company) und Company-Offboarding mit 30 Tagen Karenz.

export type CompanyPersonRole = "company_admin" | "coordinator" | "trainer";
export type DeleteBlockedReason = "self" | "other_company" | "active_plan";

export interface CompanyPerson {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: CompanyPersonRole[];
  delete_blocked_reason: DeleteBlockedReason | null;
}

/** "deleted" = Profil hart gelöscht; "anonymized" = Profil anonymisiert, Abrechnungsdaten bleiben. */
export type DeleteUserResult = "deleted" | "anonymized";

export type DataExport = Record<string, unknown>;

export async function getCompanyPeople(companyId: string): Promise<CompanyPerson[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_people", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return (data ?? []) as CompanyPerson[];
}

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("admin_delete_user", {
    target_user_id: userId,
  });
  if (error) throw error;
  return data as DeleteUserResult;
}

export async function exportUserData(userId: string): Promise<DataExport> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("export_user_data", {
    target_user_id: userId,
  });
  if (error) throw error;
  return data as DataExport;
}

export async function exportCompanyData(companyId: string): Promise<DataExport> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("export_company_data", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return data as DataExport;
}

export async function scheduleCompanyDeletion(companyId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("schedule_company_deletion", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelCompanyDeletion(companyId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_company_deletion", {
    target_company_id: companyId,
  });
  if (error) throw error;
}

export async function purgeDueCompanyDeletions(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("purge_due_company_deletions");
  if (error) throw error;
  return data as number;
}

// ─────────────────────────────────────────────────────────────────
// Download-Helfer (JSON / CSV)
// ─────────────────────────────────────────────────────────────────

export type ExportFormat = "json" | "csv";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows: Record<string, unknown>[]): string[] {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    columns.map(csvCell).join(";"),
    ...rows.map((row) => columns.map((col) => csvCell(row[col])).join(";")),
  ];
}

/**
 * Wandelt einen Export in eine CSV-Datei mit einem Abschnitt pro Bereich um
 * ("# contracts", Kopfzeile, Zeilen). Semikolon als Trenner für deutsches Excel.
 */
export function exportToCsv(data: DataExport): string {
  const lines: string[] = [];
  for (const [section, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    const rows = (Array.isArray(value) ? value : [value]) as Record<string, unknown>[];
    lines.push(`# ${section}`);
    if (rows.length > 0) lines.push(...rowsToCsv(rows));
    lines.push("");
  }
  return lines.join("\r\n");
}

export function downloadExport(data: DataExport, baseName: string, format: ExportFormat) {
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${baseName}-${date}.${format}`;
  const blob =
    format === "json"
      ? new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      : // BOM, damit Excel Umlaute korrekt als UTF-8 erkennt
        new Blob(["﻿", exportToCsv(data)], { type: "text/csv;charset=utf-8" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}
