"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import {
  Activity,
  ChevronDown,
  CircleDot,
  RefreshCw,
  Router,
  Settings,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { navGroups, type NavGroup, type NavItem } from "@/lib/navigation"
import { site } from "@/lib/site"
import { cn } from "@/lib/utils"
import { useDevices } from "@/components/providers/devices-provider"

function isPathActive(pathname: string, url?: string) {
  if (!url) return false
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(`${url}/`)
}

function itemHasActive(item: NavItem, pathname: string): boolean {
  if (isPathActive(pathname, item.url)) return true
  return Boolean(item.items?.some((sub) => itemHasActive(sub, pathname)))
}

function SidebarItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon
  const active = itemHasActive(item, pathname)

  if (!item.items?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
          <Link href={item.url ?? "#"}>
            {Icon ? <Icon /> : <CircleDot />}
            <span>{item.title}</span>
            {item.badge ? (
              <Badge variant="secondary" className="ml-auto h-4 px-1 text-[9px]">
                {item.badge}
              </Badge>
            ) : null}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  // Submenus are always visible: the parent is a plain label, not a toggle.
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={item.title} className="cursor-default">
        {Icon ? <Icon /> : <CircleDot />}
        <span>{item.title}</span>
      </SidebarMenuButton>
      <SidebarMenuSub>
        {item.items.map((sub) => (
          <SidebarMenuSubItem key={sub.title}>
            <SidebarMenuSubButton
              asChild
              isActive={isPathActive(pathname, sub.url)}
            >
              <Link href={sub.url ?? "#"}>{sub.title}</Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    </SidebarMenuItem>
  )
}

function NavGroupSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  // Groups are permanently expanded — no collapse control.
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map((item) => (
          <SidebarItem key={item.title} item={item} pathname={pathname} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function AppSidebar() {
  const pathname = usePathname() ?? ""
  const { devices, selectedId, setSelectedId, reload } = useDevices()
  const [query, setQuery] = useState("")
  const groups = useMemo(() => navGroups, [])
  const { state } = useSidebar()

  const connected = devices.filter((d) => d.connected).length

  return (
    <Sidebar collapsible="icon" className="border-grid">
      <SidebarHeader className="relative flex h-14 shrink-0 items-center px-2 py-1">
        <Link href="/" className="flex w-full min-w-0 items-center gap-2 pl-0.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <Activity className="size-4" />
          </span>
          <span className="grid min-w-0 flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">{site.title}</span>
            <span className="truncate text-muted-foreground">
              {site.description}
            </span>
          </span>
        </Link>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className="absolute top-3 right-2 size-8 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="right">Toggle sidebar</TooltipContent>
        </Tooltip>
      </SidebarHeader>

      <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter menu…"
            className="h-8 bg-background text-xs"
          />
        </div>
      </div>

      <SidebarContent className="gap-1.5">
        {groups.map((group) => (
          <NavGroupSection
            key={group.title}
            group={group}
            pathname={pathname}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="pt-0">
        <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  connected ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              {connected}/{devices.length} online
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => reload()}
                  aria-label="Refresh devices"
                >
                  <RefreshCw className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Router className="size-4" />
                  <div className="grid min-w-0 flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">
                      {devices.find((d) => d.id === selectedId)?.name ||
                        "Select device"}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {devices.find((d) => d.id === selectedId)?.host || "—"}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto size-3.5 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-64">
                <DropdownMenuLabel>Active device</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {devices.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    No devices configured
                  </div>
                ) : (
                  devices.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                        d.id === selectedId && "bg-muted font-medium"
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          d.connected ? "bg-emerald-500" : "bg-red-500"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{d.name}</span>
                      <span className="truncate text-muted-foreground">
                        {d.host}
                      </span>
                    </button>
                  ))
                )}
                <DropdownMenuSeparator />
                <Link
                  href="/devices"
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Settings className="size-3.5" /> Manage devices
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
