import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Serverseitiger Proxy für die HaveIBeenPwned-Range-API (lib/passwordBreach.ts).
// So sieht HIBP nur die IP des Servers, nie die der Nutzer:innen. Der Browser schickt nur die
// ersten 5 Zeichen des SHA-1-Hashs; Passwort und vollständiger Hash bleiben im Browser.
// Nur für angemeldete Sitzungen (Einladung/Passwort-Reset), damit das kein offener Proxy ist.

export const dynamic = "force-dynamic";

const PREFIX_PATTERN = /^[0-9A-F]{5}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ prefix: string }> },
) {
  const { prefix } = await params;
  const normalized = prefix.toUpperCase();
  if (!PREFIX_PATTERN.test(normalized)) {
    return NextResponse.json({ error: "invalid_prefix" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${normalized}`, {
      headers: { "Add-Padding": "true", "User-Agent": "class-y-password-check" },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }
    return new NextResponse(await response.text(), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }
}
