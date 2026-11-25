import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV === "development";

// Supabase (REST, Auth, Storage, Realtime) wird direkt aus dem Browser angesprochen.
// NEXT_PUBLIC_SUPABASE_URL ist zur Build-Zeit bekannt, deshalb landet der Origin fest im Header.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
const supabaseOrigin = supabaseUrl.origin;
const supabaseRealtime = `${supabaseUrl.protocol === "https:" ? "wss:" : "ws:"}//${supabaseUrl.host}`;

// Sentry-Ingest (US- und EU-Region). Mit tunnelRoute laufen Events über 'self'.
const sentryIngest = "https://*.ingest.sentry.io https://*.ingest.de.sentry.io";

// Ohne Nonces (die würden jede Seite dynamisch rendern) braucht Next.js 'unsafe-inline' für
// seine Inline-Skripte. Die übrigen Direktiven begrenzen trotzdem, wohin Daten abfließen können.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseRealtime} ${sentryIngest}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Nur wenn Supabase per HTTPS läuft: sonst würde der lokale Docker-Build
  // (NODE_ENV=production gegen http://127.0.0.1:54321) seine API-Aufrufe verlieren.
  ...(supabaseUrl.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Browser ignorieren HSTS über http (z.B. localhost); "preload" bewusst weggelassen,
  // weil der Eintrag in die Preload-Liste kaum rückgängig zu machen ist.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Sourcemap-Upload passiert nur, wenn SENTRY_AUTH_TOKEN, SENTRY_ORG und
// SENTRY_PROJECT beim Build gesetzt sind; ohne sie baut die App normal.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // EU-Region (de.sentry.io); wird bei sntrys_-Tokens auch automatisch erkannt.
  sentryUrl: process.env.SENTRY_URL ?? "https://de.sentry.io",
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
