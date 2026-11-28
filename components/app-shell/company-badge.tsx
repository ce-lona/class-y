import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

// Feste, gedämpfte Farben je Company (aus dem Prototyp), gewählt über einen Hash der ID.
const COLORS = ["#1F5F5C", "#5450C4", "#9A6203", "#B23A63", "#1D8A5F", "#56677A", "#7D4A96", "#B2531C"];

export function companyColor(id: string): string {
  let hash = 7;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  return COLORS[hash % COLORS.length];
}

/** Quadrat mit Initialen der Company (Company-Wechsler, Plattform-Übersicht). */
export function CompanyBadge({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ background: companyColor(id) }}
      className={cn(
        "grid size-[30px] shrink-0 place-items-center rounded-lg font-heading text-xs font-extrabold text-white",
        className,
      )}
    >
      {getInitials(name, name)}
    </span>
  );
}
