import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BellRing,
  Bot,
  Cable,
  CircleHelp,
  Clock3,
  Command,
  Cpu,
  Database,
  FileClock,
  Gauge,
  HardDrive,
  LayoutDashboard,
  ListFilter,
  Network,
  Router,
  ScrollText,
  ServerCog,
  Settings2,
  ShieldCheck,
  Wifi,
} from "lucide-react"

export type NavItem = {
  title: string
  url?: string
  icon?: LucideIcon
  items?: NavItem[]
  badge?: string
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: "Monitoring",
    items: [
      { title: "Overview", url: "/", icon: LayoutDashboard },
      { title: "Live telemetry", url: "/live", icon: Activity, badge: "LIVE" },
      { title: "Alerts", url: "/alerts", icon: BellRing },
      { title: "History", url: "/history", icon: Clock3 },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { title: "Devices", url: "/devices", icon: Router },
      {
        title: "Network",
        icon: Network,
        items: [
          { title: "Interfaces", url: "/network/interfaces" },
          { title: "Routes & ARP", url: "/network/routes" },
          { title: "MAC / LLDP", url: "/network/mac" },
          { title: "VLANs", url: "/network/vlans" },
        ],
      },
      { title: "DHCP", url: "/dhcp", icon: Database },
      { title: "System", url: "/system", icon: ServerCog },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Logs", url: "/logs", icon: ScrollText },
      { title: "Traps", url: "/traps", icon: Wifi },
      { title: "Console", url: "/console", icon: Command },
      { title: "AI Assistant", url: "/assistant", icon: Bot },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "General", url: "/settings", icon: Settings2 },
      { title: "AI settings", url: "/settings/ai", icon: ShieldCheck },
      { title: "API / Tools", url: "/settings/tools", icon: Cable },
      { title: "About", url: "/settings/about", icon: CircleHelp },
    ],
  },
]

export const appTitles: Record<string, string> = {
  "": "Monini · Overview",
  live: "Live telemetry",
  alerts: "Alerts",
  history: "History",
  devices: "Devices",
  network: "Network",
  dhcp: "DHCP",
  system: "System",
  logs: "Logs",
  traps: "Traps",
  console: "Console",
  assistant: "AI Assistant",
  settings: "Settings",
}

export const metricOptions = [
  { value: "cpu", label: "CPU %" },
  { value: "mem_percent", label: "Memory %" },
  { value: "wan_in_bps", label: "WAN in (bps)" },
  { value: "wan_out_bps", label: "WAN out (bps)" },
  { value: "wan_in_pps", label: "WAN in (pps)" },
  { value: "wan_out_pps", label: "WAN out (pps)" },
  { value: "dhcp_used", label: "DHCP leases" },
  { value: "mac_entries", label: "MAC entries" },
  { value: "ifaces_up", label: "Interfaces up" },
  { value: "alarms", label: "Alarms" },
  { value: "wan_rx_errors", label: "WAN RX errors" },
  { value: "wan_tx_errors", label: "WAN TX errors" },
]
