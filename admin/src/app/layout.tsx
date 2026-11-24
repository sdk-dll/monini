import type { Metadata } from "next"
import { Manrope, Geist_Mono } from "next/font/google"
import "./globals.css"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { LiveProvider } from "@/components/dashboard/live-provider"
import { DeviceProvider } from "@/components/dashboard/device-provider"

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["cyrillic", "latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "monini — панель сети",
  description: "Мониторинг точки доступа Huawei",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <TooltipProvider>
          <DeviceProvider>
            <LiveProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="min-h-0">{children}</SidebarInset>
              </SidebarProvider>
            </LiveProvider>
          </DeviceProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
