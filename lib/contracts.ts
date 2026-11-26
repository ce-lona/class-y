import { createClient } from "@/lib/supabase/client";

export type ContractStatus = "pending" | "active" | "ended" | "declined";

export interface MyContract {
  id: string;
  company_id: string;
  company_name: string;
  employment_type: string;
  rate_model: string;
  rate_amount: number;
  valid_from: string;
  valid_to: string | null;
  status: ContractStatus;
  accepted_at: string | null;
  studio_ids?: string[];
  credit_note_consent_at: string | null;
  confirmed_at: string | null;
  /** Fehlende Abrechnungsangaben (nur bei aktiven Verträgen), z.B. "iban_missing". */
  master_data_gaps: string[];
}

export interface OfferContractInput {
  companyId: string;
  email: string;
  employmentType: string;
  rateModel: string;
  rateAmount: number;
  validFrom: string;
  validTo?: string | null;
  studioIds?: string[];
}

/** Eigene Contracts (Angebote, aktive, beendete) inkl. Company-Name. */
export async function getMyContracts(): Promise<MyContract[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_contracts");
  if (error) throw error;
  return (data ?? []) as MyContract[];
}

/** Trainer:in nimmt ein Angebot an; erst danach ist der Contract wirksam. */
export async function acceptContract(contractId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("accept_contract", {
    target_contract_id: contractId,
  });
  if (error) throw error;
}

export async function declineContract(contractId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("decline_contract", {
    target_contract_id: contractId,
  });
  if (error) throw error;
}

/**
 * company_admin/platform_admin: lädt die Person per E-Mail ein (falls sie noch kein Konto hat)
 * und bietet ihr im selben Schritt einen Vertrag an. Es gibt keine Selbstregistrierung.
 */
export async function offerContract(
  input: OfferContractInput,
): Promise<{ invited: boolean; contractId: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("invite-trainer", {
    body: {
      company_id: input.companyId,
      email: input.email,
      employment_type: input.employmentType,
      rate_model: input.rateModel,
      rate_amount: input.rateAmount,
      valid_from: input.validFrom,
      valid_to: input.validTo ?? null,
      studio_ids: input.studioIds && input.studioIds.length > 0 ? input.studioIds : null,
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    },
  });
  if (error) {
    if ("context" in error && error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error ?? error.message);
    }
    throw error;
  }
  return { invited: data.invited, contractId: data.contract_id };
}

export interface CompanyContract {
  id: string;
  trainer_email: string;
  trainer_name: string | null;
  employment_type: string;
  rate_model: string;
  rate_amount: number;
  valid_from: string;
  valid_to: string | null;
  status: ContractStatus;
  accepted_at: string | null;
  studio_ids?: string[];
  confirmed_at: string | null;
  master_data_gaps: string[];
  /** Stammdaten wurden nach der Bestätigung geändert. */
  master_data_changed: boolean;
}

/** company_admin/platform_admin: alle Verträge und Angebote einer Company. */
export async function getCompanyContracts(companyId: string): Promise<CompanyContract[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_contracts", {
    target_company_id: companyId,
  });
  if (error) throw error;
  return (data ?? []) as CompanyContract[];
}

/** Beendet einen angenommenen Vertrag bzw. zieht ein offenes Angebot zurück. */
export async function endContract(contractId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ status: "ended" })
    .eq("id", contractId);
  if (error) throw error;
}
