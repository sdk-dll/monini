"use client"

import { usePathname } from "next/navigation"
import * as React from "react"
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Command,
  Download,
  Monitor,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ThemeColorToggle } from "@/components/theme-color-toggle"
import { appTitles } from "@/lib/navigation"
import { useDevices } from "@/components/providers/devices-provider"
import { historyCsvUrl } from "@/lib/api"

function label(part: string) {
  return appTitles[part] ?? part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AppHeader() {
  const pathname = usePathname() ?? ""
  const parts = pathname.split("/").filter(Boolean)
  const { devices, selectedId } = useDevices()
  const selected = devices.find((d) => d.id === selectedId)
  const connected = selected?.connected ?? devices.some((d) => d.connected)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3 shadow-[inset_0_-1px_0_var(--border)] md:h-14">
      <div className="flex min-w-0 items-center gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            {parts.map((part, i) => {
              const href = `/${parts.slice(0, i + 1).join("/")}`
              const last = i === parts.length - 1
              return (
                <React.Fragment key={href}>
                  <BreadcrumbSeparator className="hidden sm:list-item" />
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    {last ? (
                      <BreadcrumbPage>{label(part)}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={href}>{label(part)}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <Badge
          variant="outline"
          className={connected ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}
        >
          {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          <span className="hidden sm:inline">{connected ? "Online" : "Offline"}</span>
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative hidden lg:block">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Button variant="outline" size="lg" className="h-9 w-52 justify-start pl-8 font-normal text-muted-foreground">
            Search
            <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
          </Button>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon-lg" className="border">
              <a href={historyCsvUrl()} download>
                <Download />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export CSV</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon-lg" className="border">
              <a href="/alerts">
                <Bell />
                <Badge className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] text-white">2</Badge>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Alerts</TooltipContent>
        </Tooltip>

        <ThemeColorToggle />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon-lg" className="hidden sm:inline-flex">
              <a href="/settings"><Monitor /></a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
