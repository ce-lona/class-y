import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Dev-Hilfsfunktion, um Testkonten ohne echten E-Mail-Versand anzulegen
// (z.B. wenn Resend noch auf der Sandbox-Domain läuft). Nicht für echte
// Einladungen — dafür invite-company-admin.
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

  const { company_id, email, password } = await req.json();
  if (!company_id || !email || !password) {
    return json({ error: "company_id, email und password sind erforderlich" }, 400);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isPlatformAdmin, error: authError } = await userClient.rpc("is_platform_admin");
  if (authError || !isPlatformAdmin) {
    return json({ error: "not_authorized" }, 403);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !userData.user) {
    return json({ error: createError?.message ?? "create_failed" }, 400);
  }

  const { error: insertError } = await adminClient
    .from("company_admins")
    .insert({ user_id: userData.user.id, company_id });
  if (insertError) {
    return json({ error: insertError.message }, 400);
  }

  return json({ user_id: userData.user.id });
});
