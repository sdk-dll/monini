// Demo data used when the FastAPI backend is not running.
// Shapes mirror the real API so components stay identical in both modes.

import type { Snapshot } from "@/lib/snapshot"

export const demoDevice = {
  model: "AP4050DN",
  vrpVersion: "V200R019C10SPC700",
  uptime: "2 недели, 4 дня, 11 часов, 27 минут",
  ip: "192.168.1.1",
  serial: "2102352158P0F4300123",
  cpuPercent: 18.2,
  cpuMaxPercent: 63.4,
  memPercent: 46,
  memUsedKb: 120832,
  memTotalKb: 262144,
  temperature: 41,
  firmware: "outdated" as const,
}

export const demoInterface = {
  name: "GE0/0/1",
  description: "Внешний канал — провайдер",
  phys: "up" as const,
  proto: "up" as const,
  ip: "10.14.22.37/24",
  inutil: 38.4,
  oututil: 21.7,
  inerr: 0,
  outerr: 0,
}

export const demoClient = {
  hostname: "macbook-pro",
  ip: "192.168.1.43",
  mac: "d8:9e:f3:2a:77:1c",
  ssid: "Home-5G",
  band: "5 GHz" as const,
  signal: -47,
  rxKbps: 18420,
  txKbps: 6120,
  uptime: "6h 12m",
  online: true,
}

export const demoEvents = [
  { time: "13:02", level: "warn" as const, title: "Всплеск нагрузки CPU", detail: "CPU достигал 63,4% в течение 12 с" },
  { time: "12:47", level: "info" as const, title: "Клиент подключился", detail: "galaxy-s24 вошёл в Home-5G" },
  { time: "11:20", level: "error" as const, title: "Пропадал интерфейс", detail: "интерфейс GE0/0/2 перешёл в down" },
  { time: "09:03", level: "info" as const, title: "Снят снапшот", detail: "huawei_mon.py — 8 команд выполнено" },
  { time: "07:41", level: "warn" as const, title: "Прошивка устарела", detail: "V200R019C10SPC700 < V200R023" },
]

/** Offline demo snapshot: same shape as GET /api/overview. */
export const demoSnapshot: Snapshot = {
  ts: Date.now() / 1000,
  connected: true,
  model: demoDevice.model,
  vrp_version: demoDevice.vrpVersion,
  uptime: demoDevice.uptime,
  sdram_mb: 256,
  cpu_percent: demoDevice.cpuPercent,
  cpu_max_percent: demoDevice.cpuMaxPercent,
  mem_percent: demoDevice.memPercent,
  mem_used_kb: demoDevice.memUsedKb,
  mem_total_kb: demoDevice.memTotalKb,
  temperature: [{ name: "CPU", current: demoDevice.temperature, low: 5, high: 80 }],
  interfaces: [
    { name: "GE0/0/1", phys: "up", proto: "up", inutil: 38.4, oututil: 21.7, inerr: 0, outerr: 0 },
    { name: "Wlan-Default", phys: "up", proto: "up", inutil: 61.2, oututil: 44.8, inerr: 2, outerr: 0 },
    { name: "Vlanif1", phys: "up", proto: "up", inutil: 1.4, oututil: 0.9, inerr: 0, outerr: 0 },
    { name: "GE0/0/2", phys: "down", proto: "down", inutil: null, oututil: null, inerr: 0, outerr: 0 },
  ],
  ip_interfaces: [
    { name: "GE0/0/1", ip: "10.14.22.37/24", phys: "up", proto: "up" },
    { name: "Vlanif1", ip: "192.168.1.1/24", phys: "up", proto: "up" },
  ],
  routes: [
    { destination: "0.0.0.0/0", proto: "Static", pref: 60, cost: 0, flags: "RD", next_hop: "10.14.22.1", iface: "GE0/0/1" },
    { destination: "10.14.22.0/24", proto: "Direct", pref: 0, cost: 0, flags: "D", next_hop: "10.14.22.37", iface: "GE0/0/1" },
    { destination: "192.168.1.0/24", proto: "Direct", pref: 0, cost: 0, flags: "D", next_hop: "192.168.1.1", iface: "Vlanif1" },
  ],
  arp: [
    { ip: "10.14.22.1", mac: "e48d-8c11-4290", expire: "00:18:24", type: "dynamic", iface: "GE0/0/1" },
    { ip: "192.168.1.43", mac: "d89e-f32a-771c", expire: "00:04:11", type: "dynamic", iface: "Wlan-Default" },
    { ip: "192.168.1.12", mac: "001a-2bcc-9f3d", expire: "-", type: "static", iface: "Vlanif1" },
  ],
  pools: [
    { name: "lan", network: "192.168.1.0", mask: "255.255.255.0", gateway: "192.168.1.1", status: "used", total: 254, used: 4, idle: 250, expired: 0, conflict: 0 },
  ],
  wan: { iface: "GE0/0/1", state: "UP", ip: "10.14.22.37/24", in_bps: 58_000_000, out_bps: 12_400_000 },
  summary: {
    ifaces_up: 3,
    ifaces_total: 4,
    routes: 3,
    arp_entries: 3,
    mac_entries: 4,
    mac_total: 4,
    lldp_neighbors: 1,
    dhcp_used: 4,
    dhcp_idle: 250,
    alarms: 1,
  },
  log_recent: [
    { ts: "2026-11-13 13:02:11", module: "DEV", sev: "4", code: "CPU", idx: "1", msg: "CPU reached 63.4% for 12s" },
    { ts: "2026-11-13 12:47:02", module: "WLAN", sev: "5", code: "CLI", idx: "2", msg: "galaxy-s24 joined Home-5G" },
    { ts: "2026-11-13 11:20:44", module: "IFNET", sev: "3", code: "LINK", idx: "3", msg: "GE0/0/2 went down" },
  ],
}
