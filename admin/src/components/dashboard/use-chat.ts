"use client"

import * as React from "react"
import type { ChatMessage, ToolCall } from "@/lib/api-types"

export type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; tools: ToolCall[]; pending: boolean; error?: string }

type ChatState = {
  entries: ChatEntry[]
  busy: boolean
  meta: { model?: string; endpoint?: string } | null
  send: (text: string, deviceId: string | null) => Promise<void>
  stop: () => void
  clear: () => void
  abortRef: React.RefObject<AbortController | null>
}

function parseFrames(buffer: string): { frames: { event: string; data: string }[]; rest: string } {
  const frames: { event: string; data: string }[] = []
  const parts = buffer.split("\n\n")
  const rest = parts.pop() ?? ""
  for (const part of parts) {
    let event = "message"
    const dataLines: string[] = []
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length) frames.push({ event, data: dataLines.join("\n") })
  }
  return { frames, rest }
}

export function useChat(): ChatState {
  const [entries, setEntries] = React.useState<ChatEntry[]>([])
  const [busy, setBusy] = React.useState(false)
  const [meta, setMeta] = React.useState<ChatState["meta"]>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clear = React.useCallback(() => {
    setEntries([])
  }, [])

  const send = React.useCallback(
    async (text: string, deviceId: string | null) => {
      const trimmed = text.trim()
      if (!trimmed || busy) {
        return
      }
      const history: ChatMessage[] = entries
        .map((e): ChatMessage =>
          e.kind === "user"
            ? { role: "user", content: e.text }
            : { role: "assistant", content: e.text }
        )
        .filter((m) => m.content.trim())
      setEntries((prev) => [
        ...prev,
        { kind: "user", text: trimmed },
        { kind: "assistant", text: "", tools: [], pending: true },
      ])
      setBusy(true)

      const controller = new AbortController()
      abortRef.current = controller

      const updateAssistant = (fn: (entry: Extract<ChatEntry, { kind: "assistant" }>) => void) => {
        setEntries((prev) => {
          const next = [...prev]
          for (let i = next.length - 1; i >= 0; i--) {
            const entry = next[i]
            if (entry.kind === "assistant") {
              const clone = { ...entry, tools: entry.tools.map((t) => ({ ...t })) }
              fn(clone)
              next[i] = clone
              break
            }
          }
          return next
        })
      }

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: [...history, { role: "user", content: trimmed }], device_id: deviceId }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          let message = `HTTP ${res.status}`
          try {
            const body = (await res.json()) as { detail?: string; message?: string }
            message = body.detail ?? body.message ?? message
          } catch {}
          updateAssistant((e) => {
            e.pending = false
            e.error = message
          })
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          console.log("[chat] chunk frames", buffer.split("\n\n").length, JSON.stringify(buffer.slice(-60)))
          const { frames, rest } = parseFrames(buffer)
          buffer = rest
          for (const frame of frames) {
            let payload: any
            try {
              payload = JSON.parse(frame.data)
            } catch {
              continue
            }
            console.log("[chat] frame", frame.event)
            switch (frame.event) {
              case "meta":
                setMeta({ model: payload.model, endpoint: payload.endpoint })
                break
              case "delta":
                updateAssistant((e) => {
                  e.text += payload.text ?? ""
                })
                break
              case "tool_start":
                updateAssistant((e) => {
                  e.tools.push({
                    id: payload.id,
                    name: payload.name,
                    arguments: payload.arguments,
                    status: "running",
                  })
                })
                break
              case "tool_result":
                updateAssistant((e) => {
                  const tool = e.tools.find((t) => t.id === payload.id)
                  if (tool) {
                    tool.status = "done"
                    tool.result = payload.result
                    tool.tookMs = payload.took_ms
                  }
                })
                break
              case "done":
                updateAssistant((e) => {
                  e.pending = false
                  if (!e.text && payload.content) e.text = payload.content
                })
                break
              case "error":
                updateAssistant((e) => {
                  e.pending = false
                  e.error = payload.message ?? "Ошибка агента"
                })
                break
            }
          }
        }
        updateAssistant((e) => {
          e.pending = false
        })
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === "AbortError"
        updateAssistant((e) => {
          e.pending = false
          if (!aborted) e.error = err instanceof Error ? err.message : String(err)
          if (aborted) e.text += e.text ? "\n\n_(остановлено)_" : "_(остановлено)_"
        })
      } finally {
        abortRef.current = null
        setBusy(false)
      }
    },
    [busy, entries]
  )

  return { entries, busy, meta, send, stop, clear, abortRef }
}
