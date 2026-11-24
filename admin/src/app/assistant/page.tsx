"use client"

import * as React from "react"
import {
  BotIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleStopIcon,
  Loader2Icon,
  SendIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react"
import Link from "next/link"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useDevices } from "@/components/dashboard/device-provider"
import { useChat, type ChatEntry } from "@/components/dashboard/use-chat"
import type { ToolCall } from "@/lib/api-types"

const SUGGESTIONS = [
  "Что сейчас происходит с сетью? Дай краткую оценку.",
  "Проверь, нет ли проблем с DHCP и LLDP.",
  "Проанализируй загрузку WAN за последний час.",
  "Составь отчёт по устройству за сутки.",
]

const TOOL_LABELS: Record<string, string> = {
  get_snapshot: "Снапшот устройства",
  get_history: "История метрик",
  search_logs: "Поиск по журналу",
  get_alerts: "Алерты",
  list_devices: "Список роутеров",
  run_command: "Команда на роутере",
  export_report: "Отчёт",
}

function ToolCard({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = React.useState(false)
  const args = React.useMemo(() => {
    try {
      const json = JSON.stringify(tool.arguments)
      return json === "{}" ? "" : json
    } catch {
      return ""
    }
  }, [tool.arguments])

  return (
    <div className="rounded-md border bg-muted/30 text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {tool.status === "running" ? (
          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
        ) : (
          <WrenchIcon className="size-3.5 text-muted-foreground" />
        )}
        <span className="font-medium">{TOOL_LABELS[tool.name] ?? tool.name}</span>
        {args && (
          <code className="max-w-[16rem] truncate text-muted-foreground">
            {args}
          </code>
        )}
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          {tool.tookMs !== undefined && `${tool.tookMs} мс`}
          <ChevronDownIcon className={open ? "size-3.5 rotate-180 transition-transform" : "size-3.5 transition-transform"} />
        </span>
      </button>
      {open && tool.result && (
        <pre className="max-h-64 overflow-auto border-t px-2.5 py-2 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
          {tool.result}
        </pre>
      )}
    </div>
  )
}

function AssistantEntry({ entry }: { entry: Extract<ChatEntry, { kind: "assistant" }> }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--chart-1)]/15 text-[var(--chart-1)]">
        <BotIcon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {entry.tools.length > 0 && (
          <div className="flex flex-col gap-1">
            {entry.tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
        {entry.text && (
          <div className="prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">{entry.text}</div>
        )}
        {entry.pending && !entry.text && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            Думает…
          </div>
        )}
        {entry.error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">
            <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />
            {entry.error}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const { active, activeId } = useDevices()
  const { entries, busy, meta, send, stop, clear } = useChat()
  const [input, setInput] = React.useState("")
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries])

  const submit = (text?: string) => {
    const value = (text ?? input).trim()
    if (!value) return
    setInput("")
    void send(value, activeId)
  }

  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "ИИ-ассистент" }]} />
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">ИИ-ассистент</h1>
            <p className="text-sm text-muted-foreground">
              Анализирует данные роутера через инструменты: снапшоты, история, журналы, команды display
            </p>
          </div>
          <div className="flex items-center gap-2">
            {meta?.model && (
              <Badge variant="secondary" className="font-mono text-xs">
                {meta.model}
              </Badge>
            )}
            {active && (
              <Badge variant="outline" className="text-xs">
                {active.name}
              </Badge>
            )}
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/settings" />}>
              <SettingsIcon data-icon="inline-start" />
              Настройки
            </Button>
          </div>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-6">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--chart-1)]/15 text-[var(--chart-1)]">
                    <SparklesIcon className="size-6" />
                  </div>
                  <div>
                    <p className="font-medium">Спросите что угодно о сети</p>
                    <p className="text-sm text-muted-foreground">
                      Ассистент сам вызовет нужные инструменты и посмотрит реальные данные роутера
                    </p>
                  </div>
                  <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => submit(s)}
                        className="rounded-lg border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6 pb-2">
                  {entries.map((entry, i) =>
                    entry.kind === "user" ? (
                      <div key={i} className="flex gap-3">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <UserIcon className="size-4" />
                        </div>
                        <div className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{entry.text}</div>
                      </div>
                    ) : (
                      <AssistantEntry key={i} entry={entry} />
                    )
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="flex items-end gap-2 border-t pt-4">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
                placeholder={active ? `Спросите про ${active.name}…` : "Добавьте роутер в настройках"}
                rows={2}
                className="min-h-11 resize-none"
              />
              {busy ? (
                <Button variant="outline" onClick={stop}>
                  <CircleStopIcon data-icon="inline-start" />
                  Стоп
                </Button>
              ) : (
                <Button onClick={() => submit()} disabled={!input.trim()}>
                  <SendIcon data-icon="inline-start" />
                  Отправить
                </Button>
              )}
            </div>
            {entries.length > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2Icon className="size-3.5" />
                  Данные берутся напрямую с устройства через инструменты
                </span>
                <button type="button" onClick={clear} className="hover:text-foreground">
                  Очистить чат
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
