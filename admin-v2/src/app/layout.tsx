import type { Metadata } from "next"
import localFont from "next/font/local"

import { Providers } from "@/components/providers"
import "./globals.css"

const inter = localFont({
  src: "../../public/fonts/inter.woff2",
  variable: "--font-geist-sans",
  display: "swap",
})

const mono = localFont({
  src: "../../public/fonts/8d05cfa5faa8406c-s.p.2p-978ij53_v6.woff2",
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Monini · Monitoring",
  description: "Network & traffic monitoring console",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable} font-sans antialiased`}>
      <body className="group/body min-h-svh bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
