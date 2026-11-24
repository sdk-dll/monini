"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bell,
  BellRing,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  Filter,
  Info,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import type { Alert } from "@/lib/types"
import { cn, relativeTime } from "@/lib/utils"

const severityMeta: Record<string, { icon: React.ElementType; className: string; label: string }> = {
  critical: { icon: CircleAlert, className: "text-red-600 bg-red-500/10", label: "Critical" },
  warning: { icon: TriangleAlert, className: "text-amber-600 bg-amber-500/10", label: "Warning" },
  info: { icon: Info, className: "text-sky-600 bg-sky-500/10", label: "Info" },
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAlerts(await api.alerts(200))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const shown = alerts.filter((a) => filter === "all" || a.severity === filter)
  const active = alerts.filter((a) => !a.resolved)

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active · {alerts.length} total events from the poller.
          </p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["critical", "warning", "info"] as const).map((sev) => {
          const meta = severityMeta[sev]
          const Icon = meta.icon
          const count = active.filter((a) => a.severity === sev).length
          return (
            <Card key={sev}>
              <CardContent className="flex items-center gap-3 pt-4 pb-4">
                <span className={cn("flex size-9 items-center justify-center rounded-lg", meta.className)}><Icon className="size-4" /></span>
                <div>
                  <div className="text-2xl font-bold tabular-nums">{count}</div>
                  <div className="text-xs text-muted-foreground">{meta.label} active</div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          {(["all", "critical", "warning", "info"] as const).map((f) => (
            <TabsTrigger key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading alerts…</div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <CircleCheck className="size-8 text-emerald-500" />
              <span className="font-medium">No alerts in this category</span>
              <span className="text-sm text-muted-foreground">Everything looks healthy.</span>
            </div>
          ) : (
            shown.map((a, i) => {
              const meta = severityMeta[a.severity] ?? severityMeta.info
              const Icon = meta.icon
              return (
                <div key={`${a.kind}-${a.ts}-${i}`} className="flex items-start gap-3 p-4">
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", meta.className)}><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.kind}</span>
                      <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                      {a.resolved ? <Badge variant="secondary"><CheckCircle2 className="mr-1 size-3" /> resolved</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.ts)}</span>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
