"use client"

import Link from "next/link"
import { SettingsIcon, WifiIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { NavMain } from "./nav-main"
import { DeviceSwitcher } from "./device-switcher"
import { navGroups } from "./nav-items"
import { useLive } from "./live-provider"

export function AppSidebar() {
  const { snapshot, connected } = useLive()

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border/60">
      <SidebarHeader className="gap-2 px-2 pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="group/logo h-12 gap-3 rounded-lg px-2 transition-colors hover:bg-sidebar-accent/60"
            >
              <div className="from-sidebar-primary via-sidebar-primary to-chart-4 flex aspect-square size-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-white/10 transition-transform group-hover/logo:scale-[1.04]">
                <WifiIcon className="size-[18px] text-white" strokeWidth={2.3} />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="text-[15px] font-bold tracking-tight">monini</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {snapshot.model ?? "network monitor"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <DeviceSwitcher />
      </SidebarHeader>

      <SidebarSeparator className="mx-3 my-1 opacity-60" />

      <SidebarContent className="px-0">
        <NavMain groups={navGroups} />
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <SidebarSeparator className="mx-1 mb-2 opacity-60" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={connected ? "Поток событий активен" : "Поток событий недоступен"}
              className="h-9 rounded-lg px-2 text-[13px]"
            >
              <span className="relative flex size-[18px] items-center justify-center">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    connected
                      ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                      : "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]"
                  )}
                />
              </span>
              <span>{connected ? "На связи" : "Подключение…"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Настройки"
              render={<Link href="/settings" />}
              className="h-9 rounded-lg px-2 text-[13px]"
            >
              <SettingsIcon className="size-[17px]" />
              <span>Настройки</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
