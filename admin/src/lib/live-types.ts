// One-second live snapshot shape, pushed over SSE by backend.py.
export type LiveSnapshot = {
  type: "live"
  device_id: string
  ts: number
  collected_ts: number | null
  age_s: number | null
  running: boolean
  connected: boolean
  model: string | null
  vrp_version: string | null
  uptime: string | null
  cpu: number | null
  cpu_max: number | null
  mem: number | null
  mem_used_kb: number | null
  mem_total_kb: number | null
  temp: number | null
  wan: {
    iface?: string
    state?: string
    ip?: string
    in_bps?: number
    out_bps?: number
    in_pps?: number
    out_pps?: number
    rx_errors?: number
    tx_errors?: number
  } | null
  summary: {
    ifaces_up: number
    ifaces_total: number
    routes: number
    arp_entries: number
    mac_entries: number
    dhcp_used: number
    dhcp_idle?: number
    lldp_neighbors?: number
    alarms: number
  } | null
  devices: { id: string; name: string; connected: boolean }[]
}

export function isLiveSnapshot(value: unknown): value is LiveSnapshot {
  return !!value && typeof value === "object" && (value as { type?: string }).type === "live"
}
