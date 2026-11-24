"use client"

import * as React from "react"
import { LaptopIcon, RouterIcon, SignalIcon, WifiIcon } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatCard } from "@/components/dashboard/stat-card"
import { ErrorBanner, WaitingBanner } from "@/components/dashboard/states"
import { Skeleton } from "@/components/ui/skeleton"
import { useSnapshot } from "@/components/dashboard/use-snapshot"
import {
  ALL,
  FilterSelect,
  Pagination,
  SearchInput,
  TableToolbar,
  usePagination,
} from "@/components/dashboard/table-tools"
import type { RawMac } from "@/lib/snapshot"

function useFilteredMacs() {
  const { snapshot } = useSnapshot()
  const macs = snapshot.mac_table ?? []
  const [query, setQuery] = React.useState("")
  const [vlan, setVlan] = React.useState(ALL)
  const [port, setPort] = React.useState(ALL)
  const [type, setType] = React.useState(ALL)

  const vlans = React.useMemo(
    () => [...new Set(macs.map((m) => String(m.vlan)))].sort((a, b) => Number(a) - Number(b)),
    [macs]
  )
  const ports = React.useMemo(() => [...new Set(macs.map((m) => m.port))].sort(), [macs])
  const types = React.useMemo(() => [...new Set(macs.map((m) => m.type))].sort(), [macs])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return macs.filter((m) => {
      if (vlan !== ALL && String(m.vlan) !== vlan) return false
      if (port !== ALL && m.port !== port) return false
      if (type !== ALL && m.type !== type) return false
      if (q && !`${m.mac} ${m.port} ${m.vlan} ${m.type}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [macs, query, vlan, port, type])

  const reset = () => {
    setQuery("")
    setVlan(ALL)
    setPort(ALL)
    setType(ALL)
  }

  return {
    all: macs,
    filtered,
    query,
    setQuery,
    vlan,
    setVlan,
    port,
    setPort,
    type,
    setType,
    vlans,
    ports,
    types,
    reset,
  }
}

function MacTable() {
  const { snapshot } = useSnapshot()
  const f = useFilteredMacs()
  const [pageSize, setPageSize] = React.useState(25)
  const pager = usePagination(f.filtered, pageSize)

  return (
    <Card>
      <CardHeader>
        <CardTitle>MAC-адреса</CardTitle>
        <CardDescription>
          {f.filtered.length === f.all.length
            ? `${f.all.length} записей`
            : `${f.filtered.length} из ${f.all.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableToolbar>
          <SearchInput
            value={f.query}
            onChange={f.setQuery}
            placeholder="MAC, порт или VLAN…"
            className="w-full sm:w-64"
          />
          <FilterSelect
            value={f.vlan}
            onChange={f.setVlan}
            label="VLAN"
            options={[{ value: ALL, label: "Все" }, ...f.vlans.map((v) => ({ value: v, label: v }))]}
          />
          <FilterSelect
            value={f.port}
            onChange={f.setPort}
            label="Порт"
            options={[{ value: ALL, label: "Все" }, ...f.ports.map((p) => ({ value: p, label: p }))]}
            className="max-w-56"
          />
          <FilterSelect
            value={f.type}
            onChange={f.setType}
            label="Тип"
            options={[{ value: ALL, label: "Все" }, ...f.types.map((t) => ({ value: t, label: t }))]}
          />
          {(f.query || f.vlan !== ALL || f.port !== ALL || f.type !== ALL) && (
            <button
              type="button"
              onClick={f.reset}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Сбросить фильтры
            </button>
          )}
        </TableToolbar>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MAC</TableHead>
              <TableHead>VLAN</TableHead>
              <TableHead>Порт</TableHead>
              <TableHead className="text-right">Тип</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.ts === 0 && pager.items.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pager.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {f.all.length === 0 ? "Нет записей MAC-таблицы" : "Ничего не найдено"}
                </TableCell>
              </TableRow>
            ) : (
              pager.items.map((row) => (
                <TableRow key={`${row.mac}-${row.vlan}-${row.port}`}>
                  <TableCell className="font-mono text-xs">{row.mac}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {row.vlan}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.port}</TableCell>
                  <TableCell className="text-right">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{row.type}</span>
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
        />
      </CardContent>
    </Card>
  )
}

function PoolTable() {
  const { snapshot } = useSnapshot()
  const pools = snapshot.pools ?? []
  const [query, setQuery] = React.useState("")
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pools
    return pools.filter((p) =>
      `${p.name} ${p.network ?? ""} ${p.gateway ?? ""}`.toLowerCase().includes(q)
    )
  }, [pools, query])

  return (
    <Card>
      <CardHeader>
        <CardTitle>DHCP-пулы</CardTitle>
        <CardDescription>Занятость адресов</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableToolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Имя пула или сеть…"
            className="w-full sm:w-64"
          />
        </TableToolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Пул</TableHead>
              <TableHead className="hidden md:table-cell">Сеть</TableHead>
              <TableHead className="hidden md:table-cell">Шлюз</TableHead>
              <TableHead>Занято</TableHead>
              <TableHead className="text-right">Свободно</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {pools.length === 0 ? "Пулы не найдены" : "Ничего не найдено"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((pool) => {
                const total = pool.total ?? (pool.used ?? 0) + (pool.idle ?? 0)
                const used = pool.used ?? 0
                return (
                  <TableRow key={pool.name}>
                    <TableCell className="font-medium">{pool.name}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {pool.network ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {pool.gateway ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-[var(--chart-1)]"
                            style={{ width: `${total ? (used / total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs">
                          {used} / {total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {pool.idle ?? total - used}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function LldpTable() {
  const { snapshot } = useSnapshot()
  const lldp = snapshot.lldp ?? []
  const [query, setQuery] = React.useState("")
  const [pageSize, setPageSize] = React.useState(25)
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return lldp
    return lldp.filter((n) => JSON.stringify(n).toLowerCase().includes(q))
  }, [lldp, query])
  const pager = usePagination(filtered, pageSize)

  const columns = React.useMemo(() => {
    const keys = new Set<string>()
    for (const row of lldp) for (const key of Object.keys(row)) keys.add(key)
    return [...keys].slice(0, 6)
  }, [lldp])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Соседи LLDP</CardTitle>
        <CardDescription>{lldp.length} устройств рядом</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TableToolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Имя, порт, модель…"
            className="w-full sm:w-64"
          />
        </TableToolbar>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length || 1} className="py-8 text-center text-muted-foreground">
                  {lldp.length === 0 ? "Соседи не найдены" : "Ничего не найдено"}
                </TableCell>
              </TableRow>
            ) : (
              pager.items.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c} className="font-mono text-xs">
                      {String(row[c] ?? "—")}
                    </TableCell>
                  ))}
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
        />
      </CardContent>
    </Card>
  )
}

export default function ClientsPage() {
  const { snapshot, ready } = useSnapshot()
  const macs: RawMac[] = snapshot.mac_table ?? []
  const pools = snapshot.pools ?? []
  const lldp = snapshot.lldp ?? []
  const dhcpUsed = snapshot.summary?.dhcp_used ?? pools.reduce((s, p) => s + (p.used ?? 0), 0)

  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "Клиенты" }]} />
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Клиенты</h1>
          <p className="text-sm text-muted-foreground">
            MAC-таблица, DHCP-пулы и соседи LLDP
          </p>
        </div>

        <ErrorBanner />
        <WaitingBanner />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="В MAC-таблице"
            value={ready ? String(snapshot.mac_total ?? macs.length) : null}
            hint={`${macs.length} загружено`}
            icon={LaptopIcon}
            tone="good"
            loading={!ready}
          />
          <StatCard
            title="DHCP занято"
            value={ready ? String(dhcpUsed) : null}
            hint="адресов выдано"
            icon={WifiIcon}
            loading={!ready}
          />
          <StatCard
            title="DHCP-пулы"
            value={ready ? String(pools.length) : null}
            hint="настроено"
            icon={SignalIcon}
            loading={!ready}
          />
          <StatCard
            title="Соседи LLDP"
            value={ready ? String(lldp.length) : null}
            hint="устройства рядом"
            icon={RouterIcon}
            loading={!ready}
          />
        </div>

        <Tabs defaultValue="mac">
          <TabsList>
            <TabsTrigger value="mac">MAC-таблица</TabsTrigger>
            <TabsTrigger value="dhcp">DHCP</TabsTrigger>
            <TabsTrigger value="lldp">LLDP</TabsTrigger>
          </TabsList>
          <TabsContent value="mac" className="pt-4">
            <MacTable />
          </TabsContent>
          <TabsContent value="dhcp" className="pt-4">
            <PoolTable />
          </TabsContent>
          <TabsContent value="lldp" className="pt-4">
            <LldpTable />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
