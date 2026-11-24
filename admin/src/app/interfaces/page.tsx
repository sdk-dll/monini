"use client"

import * as React from "react"
import { ArrowDownUpIcon, NetworkIcon, RouterIcon, WaypointsIcon } from "lucide-react"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ErrorBanner, WaitingBanner } from "@/components/dashboard/states"
import { StatCard } from "@/components/dashboard/stat-card"
import { StatusDot, UtilBar, formatBps, isUp } from "@/components/dashboard/status"
import { useSnapshot } from "@/components/dashboard/use-snapshot"
import type { RawInterface, RawIpInterface, RawRoute, RawArp } from "@/lib/snapshot"
import {
  ALL,
  FilterSelect,
  Pagination,
  SearchInput,
  TableToolbar,
  usePagination,
} from "@/components/dashboard/table-tools"

export default function InterfacesPage() {
  const { snapshot, ready } = useSnapshot()
  const interfaces = snapshot.interfaces ?? []
  const ipInterfaces = snapshot.ip_interfaces ?? []
  const routes = snapshot.routes ?? []
  const arp = snapshot.arp ?? []
  const wan = snapshot.wan ?? null

  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "Интерфейсы" }]} />
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Интерфейсы</h1>
          <p className="text-sm text-muted-foreground">
            Из <code className="font-mono">display interface brief</code>, IP- и маршрутных таблиц
          </p>
        </div>

        <ErrorBanner />
        <WaitingBanner />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Активные порты"
            value={ready ? `${interfaces.filter((i) => isUp(i.phys)).length} / ${interfaces.length}` : null}
            hint="физическое состояние"
            icon={NetworkIcon}
            tone="good"
            loading={!ready}
          />
          <StatCard
            title="WAN-приём"
            value={wan ? formatBps(wan.in_bps) : null}
            hint={`${wan?.iface ?? "WAN"} · ${wan?.state ?? "—"}`}
            icon={ArrowDownUpIcon}
            loading={!ready}
          />
          <StatCard
            title="Маршруты"
            value={ready ? String(routes.length) : null}
            hint="в таблице маршрутизации"
            icon={RouterIcon}
            loading={!ready}
          />
          <StatCard
            title="ARP"
            value={ready ? String(arp.length) : null}
            hint="записей в таблице"
            icon={WaypointsIcon}
            loading={!ready}
          />
        </div>

        <Tabs defaultValue="interfaces">
          <TabsList>
            <TabsTrigger value="interfaces">Интерфейсы</TabsTrigger>
            <TabsTrigger value="routes">Маршруты</TabsTrigger>
            <TabsTrigger value="arp">ARP</TabsTrigger>
          </TabsList>
          <TabsContent value="interfaces" className="flex flex-col gap-4 pt-4">
            <InterfacesCards interfaces={interfaces} ipInterfaces={ipInterfaces} />
          </TabsContent>
          <TabsContent value="routes" className="pt-4">
            <RoutesCard routes={routes} />
          </TabsContent>
          <TabsContent value="arp" className="pt-4">
            <ArpCard arp={arp} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function InterfacesCards({
  interfaces,
  ipInterfaces,
}: {
  interfaces: RawInterface[]
  ipInterfaces: RawIpInterface[]
}) {
  const rows = interfaces ?? []
  const [query, setQuery] = React.useState("")
  const [state, setState] = React.useState(ALL)
  const [pageSize, setPageSize] = React.useState(10)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((i) => {
      if (state === "up" && !isUp(i.phys)) return false
      if (state === "down" && isUp(i.phys)) return false
      if (q && !`${i.name} ${i.proto}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, query, state])

  const pager = usePagination(filtered, pageSize)
  const ipByName = new Map(ipInterfaces.map((i) => [i.name, i.ip]))

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Интерфейсы</CardTitle>
          <CardDescription>
            {filtered.length === rows.length ? `${rows.length} портов` : `${filtered.length} из ${rows.length}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <TableToolbar>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Имя или протокол…"
              className="w-full sm:w-64"
            />
            <FilterSelect
              value={state}
              onChange={setState}
              label="Состояние"
              options={[
                { value: ALL, label: "Все" },
                { value: "up", label: "Подняты" },
                { value: "down", label: "Отключены" },
              ]}
            />
          </TableToolbar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Интерфейс</TableHead>
                <TableHead>Состояние</TableHead>
                <TableHead className="hidden md:table-cell">Вход</TableHead>
                <TableHead className="hidden md:table-cell">Выход</TableHead>
                <TableHead className="text-right">IP-адрес</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pager.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {rows.length === 0 ? "Нет данных об интерфейсах" : "Ничего не найдено"}
                  </TableCell>
                </TableRow>
              ) : (
                pager.items.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.proto}</div>
                    </TableCell>
                    <TableCell>
                      <StatusDot value={row.phys} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <UtilBar value={row.inutil} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <UtilBar value={row.oututil} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {ipByName.get(row.name) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            total={pager.total}
            pageSize={pageSize}
            onPage={pager.setPage}
            onPageSize={setPageSize}
            pageSizeOptions={[10, 25, 50]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IP-интерфейсы</CardTitle>
          <CardDescription>Адреса управления и внешнего канала</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Состояние</TableHead>
                <TableHead className="text-right">Протокол</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ipInterfaces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Нет IP-интерфейсов
                  </TableCell>
                </TableRow>
              ) : (
                ipInterfaces.map((iface) => (
                  <TableRow key={iface.name}>
                    <TableCell className="font-medium">{iface.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {iface.ip === "unassigned" ? "—" : iface.ip}
                    </TableCell>
                    <TableCell>
                      <StatusDot value={iface.phys} />
                    </TableCell>
                    <TableCell className="text-right text-xs">{iface.proto}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

function RoutesCard({ routes }: { routes: RawRoute[] }) {
  const [query, setQuery] = React.useState("")
  const [proto, setProto] = React.useState(ALL)
  const [pageSize, setPageSize] = React.useState(10)

  const protos = React.useMemo(() => [...new Set(routes.map((r) => r.proto))].sort(), [routes])
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return routes.filter((r) => {
      if (proto !== ALL && r.proto !== proto) return false
      if (q && !`${r.destination} ${r.next_hop} ${r.iface}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [routes, query, proto])

  const pager = usePagination(filtered, pageSize)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Таблица маршрутов</CardTitle>
        <CardDescription>
          {filtered.length === routes.length ? `${routes.length} маршрутов` : `${filtered.length} из ${routes.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableToolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Назначение, шлюз или интерфейс…"
            className="w-full sm:w-72"
          />
          <FilterSelect
            value={proto}
            onChange={setProto}
            label="Протокол"
            options={[{ value: ALL, label: "Все" }, ...protos.map((p) => ({ value: p, label: p }))]}
          />
        </TableToolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Назначение</TableHead>
              <TableHead>Шлюз</TableHead>
              <TableHead>Интерфейс</TableHead>
              <TableHead className="text-right">Тип</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {routes.length === 0 ? "Нет маршрутов" : "Ничего не найдено"}
                </TableCell>
              </TableRow>
            ) : (
              pager.items.map((route) => (
                <TableRow key={`${route.destination}-${route.next_hop}`}>
                  <TableCell className="font-mono text-xs">{route.destination}</TableCell>
                  <TableCell className="font-mono text-xs">{route.next_hop}</TableCell>
                  <TableCell className="text-xs">{route.iface}</TableCell>
                  <TableCell className="text-right text-xs">
                    {route.proto === "Static" ? "статический" : "прямой"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pageSize}
          onPage={pager.setPage}
          onPageSize={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </CardContent>
    </Card>
  )
}

function ArpCard({ arp }: { arp: RawArp[] }) {
  const [query, setQuery] = React.useState("")
  const [type, setType] = React.useState(ALL)
  const [pageSize, setPageSize] = React.useState(25)

  const types = React.useMemo(() => [...new Set(arp.map((a) => a.type ?? "unknown"))].sort(), [arp])
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return arp.filter((a) => {
      if (type !== ALL && (a.type ?? "unknown") !== type) return false
      if (q && !`${a.ip} ${a.mac} ${a.iface}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [arp, query, type])

  const pager = usePagination(filtered, pageSize)

  return (
    <Card>
      <CardHeader>
        <CardTitle>ARP-таблица</CardTitle>
        <CardDescription>
          {filtered.length === arp.length ? `${arp.length} записей` : `${filtered.length} из ${arp.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableToolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="IP, MAC или интерфейс…"
            className="w-full sm:w-72"
          />
          <FilterSelect
            value={type}
            onChange={setType}
            label="Тип"
            options={[
              { value: ALL, label: "Все" },
              ...types.map((t) => ({
                value: t,
                label: t === "static" ? "статическая" : t === "dynamic" ? "динамическая" : t,
              })),
            ]}
          />
        </TableToolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP-адрес</TableHead>
              <TableHead>MAC</TableHead>
              <TableHead className="hidden md:table-cell">Интерфейс</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead className="text-right">Истекает</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {arp.length === 0 ? "ARP-таблица пуста" : "Ничего не найдено"}
                </TableCell>
              </TableRow>
            ) : (
              pager.items.map((entry) => (
                <TableRow key={entry.ip}>
                  <TableCell className="font-mono text-xs">{entry.ip}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.mac}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{entry.iface}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {entry.type === "static" ? "статическая" : "динамическая"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {entry.expire ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pageSize}
          onPage={pager.setPage}
          onPageSize={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </CardContent>
    </Card>
  )
}
