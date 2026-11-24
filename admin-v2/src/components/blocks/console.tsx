"use client"

import { useRef, useState } from "react"
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Play,
  SquareTerminal,
  Trash2,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { useDevices } from "@/components/providers/devices-provider"
import { cn, relativeTime } from "@/lib/utils"

const SUGGESTIONS = [
  "display version",
  "display cpu-usage",
  "display memory-usage",
  "display interface brief",
  "display ip routing-table",
  "display arp",
  "display mac-address",
  "display logbuffer",
  "display alarm active",
  "display ntp-service status",
  "ping 8.8.8.8",
]

type Entry = {
  command: string
  output: string
  ts: number
  ok: boolean
  duration: number
}

export function ConsolePage() {
  const { devices, selectedId } = useDevices()
  const [command, setCommand] = useState("display version")
  const [history, setHistory] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  async function run(cmd = command) {
    if (!cmd.trim()) return
    setBusy(true)
    setError(null)
    const started = performance.now()
    try {
      const res = await api.command(cmd.trim(), selectedId ?? undefined)
      setHistory((prev) => [...prev, { command: res.command, output: res.output, ts: res.ts, ok: true, duration: performance.now() - started }])
      setCommand("")
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }))
    } catch (e) {
      setError((e as Error).message)
      setHistory((prev) => [...prev, { command: cmd, output: `Error: ${(e as Error).message}`, ts: Date.now() / 1000, ok: false, duration: performance.now() - started }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Console</h1>
          <p className="text-sm text-muted-foreground">Read-only commands: display, ping, tracert. No configuration changes.</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {devices.find((d) => d.id === selectedId)?.name ?? "No device"}
        </Badge>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_220px]">
        <Card className="flex min-h-[500px] flex-col gap-0 overflow-hidden py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium"><SquareTerminal className="size-4" /> VRP command session</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{history.length} commands</span>
              <Button variant="ghost" size="icon-xs" onClick={() => setHistory([])} aria-label="Clear"><Trash2 className="size-3.5" /></Button>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-0 font-mono text-xs">
            {history.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <SquareTerminal className="size-8" />
                <p>Run a display command to see output here.</p>
              </div>
            ) : null}
            {history.map((entry, i) => (
              <div key={i} className="border-b border-border/40 p-3">
                <div className="mb-2 flex items-center gap-2 text-[11px]">
                  {entry.ok ? <CheckCircle2 className="size-3 text-emerald-500" /> : <XCircle className="size-3 text-red-500" />}
                  <span className="text-muted-foreground">$</span>
                  <span className="font-semibold">{entry.command}</span>
                  <span className="ml-auto flex items-center gap-1 text-muted-foreground"><Clock3 className="size-3" /> {Math.round(entry.duration)}ms · {relativeTime(entry.ts)}</span>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-foreground/90">{entry.output}</pre>
              </div>
            ))}
            <div ref={endRef} />
          </CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); run() }}
            className="flex items-center gap-2 border-t p-3"
          >
            <span className="font-mono text-sm text-emerald-600">$</span>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="display version"
              className="flex-1 font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" size="sm" disabled={busy || !command.trim()}>
              <Play className="size-3.5" /> {busy ? "Running…" : "Run"}
            </Button>
          </form>
          {error ? <div className="flex items-center gap-2 border-t bg-destructive/10 px-3 py-2 text-xs text-destructive"><CircleAlert className="size-3.5" /> {error}</div> : null}
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Quick commands</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 p-2">
            {SUGGESTIONS.map((cmd) => (
              <button
                key={cmd}
                onClick={() => { setCommand(cmd); run(cmd) }}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <ChevronRight className="size-3" />
                <span className="truncate font-mono">{cmd}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
