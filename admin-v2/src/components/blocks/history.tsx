"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  Clock3,
  Download,
  LineChart,
  RefreshCw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AreaLineChart } from "@/components/blocks/charts"
import { api, historyCsvUrl } from "@/lib/api"
import { metricOptions } from "@/lib/navigation"
import type { HistoryPoint } from "@/lib/types"
import { useSelectedDevice } from "@/components/providers/devices-provider"
import { relativeTime } from "@/lib/utils"

export function HistoryPage() {
  const device = useSelectedDevice()
  const [minutes, setMinutes] = useState(120)
  const [fields, setFields] = useState<string[]>(["cpu", "mem_percent"])
  const [points, setPoints] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.history({
        minutes,
        fields: fields.join(","),
        device: device?.id,
      })
      setPoints(res.points)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [minutes, fields, device])

  useEffect(() => { load() }, [load])

  function toggleField(v: string) {
    setFields((prev) => prev.includes(v) ? (prev.length > 1 ? prev.filter((f) => f !== v) : prev) : [...prev, v])
  }

  const labels = points.map((p) => relativeTime(p.ts)).filter((_, i) => i % Math.max(1, Math.ceil(points.length / 8)) === 0)

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground">
            Stored metric samples · {points.length} points in the selected window.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
          <Button asChild variant="outline"><a href={historyCsvUrl(minutes)} download><Download className="size-4" /> Export CSV</a></Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="grid gap-1.5">
            <Label>Time window</Label>
            <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[15, 30, 60, 120, 360, 720, 1440].map((m) => (
                  <SelectItem key={m} value={String(m)}>{m < 60 ? `${m} min` : `${m / 60} h`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Metrics ({fields.length})</Label>
            <div className="flex max-w-3xl flex-wrap gap-1.5">
              {metricOptions.map((m) => (
                <button
                  key={m.value}
                  onClick={() => toggleField(m.value)}
                  className={`rounded-md border px-2 py-1 text-xs transition-colors ${fields.includes(m.value) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">Loading history…</CardContent></Card>
      ) : points.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <Clock3 className="size-8 text-muted-foreground" />
            <span className="font-medium">No samples in this window</span>
            <span className="text-sm text-muted-foreground">Increase the time window or wait for the poller to collect data.</span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {fields.map((f) => {
            const meta = metricOptions.find((m) => m.value === f)
            const values = points.map((p) => Number((p as Record<string, unknown>)[f] ?? 0))
            return (
              <Card key={f}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {meta?.label ?? f}
                    <Badge variant="secondary">avg {(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AreaLineChart data={values} labels={labels} height={200} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
