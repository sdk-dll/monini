"use client"

import * as React from "react"

import { api } from "@/lib/api"
import type { Device } from "@/lib/types"

type Ctx = {
  devices: Device[]
  selectedId: string | null
  setSelectedId: (id: string) => void
  loading: boolean
  error: string | null
  reload: () => void
}

const DevicesContext = React.createContext<Ctx | null>(null)

const STORAGE_KEY = "monini-device"

export function DevicesProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = React.useState<Device[]>([])
  const [selectedId, setSelectedIdState] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .devices()
      .then((list) => {
        if (!alive) return
        setDevices(list)
        setError(null)
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(STORAGE_KEY)
            : null
        setSelectedIdState((prev) => {
          if (prev && list.some((d) => d.id === prev)) return prev
          if (stored && list.some((d) => d.id === stored)) return stored
          return list.find((d) => d.enabled)?.id ?? list[0]?.id ?? null
        })
      })
      .catch((e) => alive && setError(String(e.message || e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [tick])

  const setSelectedId = React.useCallback((id: string) => {
    setSelectedIdState(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  const value = React.useMemo<Ctx>(
    () => ({
      devices,
      selectedId,
      setSelectedId,
      loading,
      error,
      reload: () => setTick((t) => t + 1),
    }),
    [devices, selectedId, setSelectedId, loading, error]
  )

  return (
    <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>
  )
}

export function useDevices() {
  const ctx = React.useContext(DevicesContext)
  if (!ctx) throw new Error("useDevices must be used within DevicesProvider")
  return ctx
}

/** Convenience hook: the currently selected device (or undefined). */
export function useSelectedDevice() {
  const { devices, selectedId } = useDevices()
  return devices.find((d) => d.id === selectedId)
}
