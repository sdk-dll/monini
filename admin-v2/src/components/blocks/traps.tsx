"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/blocks/data-table"
import { api } from "@/lib/api"
import { useSelectedDevice } from "@/components/providers/devices-provider"

type Trap = Record<string, unknown>

export function TrapsPage() {
  const device = useSelectedDevice()
  const [traps, setTraps] = useState<Trap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!device) return
    setLoading(true)
    try {
      setTraps(await api.traps(device.id))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [device])

  useEffect(() => { load() }, [load])

  const cols: Column<Trap>[] = [
    { key: "ts", header: "Time", value: (r) => String(r.ts ?? ""), cell: (r) => <span className="font-mono text-[11px] text-muted-foreground">{String(r.ts ?? "—")}</span> },
    { key: "module", header: "Module", value: (r) => String(r.module ?? ""), cell: (r) => <Badge variant="secondary" className="text-[10px]">{String(r.module ?? "—")}</Badge>, filter: true },
    { key: "sev", header: "Sev", value: (r) => String(r.sev ?? ""), cell: (r) => <Badge variant="outline">{String(r.sev ?? "—")}</Badge>, filter: true },
    { key: "code", header: "Code", value: (r) => String(r.code ?? ""), cell: (r) => <span className="font-mono text-[11px]">{String(r.code ?? "—")}</span> },
    { key: "msg", header: "Message", value: (r) => String(r.msg ?? ""), cell: (r) => <span className="text-xs">{String(r.msg ?? "—")}</span> },
  ]

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Traps</h1>
          <p className="text-sm text-muted-foreground">Recent SNMP trap buffer entries from the router.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardContent>
          <DataTable
            rows={traps}
            columns={cols}
            getRowKey={(_, i) => i}
            searchPlaceholder="Search traps…"
            emptyMessage={loading ? "Loading traps…" : "No traps in the buffer"}
          />
        </CardContent>
      </Card>
    </div>
  )
}
