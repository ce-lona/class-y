import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "email", "email_change", "signup", "magiclink"];

// Nur relative Pfade innerhalb der App zulassen (kein "//host" o. Ä.).
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = safeNext(searchParams.get("next"));
  redirectTo.search = "";

  const supabase = await createClient();

  // PKCE-Flow: vom Browser ausgelöst (z. B. "Passwort vergessen").
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  // token_hash-Flow: serverseitig ausgelöste Einladungen (supabase/templates/invite.html).
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/auth/error";
  return NextResponse.redirect(redirectTo);
}
