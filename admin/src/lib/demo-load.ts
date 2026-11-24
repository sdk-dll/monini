// Demo traffic analytics used on the "Нагрузка" page when the router is not
// reachable over SSH. Values are illustrative, shaped for the UI only.

export type TopClient = {
  id: string
  name: string
  type: "wireless" | "wired" | "guest"
  ip: string
  mac: string
  ssid: string
  band: "2.4 ГГц" | "5 ГГц" | "LAN"
  rxMbps: number
  txMbps: number
  totalMbps: number
  peakMbps: number
  signal: number | null
  uptime: string
  packets: number
  errors: number
  share: number
}

export type LoadPoint = { time: string; rx: number; tx: number }

export const loadPointLabel = (p: LoadPoint) => p.time

const rawClients: Omit<TopClient, "totalMbps" | "share">[] = [
  { id: "c1", name: "workstation", type: "wired", ip: "192.168.1.12", mac: "00:1a:2b:cc:9f:3d", ssid: "Home-LAN", band: "LAN", rxMbps: 58.2, txMbps: 21.4, peakMbps: 96.4, signal: null, uptime: "2д 4ч", packets: 842_192, errors: 0 },
  { id: "c2", name: "macbook-pro", type: "wireless", ip: "192.168.1.43", mac: "d8:9e:f3:2a:77:1c", ssid: "Home-5G", band: "5 ГГц", rxMbps: 31.6, txMbps: 9.8, peakMbps: 64.2, signal: -47, uptime: "6ч 12м", packets: 318_004, errors: 2 },
  { id: "c3", name: "nas-backup", type: "wired", ip: "192.168.1.20", mac: "00:11:32:8a:4c:91", ssid: "Home-LAN", band: "LAN", rxMbps: 18.9, txMbps: 14.2, peakMbps: 41.7, signal: null, uptime: "18д 2ч", packets: 214_771, errors: 0 },
  { id: "c4", name: "galaxy-s24", type: "wireless", ip: "192.168.1.77", mac: "3c:22:fb:9e:01:44", ssid: "Home-5G", band: "5 ГГц", rxMbps: 8.4, txMbps: 3.1, peakMbps: 27.3, signal: -58, uptime: "1ч 48м", packets: 76_120, errors: 1 },
  { id: "c5", name: "camera-hall", type: "wired", ip: "192.168.1.31", mac: "bc:ae:c5:71:0e:22", ssid: "Home-LAN", band: "LAN", rxMbps: 6.1, txMbps: 0.4, peakMbps: 8.9, signal: null, uptime: "31д 6ч", packets: 52_903, errors: 0 },
  { id: "c6", name: "guest-tablet", type: "guest", ip: "192.168.2.14", mac: "a4:83:e7:19:52:bb", ssid: "Guest", band: "2.4 ГГц", rxMbps: 4.7, txMbps: 1.9, peakMbps: 15.6, signal: -66, uptime: "38м", packets: 41_882, errors: 5 },
  { id: "c7", name: "esp32-sensor", type: "wireless", ip: "192.168.1.101", mac: "52:54:00:b1:67:aa", ssid: "Home-IoT", band: "2.4 ГГц", rxMbps: 0.02, txMbps: 0.05, peakMbps: 0.3, signal: -71, uptime: "11д 2ч", packets: 1_204, errors: 0 },
  { id: "c8", name: "smart-tv", type: "wireless", ip: "192.168.1.50", mac: "64:db:8b:03:77:10", ssid: "Home-5G", band: "5 ГГц", rxMbps: 3.2, txMbps: 0.8, peakMbps: 22.1, signal: -61, uptime: "4ч 6м", packets: 38_110, errors: 1 },
  { id: "c9", name: "printer", type: "wired", ip: "192.168.1.40", mac: "3c:52:82:aa:12:09", ssid: "Home-LAN", band: "LAN", rxMbps: 0.6, txMbps: 0.2, peakMbps: 2.4, signal: null, uptime: "52д 1ч", packets: 9_882, errors: 0 },
  { id: "c10", name: "thermostat", type: "wireless", ip: "192.168.1.102", mac: "b0:4a:39:6c:88:de", ssid: "Home-IoT", band: "2.4 ГГц", rxMbps: 0.01, txMbps: 0.03, peakMbps: 0.1, signal: -74, uptime: "21д 9ч", packets: 682, errors: 0 },
]

const sumAll = rawClients.reduce((s, c) => s + c.rxMbps + c.txMbps, 0)

export const demoTopClients: TopClient[] = rawClients
  .map((c) => {
    const totalMbps = c.rxMbps + c.txMbps
    return { ...c, totalMbps, share: (totalMbps / sumAll) * 100 }
  })
  .sort((a, b) => b.totalMbps - a.totalMbps)

export const demoLoadHistory: LoadPoint[] = [
  { time: "14:10", rx: 42, tx: 18 },
  { time: "14:15", rx: 55, tx: 22 },
  { time: "14:20", rx: 68, tx: 29 },
  { time: "14:25", rx: 61, tx: 25 },
  { time: "14:30", rx: 74, tx: 33 },
  { time: "14:35", rx: 89, tx: 41 },
  { time: "14:40", rx: 78, tx: 36 },
  { time: "14:45", rx: 95, tx: 44 },
  { time: "14:50", rx: 83, tx: 38 },
  { time: "14:55", rx: 71, tx: 31 },
  { time: "15:00", rx: 88, tx: 40 },
  { time: "15:05", rx: 79, tx: 35 },
]

export const demoBandLoad = [
  { name: "LAN", rx: 83.7, tx: 36, clients: 4, color: "var(--chart-1)" },
  { name: "5 ГГц", rx: 43.2, tx: 13.7, clients: 3, color: "var(--chart-2)" },
  { name: "2.4 ГГц", rx: 4.73, tx: 1.98, clients: 3, color: "var(--chart-3)" },
]

export const demoInterfaceLoad = [
  { name: "GigabitEthernet0/0/0", rx: 95.0, tx: 44.0, errors: 0, utilization: 12.4 },
  { name: "Vlanif1", rx: 83.7, tx: 36.0, errors: 0, utilization: 8.3 },
  { name: "Wlan-Default", rx: 47.9, tx: 15.7, errors: 3, utilization: 6.1 },
  { name: "GE0/0/2", rx: 0, tx: 0, errors: 0, utilization: 0 },
]
