"use client"

import * as React from "react"
import {
  ApiError,
  apiGet,
  apiPost,
  type HistoryPoint,
  type Snapshot,
} from "@/lib/snapshot"
import { isLiveSnapshot, type LiveSnapshot } from "@/lib/live-types"
import { useDevices } from "./device-provider"

export type DataSource = "device" | "demo"

type LiveContextValue = {
  /** Full snapshot (interfaces, logs, routes…) — refreshed on every poll. */
  snapshot: Snapshot
  /** One-second live frame for the selected router: cpu, mem, wan, age… */
  live: LiveSnapshot | null
  /** True once the first live frame for the current router has arrived. */
  ready: boolean
  source: DataSource
  connected: boolean
  loading: boolean
  error: string | null
  lastUpdated: number | null
  refresh: () => Promise<void>
}

/** Empty snapshot used until the first real document arrives (never demo). */
const EMPTY_SNAPSHOT: Snapshot = { ts: 0 }

const LiveContext = React.createContext<LiveContextValue | null>(null)

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { activeId, devices, loading: devicesLoading } = useDevices()
  const [snapshot, setSnapshot] = React.useState<Snapshot>(EMPTY_SNAPSHOT)
  const [live, setLive] = React.useState<LiveSnapshot | null>(null)
  const [ready, setReady] = React.useState(false)
  const [source, setSource] = React.useState<DataSource>("device")
  const [connected, setConnected] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null)
  const loadedTs = React.useRef<number | null>(null)
  const loadedDevice = React.useRef<string | null>(null)

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!activeId) {
        setLoading(false)
        return
      }
      // Switching routers must not keep the previous router's document.
      if (loadedDevice.current !== activeId) {
        loadedDevice.current = activeId
        loadedTs.current = null
        setSnapshot(EMPTY_SNAPSHOT)
        setLive(null)
        setReady(false)
      }
      try {
        const data = await apiGet<Snapshot>(`/overview?device=${encodeURIComponent(activeId)}`, signal)
        if (loadedTs.current !== data.ts) {
          loadedTs.current = data.ts
          setSnapshot(data)
        }
        setSource("device")
        setError(null)
      } catch (err) {
        if (signal?.aborted) return
        const message =
          err instanceof ApiError
            ? err.status === 503
              ? "Ждём первый снапшот с устройства"
              : err.message
            : err instanceof Error
              ? err.message
              : "Не удалось получить данные"
        setError(message)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [activeId]
  )

  const refresh = React.useCallback(async () => {
    try {
      await apiPost<{ ts: number }>(`/refresh?device=${encodeURIComponent(activeId ?? "")}`)
      loadedTs.current = null
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить")
    }
  }, [load, activeId])

  // Initial + fallback polling (the SSE stream is the primary source).
  React.useEffect(() => {
    if (!activeId) return
    const controller = new AbortController()
    void load(controller.signal)
    const timer = window.setInterval(() => void load(), 30_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [load, activeId])

  // Live stream: reconnects whenever the selected router changes.
  React.useEffect(() => {
    if (!activeId) {
      setConnected(false)
      return
    }
    const source = new EventSource(`/api/sse?device=${encodeURIComponent(activeId)}`)
    let pollSeen: number | null = null
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as unknown
        if (!isLiveSnapshot(payload)) return
        if (payload.device_id && payload.device_id !== activeId) return
        setLive((prev) =>
          prev && prev.device_id === payload.device_id
            ? {
                ...prev,
                ...Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null)),
                devices: payload.devices?.length ? payload.devices : prev.devices,
              }
            : payload
        )
        setConnected(payload.running !== false)
        setLastUpdated(Date.now())
        // Only mark ready when there is a real sample (not just a live frame).
        const hasSample =
          payload.collected_ts !== null &&
          (payload.cpu !== null || payload.mem !== null || payload.wan !== null)
        if (hasSample) {
          setReady(true)
          setSource("device")
          setError(null)
        }
        // A new poll landed: pull the full document (interfaces, logs, MACs).
        if (payload.collected_ts && payload.collected_ts !== pollSeen) {
          const first = pollSeen === null
          pollSeen = payload.collected_ts
          if (!first) void load()
        }
      } catch {
        // ignore malformed frame
      }
    }
    return () => source.close()
  }, [activeId, load])

  // Keep the stream's device list in sync with the registry.
  React.useEffect(() => {
    if (devices.length === 0) return
    setLive((prev) =>
      prev
        ? {
            ...prev,
            devices: devices.map((d) => ({ id: d.id, name: d.name, connected: d.connected })),
          }
        : prev
    )
  }, [devices])

  // No routers at all: stop the spinner and say so.
  React.useEffect(() => {
    if (!devicesLoading && !activeId) setLoading(false)
  }, [devicesLoading, activeId])

  const value = React.useMemo(
    () => ({ snapshot, live, ready, source, connected, loading, error, lastUpdated, refresh }),
    [snapshot, live, ready, source, connected, loading, error, lastUpdated, refresh]
  )

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}

export function useLive(): LiveContextValue {
  const ctx = React.useContext(LiveContext)
  if (!ctx) throw new Error("useLive must be used within LiveProvider")
  return ctx
}

/** Metrics for the selected router. `null` means "no data yet". */
export function useLiveMetrics() {
  const { live, ready } = useLive()
  return {
    hasData: ready && !!live,
    polling: !ready,
    cpu: live?.cpu ?? null,
    cpuMax: live?.cpu_max ?? null,
    mem: live?.mem ?? null,
    memUsedKb: live?.mem_used_kb ?? null,
    memTotalKb: live?.mem_total_kb ?? null,
    temp: live?.temp ?? null,
    wan: live?.wan ?? null,
    summary: live?.summary ?? null,
    connected: live?.connected ?? false,
    ageS: live?.age_s ?? null,
    collectedTs: live?.collected_ts ?? null,
    liveAt: live?.ts ?? null,
  }
}

export function useHistory(minutes: number, fields: string) {
  const { lastUpdated, ready } = useLive()
  const [points, setPoints] = React.useState<HistoryPoint[]>([])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!ready) {
      setPoints([])
      return
    }
    const controller = new AbortController()
    apiGet<{ since: number; points: HistoryPoint[] }>(
      `/history?minutes=${minutes}&fields=${encodeURIComponent(fields)}`,
      controller.signal
    )
      .then((res) => {
        setPoints(res.points)
        setError(null)
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Нет истории")
        }
      })
    return () => controller.abort()
    // `lastUpdated` only changes on real polls, so this is not a 1s fetch.
  }, [minutes, fields, lastUpdated, ready])

  return { points, error }
}
