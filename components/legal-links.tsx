import Link from "next/link";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const links = [
  { href: "/impressum", label: t.legal.impressum },
  { href: "/datenschutz", label: t.legal.datenschutz },
  { href: "/agb", label: t.legal.agb },
] as const;

/** Links auf Impressum, Datenschutz und AGB für Footer und Login. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label={t.legal.navLabel} className={cn("flex flex-wrap gap-x-4 gap-y-1", className)}>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="hover:underline">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
