import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Company-Admins laden Kurskoordinatoren ein und weisen ihnen exklusive Studios zu.
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
  const { company_id, email, studio_ids, redirectTo } = body ?? {};
  if (!company_id || !email || !Array.isArray(studio_ids) || studio_ids.length === 0) {
    return json({ error: "missing_fields" }, 400);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const assign = () =>
    userClient.rpc("set_studio_coordinator_studios", {
      target_company_id: company_id,
      target_email: email,
      p_studio_ids: studio_ids,
    });

  const first = await assign();
  if (!first.error) {
    return json({ invited: false, user_id: first.data });
  }
  if (first.error.message === "not_authorized") {
    return json({ error: "not_authorized" }, 403);
  }
  if (first.error.message !== "user_not_found") {
    return json({ error: first.error.message }, 400);
  }

  // Konto existiert noch nicht -> per Supabase-Einladung anlegen und danach zuweisen.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (inviteError) {
    return json({ error: inviteError.message }, 400);
  }

  const second = await assign();
  if (second.error) {
    return json({ error: second.error.message }, 400);
  }
  return json({ invited: true, user_id: second.data });
});
