import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/sentry/options";

Sentry.init({
  ...sentryBaseOptions,
  // Kein Session Replay und kein User-Feedback-Widget: beides würde
  // Bildschirminhalte bzw. Eingaben übertragen.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
