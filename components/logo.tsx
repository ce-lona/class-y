import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Freistehende Bildmarke (drei gestufte Punkte) — auch als App-Icon/Favicon-Motiv.
 * Skaliert über font-size (em-basiert), Farbe über currentColor.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-block h-[0.5em] w-[0.5em] -translate-y-[0.28em]",
        className
      )}
    >
      <span className="absolute bottom-0 left-0 h-[0.11em] w-[0.11em] rounded-full bg-current" />
      <span className="absolute bottom-[0.14em] left-[0.16em] h-[0.16em] w-[0.16em] rounded-full bg-current" />
      <span className="absolute bottom-[0.30em] left-[0.34em] h-[0.21em] w-[0.21em] rounded-full bg-current" />
    </span>
  )
}

/**
 * "class-y"-Wortmarke. Ausschließlich diese Komponente nutzt font-logo
 * (Newsreader) — für alle anderen Headlines gilt font-heading (Manrope).
 * Größe über die font-size der aufrufenden Stelle (text-2xl, text-5xl, …).
 */
function Logo({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[3px] font-logo font-medium leading-none text-foreground",
        className
      )}
      {...props}
    >
      <span>class</span>
      <LogoMark className="text-primary" />
      <span>y</span>
    </span>
  )
}

export { Logo, LogoMark }
