"use client"

import { AlertTriangleIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLive } from "./live-provider"

export function ErrorBanner() {
  const { error, refresh, loading, live, snapshot } = useLive()
  if (!error) return null

  const hasNoData = snapshot.ts === 0 || live === null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
      {loading ? (
        <Loader2Icon className="size-4 shrink-0 animate-spin" />
      ) : (
        <AlertTriangleIcon className="size-4 shrink-0" />
      )}
      <span className="flex-1">
        {hasNoData ? "Ждём первый снапшот с устройства." : "Не удалось получить данные с устройства:"}{" "}
        <span className="font-mono text-xs">{error}</span>
      </span>
      <Button variant="outline" size="sm" onClick={() => void refresh()}>
        Обновить сейчас
      </Button>
    </div>
  )
}

/** Shown while the very first poll is still running. */
export function WaitingBanner() {
  const { live, loading, error } = useLive()
  if (error) return null
  if (!loading && live) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" />
      Идёт первый опрос роутера — данные появятся через несколько секунд
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[340px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
      <RefreshCwIcon className="size-5" />
      {message}
    </div>
  )
}
