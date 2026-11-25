import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Company-Admins laden Trainer:innen ein und bieten ihnen im selben Schritt einen
// Vertrag an. Es gibt keine öffentliche Registrierung: Konten entstehen nur hier
// (Trainer:innen) bzw. in invite-company-admin (Company-Admins).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "missing_authorization" }, 401);
  }

  const body = await req.json().catch(() => null);
  const {
    company_id,
    email,
    employment_type,
    rate_model,
    rate_amount,
    valid_from,
    valid_to,
    studio_ids,
    redirectTo,
  } = body ?? {};
  if (!company_id || !email || !employment_type || !rate_model || rate_amount == null || !valid_from) {
    return json({ error: "missing_fields" }, 400);
  }

  // Alle Berechtigungsprüfungen laufen in offer_contract mit dem JWT der aufrufenden
  // Person (nur company_admin der Company bzw. platform_admin; sonst "not_authorized").
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // Der anon-Key ist ebenfalls ein gültiges JWT; ohne angemeldete Person sofort abbrechen.
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const offer = () =>
    userClient.rpc("offer_contract", {
      target_company_id: company_id,
      target_email: email,
      p_employment_type: employment_type,
      p_rate_model: rate_model,
      p_rate_amount: rate_amount,
      p_valid_from: valid_from,
      p_valid_to: valid_to ?? null,
      p_studio_ids: Array.isArray(studio_ids) && studio_ids.length > 0 ? studio_ids : null,
    });

  const first = await offer();
  if (!first.error) {
    return json({ invited: false, contract_id: first.data });
  }
  if (first.error.message === "not_authorized") {
    return json({ error: "not_authorized" }, 403);
  }
  if (first.error.message !== "user_not_found") {
    return json({ error: first.error.message }, 400);
  }

  // user_not_found erreicht nur, wer berechtigt ist (siehe oben): Konto per Einladung
  // anlegen und das Angebot danach erneut erzeugen.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (inviteError) {
    return json({ error: inviteError.message }, 400);
  }

  const second = await offer();
  if (second.error) {
    return json({ error: second.error.message }, 400);
  }
  return json({ invited: true, contract_id: second.data });
});
