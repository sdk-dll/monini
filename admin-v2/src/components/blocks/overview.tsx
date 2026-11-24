"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  Router,
  Server,
  Thermometer,
  TrendingUp,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AreaLineChart, Sparkline } from "@/components/blocks/charts"
import { api, liveStreamUrl } from "@/lib/api"
import type { Alert, HistoryPoint, LiveFrame, Snapshot } from "@/lib/types"
import { useDevices, useSelectedDevice } from "@/components/providers/devices-provider"
import { cn, formatBytes, formatBps, relativeTime } from "@/lib/utils"

function KpiCard({
  title,
  value,
  suffix,
  icon: Icon,
  hint,
  trend,
  tone,
}: {
  title: string
  value: string | number
  suffix?: string
  icon: React.ElementType
  hint?: string
  trend?: number
  tone?: "good" | "bad" | "neutral"
}) {
  const positive = (trend ?? 0) >= 0
  return (
    <Card className="gap-2 py-0">
      <CardContent className="flex flex-col gap-1 pt-4 pb-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {title}
          <Icon className="size-4" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
          {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
        </div>
        {hint ? (
          <div className="text-xs text-muted-foreground">{hint}</div>
        ) : null}
        {trend !== undefined ? (
          <div className={cn("flex items-center gap-1 text-xs", positive ? "text-emerald-600" : "text-red-600")}>
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(trend).toFixed(1)}% vs previous hour
          </div>
        ) : null}
        {tone ? (
          <div className={cn("text-xs", tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-muted-foreground")}>
            {tone === "good" ? "Normal" : tone === "bad" ? "Attention required" : "—"}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function OverviewPage() {
  const { devices, loading: devicesLoading } = useDevices()
  const device = useSelectedDevice()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [live, setLive] = useState<LiveFrame | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [wsState, setWsState] = useState<"connecting" | "live" | "error">("connecting")
  const esRef = useRef<EventSource | null>(null)

  const load = useCallback(async () => {
    if (!device) return
    setLoading(true)
    setError(null)
    try {
      const [s, h, a] = await Promise.allSettled([
        api.overview(device.id),
        api.history({ minutes: 120, device: device.id }),
        api.alerts(10),
      ])
      if (s.status === "fulfilled") setSnap(s.value)
      else setError(s.reason?.message || "No snapshot yet")
      if (h.status === "fulfilled") setHistory(h.value.points)
      if (a.status === "fulfilled") setAlerts(a.value)
    } finally {
      setLoading(false)
    }
  }, [device])

  useEffect(() => {
    if (!device) return
    load()
  }, [device, load])

  // Live telemetry via SSE
  useEffect(() => {
    if (!device) return
    setWsState("connecting")
    const es = new EventSource(liveStreamUrl(device.id))
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const frame = JSON.parse(e.data) as LiveFrame
        setLive(frame)
        setWsState(frame.running === false ? "error" : "live")
      } catch {
        /* ignore malformed frames */
      }
    }
    es.onerror = () => setWsState("error")
    return () => {
      es.close()
      esRef.current = null
    }
  }, [device])

  async function forceRefresh() {
    if (!device) return
    setRefreshing(true)
    try {
      await api.refresh(device.id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  const summary = live?.summary ?? snap?.summary
  const cpu = live?.cpu ?? snap?.cpu_percent
  const cpuMax = live?.cpu_max ?? snap?.cpu_max_percent
  const mem = live?.mem ?? snap?.mem_percent
  const temp = live?.temp ?? snap?.temperature?.[0]?.temp
  const uptime = live?.uptime ?? snap?.uptime
  const model = live?.model ?? snap?.model
  const connected = live?.connected ?? device?.connected ?? false
  const activeAlerts = snap?.active_alerts ?? []
  const critical = activeAlerts.filter((a) => a.severity === "critical" && !a.resolved).length

  const cpuSeries = history.map((p) => p.cpu ?? 0)
  const memSeries = history.map((p) => p.mem_percent ?? 0)
  const inSeries = history.map((p) => p.wan_in_bps ?? 0)
  const outSeries = history.map((p) => p.wan_out_bps ?? 0)
  const labels = cpuSeries.length
    ? cpuSeries.map((_, i) => (i % Math.max(1, Math.ceil(cpuSeries.length / 6)) === 0 ? relativeTime(history[i]?.ts) : ""))
    : []

  if (!device && !devicesLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <Router className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">No devices configured</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add a router to start collecting telemetry. The backend is running,
          but no enabled devices were found in the registry.
        </p>
        <Button asChild><Link href="/devices">Add device</Link></Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      {/* Hero bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <Badge variant={connected ? "default" : "destructive"} className="gap-1">
              {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
              {connected ? "Connected" : "Disconnected"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className={cn("size-1.5 rounded-full", wsState === "live" ? "animate-pulse bg-emerald-500" : wsState === "error" ? "bg-red-500" : "bg-amber-500")} />
              {wsState === "live" ? "Live" : wsState === "error" ? "SSE error" : "Connecting"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {device?.name ?? "—"} · {device?.host ?? "—"} · {model ?? "Model unknown"}
            {uptime ? ` · Uptime ${uptime}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={load} aria-label="Reload data">
                <RefreshCw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reload</TooltipContent>
          </Tooltip>
          <Button onClick={forceRefresh} disabled={refreshing}>
            <Zap className="size-4" />
            {refreshing ? "Collecting…" : "Force refresh"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="size-4" />
          {error}
          {snap ? <span className="text-muted-foreground">— showing last known snapshot</span> : null}
        </div>
      ) : null}

      {loading && !snap ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="CPU usage" value={cpu ?? "—"} suffix="%" icon={Cpu} hint={cpu !== undefined ? (cpuMax !== undefined ? `Peak ${cpuMax.toFixed(1)}%` : undefined) : "Awaiting first sample"} tone={cpu !== undefined ? (cpu >= 85 ? "bad" : "good") : undefined} />
          <KpiCard title="Memory" value={mem ?? "—"} suffix="%" icon={MemoryStick} hint={mem === undefined ? "Awaiting first sample" : snap?.mem_used_kb ? `Using ${formatBytes(snap.mem_used_kb * 1024)} of ${formatBytes((snap.mem_total_kb ?? 0) * 1024)}` : undefined} tone={mem !== undefined ? (mem >= 90 ? "bad" : "good") : undefined} />
          <KpiCard title="WAN traffic" value={formatBps(live?.wan?.in_bps ?? snap?.wan?.in_bps)} icon={Network} hint={live?.wan?.in_bps === undefined && snap?.wan?.in_bps === undefined ? "Awaiting traffic data" : `Out ${formatBps(live?.wan?.out_bps ?? snap?.wan?.out_bps)}`} />
          <KpiCard title="Interfaces up" value={summary?.ifaces_up ?? "—"} suffix={summary ? `/ ${summary.ifaces_total}` : undefined} icon={Wifi} hint={`${summary?.routes ?? 0} routes · ${summary?.arp_entries ?? 0} ARP`} tone={summary && summary.ifaces_up < summary.ifaces_total ? "bad" : "good"} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">CPU &amp; Memory · last 2 hours</CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-foreground" /> CPU</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-muted-foreground/60" /> Memory</span>
            </div>
          </CardHeader>
          <CardContent>
            {history.length ? (
              <AreaLineChart
                data={cpuSeries}
                compare={memSeries}
                labels={labels}
                height={240}
              />
            ) : (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                No history samples yet — waiting for the first poll.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">System health</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <HealthRow icon={Thermometer} label="Temperature" value={temp !== undefined ? `${temp}°C` : "—"} ok={temp === undefined || temp < 70} />
            <HealthRow icon={Network} label="WAN state" value={live?.wan?.state ?? snap?.wan?.state ?? "—"} ok={(live?.wan?.state ?? snap?.wan?.state) === "up"} />
            <HealthRow icon={Activity} label="Poll age" value={live?.age_s !== undefined ? `${Math.round(live.age_s)}s` : "—"} ok={live?.age_s === undefined || live.age_s < 180} />
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Poller runs</span>
              <span className="font-medium tabular-nums">{snap?.poller?.runs ?? device?.poller?.runs ?? 0} · {snap?.poller?.failures ?? device?.poller?.failures ?? 0} failed</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last collection</span>
              <span className="font-medium">{snap?.ts ? relativeTime(snap.ts) : "never"}</span>
            </div>
            {snap?.errors && Object.keys(snap.errors).length ? (
              <div className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                {Object.keys(snap.errors).length} command errors in last snapshot
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">WAN throughput</CardTitle>
            <span className="text-xs text-muted-foreground">in / out</span>
          </CardHeader>
          <CardContent>
            {history.length ? (
              <AreaLineChart data={inSeries} compare={outSeries} labels={labels} height={180} />
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No traffic samples</div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Active alerts</CardTitle>
            <Badge variant={critical ? "destructive" : "secondary"}>{activeAlerts.length}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {activeAlerts.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
                <CheckCircle2 className="size-6 text-emerald-500" />
                <span className="text-sm text-muted-foreground">No active alerts</span>
              </div>
            ) : (
              activeAlerts.slice(0, 5).map((a, i) => (
                <div key={`${a.kind}-${i}`} className="flex items-start gap-2 rounded-lg border p-2.5">
                  <CircleAlert className={cn("mt-0.5 size-4 shrink-0", a.severity === "critical" ? "text-red-600" : "text-amber-600")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.kind}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.message}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{relativeTime(a.ts)}</span>
                </div>
              ))
            )}
            <Button asChild variant="ghost" size="sm" className="justify-start">
              <Link href="/alerts">View all alerts <ArrowUpRight className="size-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium">Devices</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link href="/devices">Manage <ArrowUpRight className="size-3.5" /></Link></Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
              <span className={cn("size-2 rounded-full", d.connected ? "bg-emerald-500" : "bg-red-500")} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.name}</div>
                <div className="truncate text-xs text-muted-foreground">{d.host}:{d.port} · {d.username}</div>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {d.poller.runs} runs · {d.poller.failures} failures
              </span>
              {d.last_error ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="destructive" className="max-w-48 truncate">error</Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{d.last_error}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function HealthRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: React.ElementType
  label: string
  value: string
  ok: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /> {label}</span>
      <span className={cn("flex items-center gap-1.5 font-medium", ok ? "text-emerald-600" : "text-red-600")}>
        {ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
        {value}
      </span>
    </div>
  )
}
