"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { NavGroup } from "./nav-items"

export function NavMain({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group) => (
        <SidebarGroup key={group.label} className="px-2">
          <SidebarGroupLabel className="mb-0.5 px-2 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
            {group.label}
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.url
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={item.url} />}
                    isActive={active}
                    tooltip={item.title}
                    className={cn(
                      "relative h-9 gap-2.5 rounded-lg text-[13px] transition-colors",
                      active &&
                        "bg-sidebar-primary/10 font-medium text-sidebar-primary ring-1 ring-sidebar-primary/20",
                      active &&
                        "before:bg-sidebar-primary before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full"
                    )}
                  >
                    <item.icon className={cn("size-[17px]", active && "text-sidebar-primary")} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.badge ? (
                    <SidebarMenuBadge className="bg-sidebar-accent text-sidebar-accent-foreground rounded-md text-[10px]">
                      {item.badge}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </div>
  )
}
