"use client"

import Link from "next/link"
import { ChevronRightIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useLive } from "./live-provider"

function LiveBadge() {
  const { connected, lastUpdated, ready, error, live } = useLive()
  const deviceOk = live?.connected ?? false
  const streamOk = connected

  return (
    <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex">
      <span className="inline-flex items-center gap-1.5">
        <span
          className={streamOk ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-red-500"}
        />
        {streamOk ? "SSE" : "нет потока"}
      </span>
      <span className="text-border">·</span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className={deviceOk ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-amber-500"}
        />
        {deviceOk ? "устройство" : ready ? "нет связи" : "сбор данных"}
      </span>
      {lastUpdated && (
        <>
          <span className="text-border">·</span>
          <span className="tabular-nums">{new Date(lastUpdated).toLocaleTimeString("ru-RU")}</span>
        </>
      )}
    </span>
  )
}

export function SiteHeader({
  breadcrumbs,
}: {
  breadcrumbs: { title: string; url?: string }[]
}) {
  const { refresh, loading } = useLive()

  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
      <nav aria-label="хлебные крошки" className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.title} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRightIcon className="size-3.5 text-muted-foreground" />}
            {crumb.url ? (
              <Link href={crumb.url} className="text-muted-foreground hover:text-foreground">
                {crumb.title}
              </Link>
            ) : (
              <span className="font-medium">{crumb.title}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <LiveBadge />
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
          Обновить
        </Button>
      </div>
    </header>
  )
}
