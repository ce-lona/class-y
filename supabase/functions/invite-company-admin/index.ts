import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Nur diese beiden Werte sind von Supabase automatisch als Env-Var gesetzt;
// SUPABASE_SERVICE_ROLE_KEY ebenfalls, wird unten separat gelesen.
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

  const { company_id, email, redirectTo } = await req.json();
  if (!company_id || !email) {
    return json({ error: "company_id und email sind erforderlich" }, 400);
  }

  // Läuft mit dem JWT der aufrufenden Person — add_company_admin prüft
  // selbst is_platform_admin() und schlägt sonst mit "not_authorized" fehl.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { error: addError } = await userClient.rpc("add_company_admin", {
    target_company_id: company_id,
    target_email: email,
  });

  if (!addError) {
    return json({ invited: false });
  }

  if (addError.message !== "user_not_found") {
    return json({ error: addError.message }, 403);
  }

  // Existiert noch nicht: Konto per Supabase-Invite anlegen (verschickt die
  // "Invite user"-E-Mail über die konfigurierte SMTP) + Company-Admin-Zeile
  // mit der service_role anlegen, da die Person noch keine eigene Session hat.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );

  if (inviteError || !inviteData.user) {
    return json({ error: inviteError?.message ?? "invite_failed" }, 400);
  }

  const { error: insertError } = await adminClient
    .from("company_admins")
    .insert({ user_id: inviteData.user.id, company_id });

  if (insertError) {
    return json({ error: insertError.message }, 400);
  }

  return json({ invited: true });
});
