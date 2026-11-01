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
}

export interface OfferContractInput {
  companyId: string;
  email: string;
  employmentType: string;
  rateModel: string;
  rateAmount: number;
  validFrom: string;
  validTo?: string | null;
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

/** company_admin/platform_admin: Angebot an eine bestehende Person (per E-Mail). */
export async function offerContract(input: OfferContractInput): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("offer_contract", {
    target_company_id: input.companyId,
    target_email: input.email,
    p_employment_type: input.employmentType,
    p_rate_model: input.rateModel,
    p_rate_amount: input.rateAmount,
    p_valid_from: input.validFrom,
    p_valid_to: input.validTo ?? null,
  });
  if (error) throw error;
  return data as string;
}
