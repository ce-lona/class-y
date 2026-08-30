"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Monitor, Sun, Moon } from "lucide-react"

import { cn } from "@/lib/utils"

const options = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
] as const

function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

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
