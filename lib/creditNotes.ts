import { createClient } from "@/lib/supabase/client";

/**
 * Gutschriften (Freiberufler:innen), Stornogutschriften und Tätigkeitsnachweise (Angestellte).
 * Siehe Migration 20261126120000_credit_notes.sql.
 */

export type BillingDocumentKind = "credit_note" | "cancellation" | "statement";
export type BillingDocumentStatus =
  | "open"
  | "approved"
  | "auto_approved"
  | "correction_requested"
  | "cancelled"
  | "issued"
  | "superseded";
export type BillingChange = "new" | "unchanged" | "changed";
export type BillingSkipReason =
  | "contract_not_confirmed"
  | "course_without_contract"
  | "name_missing"
  | "address_missing"
  | "iban_missing"
  | "tax_number_missing"
  | "consent_missing";

export interface BillingSettings {
  company_id: string;
  mode: "manual" | "scheduled";
  run_day: number;
  review_days: number;
  split_by_studio: boolean;
  employee_statements: boolean;
  payment_days: number;
  number_prefix: string;
  billing_address_complete: boolean;
  can_edit: boolean;
}

export type BillingSettingsInput = Omit<BillingSettings, "company_id" | "billing_address_complete" | "can_edit">;

export interface BillingPreviewRow {
  trainer_id: string;
  trainer_name: string;
  kind: "credit_note" | "statement";
  employment_type: string | null;
  kleinunternehmer: boolean;
  course_count: number;
  minutes: number;
  net: number;
  vat: number;
  gross: number;
  current_document_id: string | null;
  current_number: string | null;
  current_status: BillingDocumentStatus | null;
  current_gross: number | null;
  change: BillingChange;
  changed_lines: number;
  skip_reasons: BillingSkipReason[];
}

export interface BillingDocumentListItem {
  id: string;
  studio_id: string | null;
  studio_name: string | null;
  trainer_id: string;
  trainer_name: string | null;
  kind: BillingDocumentKind;
  number: string | null;
  version: number;
  issue_date: string;
  status: BillingDocumentStatus;
  review_due: string | null;
  net: number | null;
  vat: number | null;
  gross: number | null;
  course_count: number;
  open_comments: number;
  can_view_amounts: boolean;
}

export interface BillingComment {
  id: string;
  document_id: string;
  document_kind: BillingDocumentKind;
  document_number: string | null;
  document_version: number;
  trainer_name: string | null;
  kind: "correction_request" | "comment";
  body: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
}

export interface MyBillingDocument {
  id: string;
  company_id: string;
  company_name: string;
  studio_name: string | null;
  month: string;
  kind: BillingDocumentKind;
  number: string | null;
  version: number;
  issue_date: string;
  status: BillingDocumentStatus;
  review_due: string | null;
  gross: number;
  vat: number;
  course_count: number;
  replaces_number: string | null;
  last_comment: string | null;
}

export interface BillingLine {
  key: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  studio_id: string;
  studio: string;
  course: string;
  substitution: boolean;
  ad_hoc: boolean;
  rate_model: string | null;
  fee: number | null;
}

export interface BillingAddress {
  name: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
}

export interface BillingSnapshot {
  issuer: BillingAddress;
  recipient: BillingAddress & {
    tax_number: string | null;
    vat_id: string | null;
    iban: string | null;
    kleinunternehmer: boolean;
  };
  studio_name: string | null;
  employment_type: string | null;
  rate_model: string | null;
  rate_amount: number | null;
  consent_at: string | null;
  period_from: string;
  period_to: string;
  payment_due: string;
  payment_days: number;
  lines: BillingLine[];
  fixed_amount: number | null;
  course_count: number;
  minutes: number;
  replaces?: {
    number: string;
    issue_date: string;
    gross: number;
    cancellation_number: string;
    cancellation_date: string;
  };
  cancels?: { number: string; issue_date: string };
  correction_request?: string | null;
}

export interface BillingDocument {
  id: string;
  kind: BillingDocumentKind;
  number: string | null;
  version: number;
  issue_date: string;
  status: BillingDocumentStatus;
  review_due: string | null;
  net: number;
  vat_rate: number;
  vat: number;
  gross: number;
  snapshot: BillingSnapshot;
}

export interface IssueResult {
  created: number;
  cancelled: number;
  statements: number;
  skipped: number;
}

export interface MyBillingDetails {
  tax_number: string | null;
  vat_id: string | null;
  iban: string | null;
}

export interface ContractMasterDataInput {
  contractId: string;
  fullName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  iban: string;
  taxNumber: string | null;
  vatId: string | null;
  kleinunternehmer: boolean;
  consent: boolean;
}

const toNumber = (v: unknown): number => Number(v ?? 0);
const toNullableNumber = (v: unknown): number | null => (v == null ? null : Number(v));

/** Erster Tag des Monats als YYYY-MM-01. */
function monthParam(month: string): string {
  return `${month.slice(0, 7)}-01`;
}

// ─────────────────────────────────────────────────────────────────
// IBAN (gleiche Prüfung wie is_valid_iban in der Datenbank)
// ─────────────────────────────────────────────────────────────────

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of rearranged) {
    const digits = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

export function formatIban(value: string | null | undefined): string {
  return value ? normalizeIban(value).replace(/(.{4})/g, "$1 ").trim() : "";
}

// ─────────────────────────────────────────────────────────────────
// Vertrag annehmen / bestätigen, eigene Abrechnungsdaten
// ─────────────────────────────────────────────────────────────────

export async function acceptContractWithMasterData(input: ContractMasterDataInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("accept_contract_with_master_data", {
    target_contract_id: input.contractId,
    p_full_name: input.fullName,
    p_street: input.street,
    p_house_number: input.houseNumber,
    p_postal_code: input.postalCode,
    p_city: input.city,
    p_iban: normalizeIban(input.iban),
    p_tax_number: input.taxNumber,
    p_vat_id: input.vatId,
    p_kleinunternehmer: input.kleinunternehmer,
    p_credit_note_consent: input.consent,
  });
  if (error) throw error;
}

export async function confirmContract(contractId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("confirm_contract", { target_contract_id: contractId });
  if (error) throw error;
}

export async function getMyBillingDetails(): Promise<MyBillingDetails> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trainer_billing_details")
    .select("tax_number, vat_id, iban")
    .maybeSingle();
  if (error) throw error;
  return (data as MyBillingDetails | null) ?? { tax_number: null, vat_id: null, iban: null };
}

export async function saveMyBillingDetails(input: MyBillingDetails): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error("not_authenticated");

  const { error } = await supabase.from("trainer_billing_details").upsert({
    user_id: user.id,
    tax_number: input.tax_number?.trim() || null,
    vat_id: input.vat_id?.trim() || null,
    iban: input.iban ? normalizeIban(input.iban) : null,
  });
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────
// Einstellungen
// ─────────────────────────────────────────────────────────────────

export async function getBillingSettings(companyId: string): Promise<BillingSettings> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_billing_settings", {
    target_company_id: companyId,
  });
  if (error) throw error;
  const row = (data as BillingSettings[] | null)?.[0];
  if (!row) throw new Error("not_found");
  return row;
}

export async function saveBillingSettings(companyId: string, input: BillingSettingsInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("company_billing_settings").upsert({
    company_id: companyId,
    ...input,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────
// Studio-Seite
// ─────────────────────────────────────────────────────────────────

export async function getBillingPreview(params: {
  companyId: string;
  month: string;
  studioId: string | null;
}): Promise<BillingPreviewRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_billing_preview", {
    target_company_id: params.companyId,
    p_month: monthParam(params.month),
    p_studio_id: params.studioId,
  });
  if (error) throw error;
  return ((data ?? []) as BillingPreviewRow[]).map((r) => ({
    ...r,
    net: toNumber(r.net),
    vat: toNumber(r.vat),
    gross: toNumber(r.gross),
    current_gross: toNullableNumber(r.current_gross),
    skip_reasons: r.skip_reasons ?? [],
  }));
}

export async function issueBillingDocuments(params: {
  companyId: string;
  month: string;
  studioId: string | null;
}): Promise<IssueResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("issue_billing_documents", {
    target_company_id: params.companyId,
    p_month: monthParam(params.month),
    p_studio_id: params.studioId,
  });
  if (error) throw error;
  return data as IssueResult;
}

export async function getBillingDocuments(companyId: string, month: string): Promise<BillingDocumentListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_billing_documents", {
    target_company_id: companyId,
    p_month: monthParam(month),
  });
  if (error) throw error;
  return ((data ?? []) as BillingDocumentListItem[]).map((d) => ({
    ...d,
    net: toNullableNumber(d.net),
    vat: toNullableNumber(d.vat),
    gross: toNullableNumber(d.gross),
  }));
}

export async function getBillingComments(companyId: string, month: string): Promise<BillingComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_billing_comments", {
    target_company_id: companyId,
    p_month: monthParam(month),
  });
  if (error) throw error;
  return (data ?? []) as BillingComment[];
}

export async function resolveBillingComment(commentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_billing_comment", { target_comment_id: commentId });
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────
// Trainer-Seite + PDF-Daten
// ─────────────────────────────────────────────────────────────────

export async function getMyBillingDocuments(): Promise<MyBillingDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_billing_documents");
  if (error) throw error;
  return ((data ?? []) as MyBillingDocument[]).map((d) => ({
    ...d,
    gross: toNumber(d.gross),
    vat: toNumber(d.vat),
  }));
}

export async function getBillingDocument(documentId: string): Promise<BillingDocument> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_billing_document", {
    target_document_id: documentId,
  });
  if (error) throw error;
  const row = (data as BillingDocument[] | null)?.[0];
  if (!row) throw new Error("not_found");
  return {
    ...row,
    net: toNumber(row.net),
    vat_rate: toNumber(row.vat_rate),
    vat: toNumber(row.vat),
    gross: toNumber(row.gross),
  };
}

export async function approveBillingDocument(documentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("approve_billing_document", {
    target_document_id: documentId,
  });
  if (error) throw error;
}

export async function commentBillingDocument(documentId: string, body: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("comment_billing_document", {
    target_document_id: documentId,
    p_body: body,
  });
  if (error) throw error;
}

/** Bekannte Fehlercodes aus der Datenbank → Schlüssel für t.creditNotes.errors. */
export function creditNoteErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error ?? "");
  const known = [
    "company_billing_address_missing",
    "month_not_finished",
    "not_authorized",
    "invalid_iban",
    "iban_missing",
    "tax_number_missing",
    "consent_missing",
    "address_missing",
    "name_missing",
    "master_data_incomplete",
    "contract_not_active",
    "document_not_found_or_not_open",
    "document_not_correctable",
    "comment_required",
    "contract_not_found_or_not_acceptable",
  ];
  return known.find((code) => message.includes(code)) ?? "generic";
}
