// Shapes returned by the FastAPI backend (backend.py) and SSE payloads.

export type RawInterface = {
  name: string
  phys: string
  proto: string
  inutil: number | null
  oututil: number | null
  inerr: number | null
  outerr: number | null
}

export type RawIpInterface = {
  name: string
  ip: string
  phys: string
  proto: string
}

export type RawRoute = {
  destination: string
  proto: string
  pref: number
  cost: number
  flags: string
  next_hop: string
  iface: string
}

export type RawArp = {
  ip: string
  mac: string
  expire?: string
  type?: string
  iface: string
}

export type RawPool = {
  name: string
  network?: string
  mask?: string
  gateway?: string
  status?: string
  total?: number
  used?: number
  idle?: number
  expired?: number
  conflict?: number
}

export type RawTemperature = {
  low?: number
  high?: number
  current?: number
  name?: string
}

export type RawMac = {
  mac: string
  vlan: number
  port: string
  type: string
}

export type RawLogEntry = {
  ts: string
  module: string
  sev: string
  code: string
  kind?: string
  idx: string
  msg: string
  snapshot_ts?: number
}

export type RawTrap = Record<string, string | undefined>

export type Summary = {
  ifaces_up: number
  ifaces_total: number
  routes: number
  arp_entries: number
  mac_entries: number
  mac_total: number | null
  lldp_neighbors: number
  dhcp_used: number
  dhcp_idle: number
  alarms: number
}

export type Snapshot = {
  ts: number
  collected_in_s?: number
  connected?: boolean
  errors?: Record<string, string>
  model?: string
  vrp_version?: string
  uptime?: string
  sdram_mb?: number
  device_time?: string
  timezone?: string
  cpu_percent?: number
  cpu_max_percent?: number
  cpu_5s_percent?: number
  cpu_1m_percent?: number
  cpu_5m_percent?: number
  mem_percent?: number
  mem_used_kb?: number
  mem_total_kb?: number
  temperature?: RawTemperature[]
  identity?: Record<string, string>
  interfaces?: RawInterface[]
  ip_interfaces?: RawIpInterface[]
  routes?: RawRoute[]
  arp?: RawArp[]
  mac_table?: RawMac[]
  mac_total?: number | null
  lldp?: Record<string, string>[]
  pools?: RawPool[]
  vlans?: Record<string, string | number>[]
  dns?: Record<string, string>[]
  ntp?: Record<string, string>
  ssh?: Record<string, string | number>
  alarms?: string[]
  log_stats?: Record<string, number>
  log_recent?: RawLogEntry[]
  traps_recent?: RawTrap[]
  wan?: {
    iface?: string
    state?: string
    ip?: string
    in_bps?: number
    out_bps?: number
    in_errors?: number
    out_errors?: number
  }
  lan?: Record<string, string | number | undefined>
  summary?: Summary
  poller?: { snapshots: number; errors: number; last_error: string | null; last_ts: number | null }
  active_alerts?: { kind: string; severity: string; message: string; ts: number }[]
  parse_error?: string
}

export type StreamPayload = {
  ts: number
  cpu: number | null
  mem: number | null
  wan: Snapshot["wan"]
  summary?: Summary
  alarms: number
  connected?: boolean
}

export type HistoryPoint = {
  ts: number
  cpu?: number | null
  mem_percent?: number | null
  wan_in_bps?: number | null
  wan_out_bps?: number | null
  wan_in_pps?: number | null
  wan_out_pps?: number | null
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { cache: "no-store", signal })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string; message?: string }
      message = body.detail ?? body.message ?? message
    } catch {}
    throw new ApiError(message, res.status)
  }
  return (await res.json()) as T
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "PUT",
    cache: "no-store",
    headers: { "content-type": "application/json" },
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

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
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

export function cpuOf(s: Pick<Snapshot, "cpu_percent" | "cpu_5s_percent">): number | null {
  return s.cpu_percent ?? s.cpu_5s_percent ?? null
}

export function currentTemp(temps?: RawTemperature[]): number | null {
  if (!temps?.length) return null
  const withValue = temps.filter((t) => typeof t.current === "number")
  if (!withValue.length) return null
  return Math.max(...withValue.map((t) => t.current as number))
}

export function formatUptime(uptime?: string): string {
  return uptime ?? "—"
}

export function bpsToMbit(v?: number | null): number {
  return v ? v / 1_000_000 : 0
}
