"use client"

import * as React from "react"
import { apiGet, ApiError } from "@/lib/snapshot"
import type { Device, DeviceInput } from "@/lib/api-types"

const STORAGE_KEY = "monini.device"
const CACHE_KEY = "monini.devices"

type DeviceContextValue = {
  devices: Device[]
  activeId: string | null
  active: Device | null
  loading: boolean
  error: string | null
  setActiveId: (id: string) => void
  reload: () => Promise<void>
  create: (input: DeviceInput) => Promise<Device>
  update: (id: string, patch: Record<string, unknown>) => Promise<Device>
  remove: (id: string) => Promise<void>
  check: (id: string) => Promise<{ ok: boolean; error?: string; parsed?: Record<string, unknown> }>
}

const DeviceContext = React.createContext<DeviceContextValue | null>(null)

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const parsed = (await res.json()) as { detail?: string; message?: string }
      message = parsed.detail ?? parsed.message ?? message
    } catch {}
    throw new ApiError(message, res.status)
  }
  return (await res.json()) as T
}

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  // Seed from the last known list so a reload does not flash "add a device"
  // while the registry request is still in flight.
  const [devices, setDevices] = React.useState<Device[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = window.localStorage.getItem(CACHE_KEY)
      return raw ? (JSON.parse(raw) as Device[]) : []
    } catch {
      return []
    }
  })
  const [activeId, setActiveIdState] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    try {
      const list = await apiGet<Device[]>("/devices")
      setDevices(list)
      setError(null)
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(list))
      } catch {
        // storage full / private mode: ignore
      }
      setActiveIdState((current) => {
        if (current && list.some((d) => d.id === current)) return current
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
        if (stored && list.some((d) => d.id === stored)) return stored
        return list[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить роутеры")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reload()
    const timer = window.setInterval(() => void reload(), 30_000)
    return () => window.clearInterval(timer)
  }, [reload])

  const setActiveId = React.useCallback((id: string) => {
    setActiveIdState(id)
    window.localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const create: DeviceContextValue["create"] = React.useCallback(
    async (input) => {
      const device = await request<Device>("/devices", "POST", input)
      await reload()
      setActiveId(device.id)
      return device
    },
    [reload, setActiveId]
  )

  const update: DeviceContextValue["update"] = React.useCallback(
    async (id, patch) => {
      const device = await request<Device>(`/devices/${id}`, "PATCH", patch)
      await reload()
      return device
    },
    [reload]
  )

  const remove: DeviceContextValue["remove"] = React.useCallback(
    async (id) => {
      await request<{ deleted: string }>(`/devices/${id}`, "DELETE")
      await reload()
    },
    [reload]
  )

  const check: DeviceContextValue["check"] = React.useCallback(async (id) => {
    return request<{ ok: boolean; error?: string; parsed?: Record<string, unknown> }>(
      `/devices/${id}/check`,
      "POST"
    )
  }, [])

  const active = devices.find((d) => d.id === activeId) ?? null

  const value = React.useMemo(
    () => ({ devices, activeId, active, loading, error, setActiveId, reload, create, update, remove, check }),
    [devices, activeId, active, loading, error, setActiveId, reload, create, update, remove, check]
  )

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevices(): DeviceContextValue {
  const ctx = React.useContext(DeviceContext)
  if (!ctx) throw new Error("useDevices must be used within DeviceProvider")
  return ctx
}
