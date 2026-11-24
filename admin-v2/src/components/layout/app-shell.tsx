"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { DevicesProvider } from "@/components/providers/devices-provider"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DevicesProvider>
      <SidebarProvider defaultOpen className="border-grid flex min-h-svh w-full flex-1">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="min-h-0 flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </DevicesProvider>
  )
}
