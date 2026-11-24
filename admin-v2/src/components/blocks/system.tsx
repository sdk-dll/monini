"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CircleAlert,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  ShieldCheck,
  Thermometer,
  Clock3,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import type { Snapshot } from "@/lib/types"
import { useSelectedDevice } from "@/components/providers/devices-provider"
import { formatBytes, relativeTime } from "@/lib/utils"

export function SystemPage() {
  const device = useSelectedDevice()
  const [sys, setSys] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!device) return
    setLoading(true)
    try {
      setSys(await api.system(device.id))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [device])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading system info…</div>
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System</h1>
          <p className="text-sm text-muted-foreground">{sys?.model ?? "Router"} · {sys?.vrp_version ?? "VRP unknown"}</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 pt-4 pb-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><Server className="size-4" /></span>
          <div><div className="text-xs text-muted-foreground">Model</div><div className="font-medium">{sys?.model ?? "—"}</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-4 pb-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><Cpu className="size-4" /></span>
          <div><div className="text-xs text-muted-foreground">VRP version</div><div className="font-medium">{sys?.vrp_version ?? "—"}</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-4 pb-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><Clock3 className="size-4" /></span>
          <div><div className="text-xs text-muted-foreground">Uptime</div><div className="text-sm font-medium">{sys?.uptime ?? "—"}</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-4 pb-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><MemoryStick className="size-4" /></span>
          <div><div className="text-xs text-muted-foreground">SDRAM</div><div className="font-medium">{sys?.sdram_mb ? `${sys.sdram_mb} MB` : "—"}</div></div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resource usage</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Usage label="CPU" value={sys?.cpu_percent} max={sys?.cpu_max_percent} icon={Cpu} />
            <Usage label="Memory" value={sys?.mem_percent} hint={sys?.mem_used_kb && sys?.mem_total_kb ? `${formatBytes(sys.mem_used_kb * 1024)} / ${formatBytes(sys.mem_total_kb * 1024)}` : undefined} icon={MemoryStick} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Device identity</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-xs sm:grid-cols-2">
            {Object.entries(sys?.identity ?? {}).map(([k, v]) => (
              <div key={k} className="flex flex-col rounded-lg border p-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="truncate font-medium">{String(v)}</span>
              </div>
            ))}
            {!sys?.identity || Object.keys(sys.identity).length === 0 ? (
              <div className="col-span-2 text-muted-foreground">No identity data in snapshot</div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Thermometer className="size-4" /> Temperature sensors</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y">
            {(sys?.temperature ?? []).map((t, i) => (
              <div key={`${t.slot}-${t.name}-${i}`} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2"><span className="font-medium">{t.name}</span><span className="text-xs text-muted-foreground">slot {t.slot} · sensor {t.sensor ?? "—"}</span></span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">upper {t.upper}°C</span>
                  <Badge variant={(t.temp ?? 0) >= (t.upper ?? 100) - 10 ? "destructive" : "default"}>{t.temp}°C</Badge>
                </span>
              </div>
            ))}
            {!sys?.temperature?.length ? <div className="py-4 text-sm text-muted-foreground">No temperature sensors</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" /> Services</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Group title="NTP" data={sys?.ntp} />
            <Group title="SSH" data={sys?.ssh} />
            <Group title="DNS" data={sys?.dns?.[0]} />
          </CardContent>
        </Card>
      </div>

      {sys?.alarms && sys.alarms.length ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CircleAlert className="size-4" /> Parser warnings</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs text-amber-700">
            {sys.alarms.map((a, i) => <div key={i} className="rounded bg-amber-500/10 p-2">{a}</div>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Usage({ label, value, max, hint, icon: Icon }: { label: string; value?: number; max?: number; hint?: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /> {label}</span>
        <span className="font-medium tabular-nums">{value ?? "—"}%{max !== undefined ? ` / max ${max}%` : ""}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value ?? 0)}%` }} />
      </div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function Group({ title, data }: { title: string; data?: Record<string, unknown> }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="flex flex-col gap-1">
        {data ? Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{k}</span>
            <span className="truncate font-medium">{String(v ?? "—")}</span>
          </div>
        )) : <span className="text-xs text-muted-foreground">No data</span>}
      </div>
    </div>
  )
}
