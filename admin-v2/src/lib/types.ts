export type Device = {
  id: string
  name: string
  host: string
  port: number
  username: string
  wan_iface: string
  lan_iface: string
  location: string
  enabled: boolean
  created_at: number
  password_masked: string
  has_password: boolean
  connected: boolean
  last_ok: number | null
  last_error: string | null
  poller: {
    runs: number
    failures: number
    last_duration: number | null
    started: number
    last_error: string | null
  }
}

export type Interface = {
  name: string
  phys: string
  proto: string
  inutil?: number
  oututil?: number
  inerr?: number
  outerr?: number
  [key: string]: unknown
}

export type IpInterface = {
  name: string
  ip: string
  phys: string
  proto: string
  [key: string]: unknown
}

export type Route = {
  destination: string
  proto: string
  pref: number
  cost: number
  flags: string
  next_hop: string
  iface: string
}

export type ArpEntry = {
  ip: string
  mac: string
  expire: string
  type: string
  iface: string
}

export type MacEntry = {
  mac: string
  vlan: number
  port: string
  type: string
}

export type DhcpPool = {
  name: string
  network: string
  mask: string
  gateway: string
  lease: string
  total: number
  used: number
  idle: number
  expired: number
  conflict: number
  status: string
}

export type LogEntry = {
  id: number
  ts: number
  log_ts: string
  module: string
  severity: number
  code: string
  msg: string
}

export type Alert = {
  id?: number
  ts: number
  kind: string
  severity: "critical" | "warning" | "info"
  message: string
  resolved: boolean
  resolved_ts?: number
}

export type Temperature = {
  slot: string
  card?: string
  sensor?: string
  name: string
  status: string
  upper: number
  lower: number
  temp: number
}

export type Summary = {
  ifaces_up: number
  ifaces_total: number
  routes: number
  arp_entries: number
  mac_entries: number
  mac_total: number
  lldp_neighbors: number
  dhcp_used: number
  dhcp_idle: number
  alarms: number
}

export type Wan = {
  iface: string
  state: string
  line_protocol: string
  mac?: string
  speed?: string
  duplex?: string
  in_bps: number
  out_bps: number
  in_pps: number
  out_pps: number
  rx_errors: number
  tx_errors: number
  [key: string]: unknown
}

export type Snapshot = {
  ts?: number
  collected_in_s?: number
  connected?: boolean
  device_id?: string
  device_name?: string
  errors?: Record<string, string>
  model?: string
  vrp_version?: string
  uptime?: string
  sdram_mb?: number
  device_time?: string
  timezone?: string
  cpu_percent?: number
  cpu_max_percent?: number
  mem_percent?: number
  mem_used_kb?: number
  mem_total_kb?: number
  temperature?: Temperature[]
  identity?: Record<string, string>
  interfaces?: Interface[]
  ip_interfaces?: IpInterface[]
  routes?: Route[]
  arp?: ArpEntry[]
  mac_table?: MacEntry[]
  mac_total?: number
  lldp?: { local: string; neighbor: string; port: string; ttl: string }[]
  pools?: DhcpPool[]
  vlans?: { id: number; type: string; status: string }[]
  dns?: Record<string, string>[]
  ntp?: Record<string, string>
  ssh?: Record<string, string>
  alarms?: string[]
  log_stats?: Record<string, number>
  log_recent?: Omit<LogEntry, "id" | "severity">[]
  traps_recent?: Record<string, unknown>[]
  wan?: Wan
  lan?: Record<string, unknown>
  summary?: Summary
  poller?: Device["poller"]
  active_alerts?: Alert[]
}

export type LiveFrame = {
  type: "live"
  device_id: string
  ts: number
  collected_ts: number
  age_s: number
  running: boolean
  connected: boolean
  model?: string
  vrp_version?: string
  uptime?: string
  sdram_mb?: number
  cpu?: number
  cpu_max?: number
  mem?: number
  mem_used_kb?: number
  mem_total_kb?: number
  temp?: number
  wan?: Partial<Wan>
  summary?: Summary
  devices?: { id: string; name: string; connected: boolean }[]
  error?: string
}

export type HistoryPoint = {
  ts: number
  cpu?: number
  mem_percent?: number
  wan_in_bps?: number
  wan_out_bps?: number
  wan_in_pps?: number
  wan_out_pps?: number
  dhcp_used?: number
  mac_entries?: number
  ifaces_up?: number
  ifaces_total?: number
  alarms?: number
  wan_rx_errors?: number
  wan_tx_errors?: number
}

export type AiSettings = {
  base_url: string
  api_key_masked: string
  has_api_key: boolean
  model: string
  temperature: number
  max_tokens: number
  max_tool_rounds: number
  system_prompt: string
}
