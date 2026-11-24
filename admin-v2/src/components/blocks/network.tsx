"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowRightLeft,
  Cable,
  CircleDot,
  EthernetPort,
  Globe2,
  Layers,
  Link2,
  RefreshCw,
  Route,
  Table2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type Column } from "@/components/blocks/data-table"
import { api } from "@/lib/api"
import type { Interface, IpInterface, Route as RouteRow, ArpEntry, MacEntry, Snapshot } from "@/lib/types"
import { useSelectedDevice } from "@/components/providers/devices-provider"
import { cn, formatBps } from "@/lib/utils"

type Payload = {
  interfaces: Snapshot["interfaces"]
  ip_interfaces: Snapshot["ip_interfaces"]
  routes: Snapshot["routes"]
  arp: Snapshot["arp"]
  mac_table: Snapshot["mac_table"]
  lldp: Snapshot["lldp"]
  vlans: Snapshot["vlans"]
  pools: Snapshot["pools"]
  wan?: Snapshot["wan"]
  lan?: Snapshot["lan"]
}

export function NetworkPage({ tab = "interfaces" }: { tab?: "interfaces" | "routes" | "mac" | "vlans" }) {
  const device = useSelectedDevice()
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!device) return
    setLoading(true)
    try {
      const [iface, net] = await Promise.all([api.interfaces(device.id), api.network(device.id)])
      setData({ ...iface, ...net })
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [device])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Network</h1>
          <p className="text-sm text-muted-foreground">Interfaces, routing, neighbors and VLANs from the latest snapshot.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      <Tabs value={tab}>
        <TabsList>
          {([
            ["interfaces", "Interfaces", Cable],
            ["routes", "Routes & ARP", Route],
            ["mac", "MAC / LLDP", Link2],
            ["vlans", "VLANs", Layers],
          ] as const).map(([value, label, Icon]) => (
            <TabsTrigger key={value} value={value} asChild>
              <a href={`/network/${value}`} className="flex items-center gap-1.5"><Icon className="size-3.5" /> {label}</a>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading network data…</p> : null}

      {data && !loading ? (
        <div className="flex flex-col gap-5">
          {tab === "interfaces" ? <Interfaces data={data} /> : null}
          {tab === "routes" ? <Routes data={data} /> : null}
          {tab === "mac" ? <MacTable data={data} /> : null}
          {tab === "vlans" ? <Vlans data={data} /> : null}
        </div>
      ) : null}
    </div>
  )
}

function StateBadge({ value }: { value?: string }) {
  const up = value === "up"
  return (
    <Badge variant="outline" className={cn("gap-1", up ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700")}>
      <CircleDot className="size-3" /> {value ?? "—"}
    </Badge>
  )
}

function Interfaces({ data }: { data: Payload }) {
  const ifaceCols: Column<Interface>[] = [
    { key: "name", header: "Name", value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span>, filter: true },
    { key: "phys", header: "Phys", value: (r) => r.phys, cell: (r) => <StateBadge value={r.phys} />, filter: true },
    { key: "proto", header: "Proto", value: (r) => r.proto, cell: (r) => <StateBadge value={r.proto} />, filter: true },
    { key: "inutil", header: "In util", value: (r) => r.inutil, cell: (r) => <span className="tabular-nums">{r.inutil ?? "—"}%</span>, className: "text-right" },
    { key: "oututil", header: "Out util", value: (r) => r.oututil, cell: (r) => <span className="tabular-nums">{r.oututil ?? "—"}%</span>, className: "text-right" },
  ]
  const ipCols: Column<IpInterface>[] = [
    { key: "name", header: "Name", value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span>, filter: true },
    { key: "ip", header: "Address", value: (r) => r.ip, cell: (r) => <span className="font-mono text-xs">{r.ip}</span> },
    { key: "phys", header: "Status", value: (r) => r.phys, cell: (r) => <StateBadge value={r.phys} />, filter: true },
  ]

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><EthernetPort className="size-4" /> Physical interfaces</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              rows={data.interfaces ?? []}
              columns={ifaceCols}
              getRowKey={(r, i) => `${r.name}-${i}`}
              searchPlaceholder="Search interfaces…"
              pageSize={10}
              emptyMessage="No interfaces in snapshot"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Globe2 className="size-4" /> IP interfaces</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              rows={data.ip_interfaces ?? []}
              columns={ipCols}
              getRowKey={(r, i) => `${r.name}-${i}`}
              searchPlaceholder="Search IP interfaces…"
              pageSize={10}
              emptyMessage="No IP interfaces in snapshot"
            />
          </CardContent>
        </Card>
      </div>
      {data.wan ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">WAN · {data.wan.iface}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Info label="State" value={String(data.wan.state ?? "—")} />
            <Info label="Line protocol" value={String(data.wan.line_protocol ?? "—")} />
            <Info label="Speed" value={String(data.wan.speed ?? "—")} />
            <Info label="Duplex" value={String(data.wan.duplex ?? "—")} />
            <Info label="Input" value={formatBps(data.wan.in_bps)} />
            <Info label="Output" value={formatBps(data.wan.out_bps)} />
            <Info label="RX errors" value={String(data.wan.rx_errors ?? 0)} />
            <Info label="TX errors" value={String(data.wan.tx_errors ?? 0)} />
            <Info label="MAC" value={String(data.wan.mac ?? "—")} />
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}

function Routes({ data }: { data: Payload }) {
  const routeCols: Column<RouteRow>[] = [
    { key: "destination", header: "Destination", value: (r) => r.destination, cell: (r) => <span className="font-mono text-xs font-medium">{r.destination}</span> },
    { key: "proto", header: "Proto", value: (r) => r.proto, filter: true },
    { key: "pref", header: "Pref", value: (r) => r.pref, className: "tabular-nums" },
    { key: "cost", header: "Cost", value: (r) => r.cost, className: "tabular-nums" },
    { key: "next_hop", header: "Next hop", value: (r) => r.next_hop, cell: (r) => <span className="font-mono text-xs">{r.next_hop}</span> },
    { key: "iface", header: "Interface", value: (r) => r.iface, filter: true },
  ]
  const arpCols: Column<ArpEntry>[] = [
    { key: "ip", header: "IP", value: (r) => r.ip, cell: (r) => <span className="font-mono text-xs font-medium">{r.ip}</span> },
    { key: "mac", header: "MAC", value: (r) => r.mac, cell: (r) => <span className="font-mono text-xs">{r.mac}</span> },
    { key: "iface", header: "Interface", value: (r) => r.iface, filter: true },
    { key: "type", header: "Type", value: (r) => r.type, filter: true },
    { key: "expire", header: "Expire", value: (r) => r.expire, className: "tabular-nums" },
  ]
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Route className="size-4" /> Routing table</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={data.routes ?? []} columns={routeCols} getRowKey={(r, i) => `${r.destination}-${i}`} searchPlaceholder="Search routes…" emptyMessage="No routes in snapshot" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ArrowRightLeft className="size-4" /> ARP table</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={data.arp ?? []} columns={arpCols} getRowKey={(r, i) => `${r.ip}-${i}`} searchPlaceholder="Search ARP entries…" emptyMessage="No ARP entries in snapshot" />
        </CardContent>
      </Card>
    </div>
  )
}

function MacTable({ data }: { data: Payload }) {
  const macCols: Column<MacEntry>[] = [
    { key: "mac", header: "MAC", value: (r) => r.mac, cell: (r) => <span className="font-mono text-xs font-medium">{r.mac}</span> },
    { key: "vlan", header: "VLAN", value: (r) => r.vlan, className: "tabular-nums", filter: true },
    { key: "port", header: "Port", value: (r) => r.port, filter: true },
    { key: "type", header: "Type", value: (r) => r.type, filter: true },
  ]
  const lldpRows = data.lldp ?? []
  const lldpCols: Column<(typeof lldpRows)[number]>[] = [
    { key: "local", header: "Local port", value: (r) => r.local },
    { key: "neighbor", header: "Neighbor", value: (r) => r.neighbor, cell: (r) => <span className="font-medium">{r.neighbor}</span> },
    { key: "port", header: "Port", value: (r) => r.port },
    { key: "ttl", header: "TTL", value: (r) => r.ttl, className: "tabular-nums" },
  ]
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Table2 className="size-4" /> MAC address table</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={data.mac_table ?? []} columns={macCols} getRowKey={(r, i) => `${r.mac}-${i}`} searchPlaceholder="Search MAC addresses…" emptyMessage="No MAC entries in snapshot" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Link2 className="size-4" /> LLDP neighbors</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={lldpRows} columns={lldpCols} getRowKey={(r, i) => `${r.local}-${i}`} searchPlaceholder="Search neighbors…" emptyMessage="No LLDP neighbors" />
        </CardContent>
      </Card>
    </div>
  )
}

function Vlans({ data }: { data: Payload }) {
  const rows = data.vlans ?? []
  const cols: Column<(typeof rows)[number]>[] = [
    { key: "id", header: "ID", value: (r) => r.id, className: "font-medium tabular-nums" },
    { key: "type", header: "Type", value: (r) => r.type, filter: true },
    { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <StateBadge value={r.status} />, filter: true },
  ]
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Layers className="size-4" /> VLANs</CardTitle></CardHeader>
      <CardContent>
        <DataTable rows={rows} columns={cols} getRowKey={(r, i) => `${r.id}-${i}`} searchPlaceholder="Search VLANs…" emptyMessage="No VLANs in snapshot" />
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg border p-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  )
}
