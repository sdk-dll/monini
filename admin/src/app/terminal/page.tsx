"use client"

import * as React from "react"
import { PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiPost } from "@/lib/snapshot"
import { SiteHeader } from "@/components/dashboard/site-header"

type Entry = { command: string; output: string; error?: boolean; at: string }

const SUGGESTIONS = [
  "display version",
  "display cpu-usage",
  "display memory-usage",
  "display interface brief",
  "display ip routing-table",
  "display arp",
  "display ip pool",
  "display current-configuration",
]

export default function TerminalPage() {
  const [command, setCommand] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [entries, setEntries] = React.useState<Entry[]>([])
  const bottomRef = React.useRef<HTMLDivElement>(null)

  async function run(cmd: string) {
    const trimmed = cmd.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setCommand("")
    const at = new Date().toLocaleTimeString("ru-RU")
    try {
      const res = await apiPost<{ output: string }>("/command", { command: trimmed })
      setEntries((prev) => [...prev, { command: trimmed, output: res.output, at }])
    } catch (err) {
      setEntries((prev) => [
        ...prev,
        {
          command: trimmed,
          output: err instanceof Error ? err.message : String(err),
          error: true,
          at,
        },
      ])
    } finally {
      setBusy(false)
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }))
    }
  }

  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "Терминал" }]} />
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Терминал</h1>
          <p className="text-sm text-muted-foreground">
            Разрешены только команды чтения: <code className="font-mono">display</code>,{" "}
            <code className="font-mono">ping</code>, <code className="font-mono">tracert</code>
          </p>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle>Команды VRP</CardTitle>
            <CardDescription>Вывод устройства как есть</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void run(s)}
                  disabled={busy}
                  className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="bg-muted/40 min-h-[16rem] flex-1 overflow-y-auto rounded-lg p-3 font-mono text-xs">
              {entries.length === 0 && (
                <p className="text-muted-foreground">
                  Выберите команду выше или введите свою ниже.
                </p>
              )}
              {entries.map((entry, i) => (
                <div key={i} className="mb-3">
                  <div className="text-[var(--chart-2)]">
                    <span className="text-muted-foreground">[{entry.at}] </span>&lt;device&gt; {entry.command}
                  </div>
                  <pre
                    className={
                      entry.error
                        ? "mt-1 whitespace-pre-wrap text-red-500"
                        : "mt-1 whitespace-pre-wrap text-foreground/90"
                    }
                  >
                    {entry.output || "(пустой ответ)"}
                  </pre>
                </div>
              ))}
              {busy && <div className="text-muted-foreground">Выполняется…</div>}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void run(command)
              }}
            >
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="display interface brief"
                className="font-mono"
                spellCheck={false}
              />
              <Button type="submit" disabled={busy || !command.trim()}>
                <PlayIcon data-icon="inline-start" />
                Выполнить
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
