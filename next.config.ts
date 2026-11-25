import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
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
