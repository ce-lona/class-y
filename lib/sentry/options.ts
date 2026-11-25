import type { Breadcrumb, ErrorEvent, Event } from "@sentry/nextjs";

/**
 * Gemeinsame Sentry-Optionen für Browser, Node und Edge.
 *
 * Datenschutz: Es werden keine personenbezogenen Daten gesendet
 * (`sendDefaultPii: false`, kein Session Replay, kein User-Kontext). `scrubEvent`
 * entfernt zusätzlich Cookies, Header, Request-Bodies, Query-Strings sowie
 * E-Mail-Adressen und Tokens aus Fehlermeldungen und Breadcrumbs.
 *
 * Ohne `NEXT_PUBLIC_SENTRY_DSN` ist Sentry komplett deaktiviert (z.B. lokal).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryBaseOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  // Wenige Performance-Traces, damit das Free-Kontingent reicht.
  tracesSampleRate: 0.1,
  beforeSend: (event: ErrorEvent) => scrubEvent(event),
  beforeSendTransaction: <T extends Event>(event: T) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb: Breadcrumb) => scrubBreadcrumb(breadcrumb),
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// JWTs (z.B. Supabase-Access-Tokens)
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g;

export function scrubText(text: string): string {
  return text
    .replace(JWT, "[token]")
    .replace(EMAIL, "[email]")
    .replace(IBAN, "[iban]");
}

function stripQuery(url: string): string {
  const index = url.search(/[?#]/);
  return scrubText(index === -1 ? url : url.slice(0, index));
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.message) breadcrumb.message = scrubText(breadcrumb.message);
  // Console-Breadcrumbs enthalten die rohen Argumente (z.B. ungefilterte Fehlertexte).
  if (breadcrumb.category === "console") delete breadcrumb.data;
  if (breadcrumb.data) {
    for (const key of ["url", "from", "to"]) {
      const value = breadcrumb.data[key];
      if (typeof value === "string") breadcrumb.data[key] = stripQuery(value);
    }
  }
  return breadcrumb;
}

export function scrubEvent<T extends Event>(event: T): T {
  delete event.user;

  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    delete event.request.env;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    if (event.request.headers) {
      const userAgent = event.request.headers["user-agent"] ?? event.request.headers["User-Agent"];
      event.request.headers = userAgent ? { "user-agent": userAgent } : {};
    }
  }

  if (event.message) event.message = scrubText(event.message);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }

  event.breadcrumbs?.forEach(scrubBreadcrumb);

  if (event.transaction) event.transaction = stripQuery(event.transaction);

  // Kontexte (z.B. nextjs.request_path), Extras und Tags: Query-Strings und
  // E-Mails/Tokens auch dort entfernen.
  if (event.contexts?.nextjs && typeof event.contexts.nextjs.request_path === "string") {
    event.contexts.nextjs.request_path = stripQuery(event.contexts.nextjs.request_path);
  }
  if (event.contexts) event.contexts = scrubDeep(event.contexts) as typeof event.contexts;
  if (event.extra) event.extra = scrubDeep(event.extra) as typeof event.extra;
  if (event.tags) event.tags = scrubDeep(event.tags) as typeof event.tags;

  return event;
}

function scrubDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubText(value);
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, scrubDeep(item, depth + 1)]),
  );
}
