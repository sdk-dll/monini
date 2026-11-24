"use client"

import * as React from "react"
import Link from "next/link"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, RouterIcon } from "lucide-react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDevices } from "./device-provider"

export function DeviceSwitcher() {
  const { devices, active, activeId, setActiveId, loading } = useDevices()

  const trigger = (
    <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border">
        <RouterIcon className="size-[17px]" />
      </div>
      <div className="grid flex-1 text-left leading-tight">
        <span className="truncate text-[13px] font-semibold">
          {active?.name ?? (loading ? "Загрузка…" : "Нет роутеров")}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {active ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={
                  active.connected
                    ? "size-1.5 rounded-full bg-emerald-500"
                    : "size-1.5 rounded-full bg-red-500"
                }
              />
              {active.host}:{active.port}
            </span>
          ) : (
            "добавьте устройство"
          )}
        </span>
      </div>
      <ChevronsUpDownIcon className="ml-auto size-4 opacity-70" />
    </SidebarMenuButton>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={trigger} />
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Роутеры</DropdownMenuLabel>
              {devices.map((device) => (
                <DropdownMenuItem key={device.id} onClick={() => setActiveId(device.id)}>
                  <span
                    className={
                      device.connected
                        ? "size-2 shrink-0 rounded-full bg-emerald-500"
                        : "size-2 shrink-0 rounded-full bg-red-500"
                    }
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{device.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {device.host}:{device.port}
                      {device.location ? ` · ${device.location}` : ""}
                    </span>
                  </div>
                  {device.id === activeId && <CheckIcon className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <PlusIcon className="size-4" />
              Управление роутерами и ИИ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
