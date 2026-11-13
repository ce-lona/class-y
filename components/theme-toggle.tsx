"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Monitor, Sun, Moon } from "lucide-react"

import { cn } from "@/lib/utils"
import { t } from "@/i18n/de"

const options = [
  { value: "system", label: t.theme.system, icon: Monitor },
  { value: "light", label: t.theme.light, icon: Sun },
  { value: "dark", label: t.theme.dark, icon: Moon },
] as const

// true im Browser, false beim Server-Rendering, ohne setState im Effect.
const noopSubscribe = () => () => {}
function useMounted() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5",
        className
      )}
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={mounted && theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground",
            mounted && theme === value && "bg-card text-foreground shadow-sm"
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}

export { ThemeToggle }
