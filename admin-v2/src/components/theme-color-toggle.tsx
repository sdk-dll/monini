"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type ThemeColor = {
  name: string
  value: string
  className: string
}

const themeColors: ThemeColor[] = [
  { name: "Default", value: "default", className: "bg-[#171717]" },
  { name: "Blue", value: "blue", className: "bg-[#155dfc]" },
  { name: "Green", value: "green", className: "bg-[#00884b]" },
  { name: "Orange", value: "orange", className: "bg-[#f27000]" },
  { name: "Rose", value: "rose", className: "bg-[#e11d48]" },
]

const COLOR_KEY = "admin-theme-color"

function applyColor(value: string) {
  const root = document.documentElement
  root.removeAttribute("data-theme-color")
  if (value !== "default") root.setAttribute("data-theme-color", value)
}

export function ThemeColorToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [color, setColor] = React.useState("default")

  React.useEffect(() => {
    const stored = window.localStorage.getItem(COLOR_KEY) ?? "default"
    setColor(stored)
    applyColor(stored)
  }, [])

  const onSelect = (next: string) => {
    setColor(next)
    applyColor(next)
    window.localStorage.setItem(COLOR_KEY, next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={cn("justify-between gap-2 px-2 font-normal", className)}
        >
          <span className="flex items-center -space-x-0.5">
            {themeColors.slice(0, 4).map((c) => (
              <span
                key={c.value}
                className={cn(
                  "size-4 rounded-full ring-1 ring-background",
                  c.value === "default" ? "bg-foreground" : c.className
                )}
              />
            ))}
          </span>
          <span className="truncate">
            {themeColors.find((c) => c.value === color)?.name ?? "Default"}
          </span>
          <Palette className="ml-auto size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Color</DropdownMenuLabel>
        <DropdownMenuGroup>
          {themeColors.map((c) => (
            <DropdownMenuItem
              key={c.value}
              onSelect={() => onSelect(c.value)}
              className="gap-2"
            >
              <span
                className={cn(
                  "size-4 rounded-full ring-1 ring-border",
                  c.value === "default" ? "bg-foreground" : c.className
                )}
              />
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Mode</DropdownMenuLabel>
        <DropdownMenuGroup>
          {["light", "dark", "system"].map((mode) => (
            <DropdownMenuItem
              key={mode}
              onSelect={() => setTheme(mode)}
              className="justify-between capitalize"
            >
              {mode}
              {theme === mode ? <span className="text-xs">●</span> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
