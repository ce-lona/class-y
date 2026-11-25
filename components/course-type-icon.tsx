import { createElement } from "react";
import {
  Activity,
  Baby,
  Bike,
  Dumbbell,
  Flame,
  Flower2,
  Footprints,
  HandFist,
  HeartPulse,
  Moon,
  Music,
  PersonStanding,
  Sprout,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { getCourseTypeAccent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Icon pro Kursart, abgeleitet aus dem Namen (Stichwörter, klein geschrieben).
 * Erste passende Regel gewinnt — spezifischere Begriffe stehen daher oben.
 */
const ICON_RULES: { keywords: string[]; icon: LucideIcon }[] = [
  { keywords: ["aqua", "schwimm", "wasser", "swim"], icon: Waves },
  { keywords: ["cycling", "spinning", "bike", "rad", "cycle"], icon: Bike },
  { keywords: ["yoga"], icon: Flower2 },
  { keywords: ["pilates", "reformer", "barre"], icon: PersonStanding },
  { keywords: ["stretch", "mobility", "mobil", "rücken", "faszien", "dehn"], icon: Sprout },
  { keywords: ["meditation", "entspann", "relax", "atem", "breath"], icon: Moon },
  { keywords: ["zumba", "dance", "tanz", "aerobic", "step"], icon: Music },
  { keywords: ["box", "kampf", "martial", "fight"], icon: HandFist },
  { keywords: ["hiit", "tabata", "bootcamp", "circuit", "zirkel", "crossfit"], icon: Flame },
  { keywords: ["kraft", "pump", "strength", "hantel", "kettlebell", "functional", "bauch", "core"], icon: Dumbbell },
  { keywords: ["lauf", "run", "walk"], icon: Footprints },
  { keywords: ["cardio", "ausdauer"], icon: HeartPulse },
  { keywords: ["kids", "kinder", "baby", "eltern"], icon: Baby },
];

export function getCourseTypeIcon(name: string | null | undefined): LucideIcon {
  const normalized = (name ?? "").toLowerCase();
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) return rule.icon;
  }
  return Activity;
}

const SIZES = {
  sm: { tile: "size-6 rounded-md", icon: "size-3.5" },
  md: { tile: "size-9 rounded-lg", icon: "size-[18px]" },
} as const;

/**
 * Kursart-Icon in der Akzentfarbe der Kursart. `variant="tile"` = getönte Kachel,
 * `variant="plain"` = nur das Icon (für enge Stellen wie den Wochenplan).
 * `inverted` für Karten auf Primary-Hintergrund (z. B. „Nächster Kurs“).
 */
export function CourseTypeIcon({
  courseTypeId,
  name,
  size = "sm",
  variant = "tile",
  inverted = false,
  className,
}: {
  courseTypeId: string;
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  variant?: "tile" | "plain";
  inverted?: boolean;
  className?: string;
}) {
  const icon = getCourseTypeIcon(name);
  const accent = getCourseTypeAccent(courseTypeId);

  if (variant === "plain") {
    return createElement(icon, {
      "aria-hidden": true,
      className: cn(
        SIZES[size].icon,
        "shrink-0",
        inverted ? "text-primary-foreground" : accent.text,
        className
      ),
    });
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZES[size].tile,
        inverted ? "bg-white/15 text-primary-foreground" : accent.tile,
        className
      )}
    >
      {createElement(icon, { className: SIZES[size].icon })}
    </span>
  );
}
