import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Plattform-Admin hinzufügen (z. B. künftige Mitarbeiter:innen). Existiert die Person noch
// nicht, wird sie per Supabase-Invite eingeladen und danach eingetragen.
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

  const { email, redirectTo } = await req.json();
  if (!email) {
    return json({ error: "email ist erforderlich" }, 400);
  }

  // Läuft mit dem JWT der aufrufenden Person — add_platform_admin prüft
  // selbst is_platform_admin() und schlägt sonst mit "not_authorized" fehl.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const add = () => userClient.rpc("add_platform_admin", { target_email: email });

  const first = await add();
  if (!first.error) {
    return json({ invited: false });
  }

  if (first.error.message !== "user_not_found") {
    return json({ error: first.error.message }, 403);
  }

  // Erst nach erfolgreicher Rechteprüfung (user_not_found kommt nur für Plattform-Admins)
  // das Konto per Invite anlegen und danach mit dem JWT der aufrufenden Person eintragen.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (inviteError) {
    return json({ error: inviteError.message }, 400);
  }

  const second = await add();
  if (second.error) {
    return json({ error: second.error.message }, 400);
  }

  return json({ invited: true });
});
