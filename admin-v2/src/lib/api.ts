import type {
  AiSettings,
  Alert,
  Device,
  HistoryPoint,
  LiveFrame,
  LogEntry,
  Snapshot,
} from "@/lib/types"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path.replace(/^\//, "")}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      message = body.detail || body.message || message
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, String(message))
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () =>
    request<{
      status: string
      devices: number
      devices_connected: number
      interval: number
      latest_ts: number | null
    }>("health"),

  devices: () => request<Device[]>("devices"),
  addDevice: (data: Partial<Device> & { host: string }) =>
    request<Device>("devices", { method: "POST", body: JSON.stringify(data) }),
  updateDevice: (id: string, data: Partial<Device>) =>
    request<Device>(`devices/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteDevice: (id: string) =>
    request<{ deleted: string }>(`devices/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  checkDevice: (id: string) =>
    request<{ ok: boolean; parsed?: Record<string, unknown>; error?: string; output?: string }>(
      `devices/${encodeURIComponent(id)}/check`,
      { method: "POST" }
    ),
  refresh: (device?: string) =>
    request<{ ts: number }>(`refresh${device ? `?device=${encodeURIComponent(device)}` : ""}`, {
      method: "POST",
    }),

  overview: (device?: string) =>
    request<Snapshot>(`overview${device ? `?device=${encodeURIComponent(device)}` : ""}`),
  system: (device?: string) =>
    request<Snapshot>(`system${device ? `?device=${encodeURIComponent(device)}` : ""}`),
  interfaces: (device?: string) =>
    request<{
      interfaces: Snapshot["interfaces"]
      ip_interfaces: Snapshot["ip_interfaces"]
      wan: Snapshot["wan"]
      lan: Snapshot["lan"]
    }>(`interfaces${device ? `?device=${encodeURIComponent(device)}` : ""}`),
  interfaceDetail: (name: string, device?: string) =>
    request<{ name: string; parsed: Record<string, unknown>; output: string }>(
      `interfaces/${encodeURIComponent(name)}${device ? `?device=${encodeURIComponent(device)}` : ""}`
    ),
  network: (device?: string) =>
    request<{
      routes: Snapshot["routes"]
      arp: Snapshot["arp"]
      mac_table: Snapshot["mac_table"]
      lldp: Snapshot["lldp"]
      vlans: Snapshot["vlans"]
      pools: Snapshot["pools"]
    }>(`network${device ? `?device=${encodeURIComponent(device)}` : ""}`),
  dhcp: (device?: string) =>
    request<{ pools: Snapshot["pools"] }>(
      `dhcp${device ? `?device=${encodeURIComponent(device)}` : ""}`
    ),
  traps: (device?: string) =>
    request<Record<string, unknown>[]>(
      `traps${device ? `?device=${encodeURIComponent(device)}` : ""}`
    ),

  logs: (params: {
    limit?: number
    offset?: number
    module?: string
    severity_max?: number
    search?: string
    since?: number
  } = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v))
    })
    return request<{ total: number; items: LogEntry[] }>(`logs?${q}`)
  },
  logModules: () =>
    request<{ module: string; n: number; min_sev: number }[]>("logs/modules"),
  alerts: (limit = 200) => request<Alert[]>(`alerts?limit=${limit}`),
  history: (params: {
    minutes?: number
    fields?: string
    device?: string
  } = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v))
    })
    return request<{ since: number; points: HistoryPoint[] }>(`history?${q}`)
  },

  command: (command: string, deviceId?: string) =>
    request<{ command: string; output: string; ts: number }>("command", {
      method: "POST",
      body: JSON.stringify({ command, device_id: deviceId }),
    }),

  settings: () => request<{ ai: AiSettings }>("settings"),
  saveSettings: (data: { ai: Partial<AiSettings> }) =>
    request<{ ai: AiSettings }>("settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  aiModels: () =>
    request<{
      models: { id: string; name: string; supports_tools: boolean; context_window: number }[]
      current: string
    }>("ai/models"),
  aiTools: () => request<Record<string, unknown>[]>("ai/tools"),

  live: (device?: string) =>
    request<LiveFrame>(`live${device ? `?device=${encodeURIComponent(device)}` : ""}`),
}

export function liveStreamUrl(device?: string) {
  return `/api/stream${device ? `?device=${encodeURIComponent(device)}` : ""}`
}

export function aiChatUrl() {
  return "/api/ai/chat"
}

export function historyCsvUrl(minutes = 1440) {
  return `/api/history/export.csv?minutes=${minutes}`
}
