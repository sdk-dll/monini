"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  CircleAlert,
  Cpu,
  Gauge,
  Network,
  Pause,
  Play,
  Radio,
  Thermometer,
  Wifi,
  WifiOff,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkline } from "@/components/blocks/charts"
import { liveStreamUrl } from "@/lib/api"
import type { LiveFrame } from "@/lib/types"
import { useSelectedDevice } from "@/components/providers/devices-provider"
import { cn, formatBps, relativeTime } from "@/lib/utils"

type Sample = {
  t: number
  cpu: number
  mem: number
  in_bps: number
  out_bps: number
  temp: number
}

export function LivePage() {
  const device = useSelectedDevice()
  const [frame, setFrame] = useState<LiveFrame | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [state, setState] = useState<"connecting" | "live" | "error">("connecting")
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    if (!device) return
    setState("connecting")
    const es = new EventSource(liveStreamUrl(device.id))
    es.onmessage = (e) => {
      if (pausedRef.current) return
      try {
        const f = JSON.parse(e.data) as LiveFrame
        setFrame(f)
        setState(f.running === false ? "error" : "live")
        setSamples((prev) =>
          [
            ...prev,
            {
              t: f.ts,
              cpu: f.cpu ?? 0,
              mem: f.mem ?? 0,
              in_bps: f.wan?.in_bps ?? 0,
              out_bps: f.wan?.out_bps ?? 0,
              temp: f.temp ?? 0,
            },
          ].slice(-90)
        )
      } catch {
        /* ignore */
      }
    }
    es.onerror = () => setState("error")
    return () => es.close()
  }, [device])

  const cpuSeries = useMemo(() => samples.map((s) => s.cpu), [samples])
  const memSeries = useMemo(() => samples.map((s) => s.mem), [samples])
  const inSeries = useMemo(() => samples.map((s) => s.in_bps), [samples])
  const outSeries = useMemo(() => samples.map((s) => s.out_bps), [samples])

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            Live telemetry
            <Badge variant={state === "live" ? "default" : state === "error" ? "destructive" : "secondary"} className="gap-1">
              <span className={cn("size-1.5 rounded-full", state === "live" ? "animate-pulse bg-emerald-500" : state === "error" ? "bg-red-500" : "bg-amber-500")} />
              {state === "live" ? "Streaming" : state === "error" ? "Disconnected" : "Connecting"}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {device?.name ?? "—"} · {device?.host ?? "—"} · 1s SSE updates
          </p>
        </div>
        <Button variant="outline" onClick={() => setPaused((p) => !p)}>
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>

      {frame?.error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert className="size-4" /> {frame.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LiveTile icon={Cpu} label="CPU" value={frame?.cpu} suffix="%" hint={frame?.cpu_max !== undefined ? `max ${frame.cpu_max}%` : undefined} />
        <LiveTile icon={Gauge} label="Memory" value={frame?.mem} suffix="%" hint={frame?.mem_used_kb ? `${Math.round(frame.mem_used_kb / 1024)} MB used` : undefined} />
        <LiveTile icon={Thermometer} label="Temperature" value={frame?.temp} suffix="°C" />
        <LiveTile icon={Network} label="Uptime" value={frame?.uptime ?? "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">CPU live</CardTitle></CardHeader>
          <CardContent>
            <Sparkline data={cpuSeries.length ? cpuSeries : [0]} className="h-40 w-full text-foreground" showDots />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Memory live</CardTitle></CardHeader>
          <CardContent>
            <Sparkline data={memSeries.length ? memSeries : [0]} className="h-40 w-full text-foreground" showDots />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">WAN in</CardTitle></CardHeader>
          <CardContent>
            <Sparkline data={inSeries.length ? inSeries : [0]} className="h-40 w-full text-foreground" showDots />
            <p className="mt-2 text-sm text-muted-foreground">{formatBps(frame?.wan?.in_bps)} · {frame?.wan?.in_pps ?? 0} pps</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">WAN out</CardTitle></CardHeader>
          <CardContent>
            <Sparkline data={outSeries.length ? outSeries : [0]} className="h-40 w-full text-foreground" showDots />
            <p className="mt-2 text-sm text-muted-foreground">{formatBps(frame?.wan?.out_bps)} · {frame?.wan?.out_pps ?? 0} pps</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Frame details</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Device ID" value={frame?.device_id ?? "—"} />
          <Detail label="Frame age" value={frame ? `${Math.round(frame.age_s)}s` : "—"} />
          <Detail label="Collected" value={frame?.collected_ts ? relativeTime(frame.collected_ts) : "—"} />
          <Detail label="Model" value={frame?.model ?? "—"} />
          <Detail label="VRP" value={frame?.vrp_version ?? "—"} />
          <Detail label="WAN interface" value={frame?.wan?.iface ?? "—"} />
          <Detail label="WAN errors" value={`${frame?.wan?.rx_errors ?? 0} rx / ${frame?.wan?.tx_errors ?? 0} tx`} />
          <Detail label="Interfaces" value={frame?.summary ? `${frame.summary.ifaces_up}/${frame.summary.ifaces_total}` : "—"} />
        </CardContent>
      </Card>
    </div>
  )
}

function LiveTile({ icon: Icon, label, value, suffix, hint }: { icon: React.ElementType; label: string; value: string | number | undefined; suffix?: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-4 pb-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">{label}<Icon className="size-4" /></div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">{value ?? "—"}</span>
          {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
        </div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg border p-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  )
}
