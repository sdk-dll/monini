"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/blocks/data-table"
import { api } from "@/lib/api"
import type { LogEntry } from "@/lib/types"
import { relativeTime, severityLabel } from "@/lib/utils"

export function LogsPage() {
  const [items, setItems] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [modules, setModules] = useState<{ module: string; n: number; min_sev: number }[]>([])
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const [search, setSearch] = useState("")
  const [module, setModule] = useState("")
  const [severity, setSeverity] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, mods] = await Promise.all([
        api.logs({
          limit: size,
          offset: page * size,
          search: search || undefined,
          module: module || undefined,
          severity_max: severity !== "" ? Number(severity) : undefined,
        }),
        api.logModules(),
      ])
      setItems(res.items)
      setTotal(res.total)
      setModules(mods)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, size, search, module, severity])

  useEffect(() => { load() }, [load])

  const cols: Column<LogEntry>[] = [
    { key: "log_ts", header: "Device time", value: (r) => r.log_ts?.trim(), cell: (r) => <span className="font-mono text-[11px] text-muted-foreground">{r.log_ts?.trim()}</span> },
    { key: "module", header: "Module", value: (r) => r.module, cell: (r) => <Badge variant="secondary" className="text-[10px]">{r.module}</Badge> },
    { key: "severity", header: "Sev", value: (r) => r.severity, cell: (r) => <Badge variant={r.severity <= 2 ? "destructive" : r.severity <= 4 ? "secondary" : "outline"} className="tabular-nums">{r.severity}</Badge> },
    { key: "code", header: "Code", value: (r) => r.code, cell: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
    { key: "msg", header: "Message", value: (r) => r.msg, cell: (r) => <span className="text-xs">{r.msg}</span> },
    { key: "ts", header: "Collected", value: (r) => r.ts, cell: (r) => <span className="text-xs text-muted-foreground">{relativeTime(r.ts)}</span> },
  ]

  // Additional server-side module/severity selects, rendered in the toolbar.
  const toolbar = (
    <div className="flex items-center gap-2">
      <select
        value={module}
        onChange={(e) => { setModule(e.target.value); setPage(0) }}
        className="h-9 rounded-md border bg-background px-2 text-xs"
        aria-label="Module filter"
      >
        <option value="">All modules</option>
        {modules.map((m) => <option key={m.module} value={m.module}>{m.module} ({m.n})</option>)}
      </select>
      <select
        value={severity}
        onChange={(e) => { setSeverity(e.target.value); setPage(0) }}
        className="h-9 rounded-md border bg-background px-2 text-xs"
        aria-label="Severity filter"
      >
        <option value="">All severities</option>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => <option key={s} value={String(s)}>{s} · {severityLabel(s)}</option>)}
      </select>
      <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" /> Refresh</Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} log entries from the router buffer.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardContent>
          <DataTable
            rows={items}
            columns={cols}
            getRowKey={(r) => r.id}
            searchPlaceholder="Search log messages…"
            emptyMessage={loading ? "Loading logs…" : "No log entries match the filters"}
            toolbar={toolbar}
            manual={{
              total,
              page,
              size,
              onPageChange: setPage,
              onSizeChange: (s) => { setSize(s); setPage(0) },
              onSearch: (q) => { setSearch(q); setPage(0) },
              search,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
