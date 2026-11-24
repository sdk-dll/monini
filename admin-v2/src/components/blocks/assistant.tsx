"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Loader2,
  Send,
  Sparkles,
  Square,
  Wrench,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { aiChatUrl } from "@/lib/api"
import { useSelectedDevice } from "@/components/providers/devices-provider"
import { cn } from "@/lib/utils"

type Message = {
  role: "user" | "assistant"
  content: string
  tools?: ToolCall[]
  error?: boolean
}

type ToolCall = {
  id: string
  name: string
  arguments?: Record<string, unknown>
  result?: string
  status: "running" | "done" | "error"
  took_ms?: number
}

const SUGGESTIONS = [
  "What is the current CPU and memory usage?",
  "Show all interfaces that are down",
  "Any critical alerts in the last hour?",
  "Summarize the latest DHCP pool utilization",
  "Are there SSH or NTP issues?",
]

export function AssistantPage() {
  const device = useSelectedDevice()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [model, setModel] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content }])
    setBusy(true)

    const controller = new AbortController()
    abortRef.current = controller
    const assistantIndex = messages.length + 1
    setMessages((prev) => [...prev, { role: "assistant", content: "", tools: [] }])

    try {
      const history = messages
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-10)

      const res = await fetch(aiChatUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content }],
          device_id: device?.id,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let full = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split("\n\n")
        buffer = frames.pop() ?? ""
        for (const frame of frames) {
          const eventMatch = frame.match(/^event:\s*(.+)$/m)
          const dataMatch = frame.match(/^data:\s*(.+)$/m)
          if (!dataMatch) continue
          const event = eventMatch?.[1] ?? "message"
          let payload: Record<string, unknown> = {}
          try { payload = JSON.parse(dataMatch[1]) } catch { continue }

          if (event === "meta") {
            setModel(String(payload.model ?? "AI"))
          } else if (event === "delta") {
            full += String(payload.text ?? "")
            const snapshot = full
            setMessages((prev) => prev.map((m, i) => i === assistantIndex ? { ...m, content: snapshot } : m))
          } else if (event === "tool_start") {
            const call: ToolCall = {
              id: String(payload.id ?? Math.random()),
              name: String(payload.name ?? "tool"),
              arguments: (payload.arguments as Record<string, unknown>) ?? {},
              status: "running",
            }
            setMessages((prev) => prev.map((m, i) => i === assistantIndex ? { ...m, tools: [...(m.tools ?? []), call] } : m))
          } else if (event === "tool_result") {
            const id = String(payload.id ?? "")
            setMessages((prev) => prev.map((m, i) => {
              if (i !== assistantIndex) return m
              return {
                ...m,
                tools: (m.tools ?? []).map((t) => t.id === id ? { ...t, status: "done", result: String(payload.result ?? ""), took_ms: Number(payload.took_ms ?? 0) } : t),
              }
            }))
          } else if (event === "done") {
            const final = String(payload.content ?? full)
            setMessages((prev) => prev.map((m, i) => i === assistantIndex ? { ...m, content: final } : m))
          } else if (event === "error") {
            const message = String(payload.message ?? "AI error")
            setMessages((prev) => prev.map((m, i) => i === assistantIndex ? { ...m, content: message, error: true } : m))
          }
          requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }))
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((prev) => prev.map((m, i) => i === assistantIndex ? { ...m, content: `Error: ${(e as Error).message}`, error: true } : m))
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask about the network state — the agent can query snapshots, history, logs and alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {model ? <Badge variant="outline" className="max-w-52 truncate">{model}</Badge> : null}
          <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" /> tools enabled</Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" asChild><Link href="/settings/ai"><ChevronDown className="-rotate-90 size-4" /></Link></Button>
            </TooltipTrigger>
            <TooltipContent>AI settings</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background"><Bot className="size-6" /></span>
              <div>
                <h2 className="text-lg font-semibold">What would you like to know?</h2>
                <p className="text-sm text-muted-foreground">The assistant works on live data from {device?.name ?? "the active device"}.</p>
              </div>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-lg border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4 sm:p-6">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" ? (
                    <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md border"><Bot className="size-4" /></span>
                  ) : null}
                  <div className={cn("max-w-3xl min-w-0 flex-1 rounded-xl px-4 py-3 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "bg-destructive/10 text-destructive" : "bg-muted/60")}>
                    {m.tools?.length ? (
                      <div className="mb-3 flex flex-col gap-1.5">
                        {m.tools.map((t) => (
                          <div key={t.id} className="flex items-center gap-2 rounded-lg border bg-background/60 px-2 py-1.5 text-xs">
                            {t.status === "running" ? <Loader2 className="size-3.5 animate-spin" /> : t.status === "done" ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <CircleAlert className="size-3.5 text-red-500" />}
                            <Wrench className="size-3.5 text-muted-foreground" />
                            <span className="font-mono font-medium">{t.name}</span>
                            {t.arguments && Object.keys(t.arguments).length ? (
                              <span className="truncate text-muted-foreground">{JSON.stringify(t.arguments)}</span>
                            ) : null}
                            {t.took_ms ? <span className="ml-auto text-muted-foreground">{Math.round(t.took_ms)}ms</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content || (busy && i === messages.length - 1 ? "Thinking…" : "")}</div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </CardContent>

        <form
          onSubmit={(e) => { e.preventDefault(); send() }}
          className="flex flex-col gap-2 border-t p-3 sm:p-4"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask about CPU, interfaces, logs, alerts…"
            className="min-h-16 max-h-40 resize-none"
            disabled={busy}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Enter to send · Shift+Enter for newline</span>
            <div className="flex items-center gap-2">
              {busy ? (
                <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
                  <Square className="size-3.5" /> Stop
                </Button>
              ) : null}
              <Button type="submit" disabled={busy || !input.trim()} size="sm">
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
