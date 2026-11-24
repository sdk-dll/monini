"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/blocks/data-table"
import { api } from "@/lib/api"
import type { DhcpPool } from "@/lib/types"
import { useSelectedDevice } from "@/components/providers/devices-provider"
import { cn } from "@/lib/utils"

export function DhcpPage() {
  const device = useSelectedDevice()
  const [pools, setPools] = useState<DhcpPool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!device) return
    setLoading(true)
    try {
      const res = await api.dhcp(device.id)
      setPools(res.pools ?? [])
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [device])

  useEffect(() => { load() }, [load])

  const total = pools.reduce((a, p) => a + (p.total ?? 0), 0)
  const used = pools.reduce((a, p) => a + (p.used ?? 0), 0)
  const idle = pools.reduce((a, p) => a + (p.idle ?? 0), 0)
  const conflicts = pools.reduce((a, p) => a + (p.conflict ?? 0), 0)

  const cols: Column<DhcpPool>[] = [
    { key: "name", header: "Name", value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span>, filter: true },
    { key: "network", header: "Network", value: (r) => `${r.network}/${r.mask}`, cell: (r) => <span className="font-mono text-xs">{r.network}/{r.mask}</span>, filter: true },
    { key: "gateway", header: "Gateway", value: (r) => r.gateway, cell: (r) => <span className="font-mono text-xs">{r.gateway}</span> },
    { key: "lease", header: "Lease", value: (r) => r.lease, filter: true },
    { key: "total", header: "Total", value: (r) => r.total, className: "text-right tabular-nums" },
    { key: "used", header: "Used", value: (r) => r.used, cell: (r) => <span className="font-medium tabular-nums">{r.used}</span>, className: "text-right" },
    { key: "idle", header: "Idle", value: (r) => r.idle, className: "text-right tabular-nums" },
    { key: "expired", header: "Expired", value: (r) => r.expired, className: "text-right tabular-nums" },
    { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <Badge variant={r.status === "Unlocked" ? "default" : "secondary"}>{r.status}</Badge>, filter: true },
  ]

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DHCP</h1>
          <p className="text-sm text-muted-foreground">Address pools and lease utilization.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total addresses" value={total} icon={Database} />
        <Stat label="Leases used" value={used} icon={CheckCircle2} hint={total ? `${((used / total) * 100).toFixed(1)}% utilization` : undefined} />
        <Stat label="Idle" value={idle} icon={Clock3} />
        <Stat label="Conflicts" value={conflicts} icon={Activity} tone={conflicts > 0 ? "bad" : "good"} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Address pools</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading pools…</div>
          ) : (
            <DataTable
              rows={pools}
              columns={cols}
              getRowKey={(r, i) => `${r.name}-${i}`}
              searchPlaceholder="Search pools…"
              emptyMessage="No DHCP pools in the last snapshot"
            />
          )}
        </CardContent>
      </Card>

      {pools.map((p, i) => (
        <Card key={`bar-${p.name}-${i}`}>
          <CardContent className="pt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground">{p.used}/{p.total} leases</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${p.total ? (p.used / p.total) * 100 : 0}%` }} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function Stat({ label, value, icon: Icon, hint, tone }: { label: string; value: number; icon: React.ElementType; hint?: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-4 pb-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">{label}<Icon className="size-4" /></div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
        {tone ? <div className={cn("text-xs", tone === "good" ? "text-emerald-600" : "text-red-600")}>{tone === "good" ? "Healthy" : "Attention"}</div> : null}
      </CardContent>
    </Card>
  )
}
