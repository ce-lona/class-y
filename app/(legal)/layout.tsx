import Link from "next/link";
import { Logo } from "@/components/logo";
import { LegalLinks } from "@/components/legal-links";
import { t } from "@/i18n/de";

// Öffentliche Rechtstexte: ohne Login erreichbar, deshalb eigene Gruppe ohne Auth-Guard.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="flex h-16 items-center border-b border-border px-5 sm:px-12">
        <Link href="/" className="text-xl">
          <Logo aria-hidden="true" />
          <span className="sr-only">{t.legal.backHome}</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">{children}</main>
      <footer className="flex flex-col gap-2 border-t border-border bg-card px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-12">
        <p>{t.landing.footerCopyright}</p>
        <LegalLinks />
      </footer>
    </div>
  );
}
