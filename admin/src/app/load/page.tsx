"use client"

import * as React from "react"
import {
  ActivityIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  CpuIcon,
  FlameIcon,
  InfoIcon,
  NetworkIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { StatCard } from "@/components/dashboard/stat-card"
import {
  ALL,
  FilterSelect,
  Pagination,
  SearchInput,
  TableToolbar,
  usePagination,
} from "@/components/dashboard/table-tools"
import {
  demoBandLoad,
  demoInterfaceLoad,
  demoLoadHistory,
  demoTopClients,
  type TopClient,
} from "@/lib/demo-load"

function fmtMbps(v: number) {
  if (v >= 100) return `${v.toFixed(0)} Мбит/с`
  if (v >= 10) return `${v.toFixed(1)} Мбит/с`
  if (v >= 0.1) return `${v.toFixed(2)} Мбит/с`
  return `${(v * 1000).toFixed(0)} Кбит/с`
}

function typeLabel(t: TopClient["type"]) {
  return t === "wired" ? "проводной" : t === "guest" ? "гость" : "Wi-Fi"
}

function ClientDrawer({ client, onClose }: { client: TopClient; onClose: () => void }) {
  const rxShare = client.totalMbps ? (client.rxMbps / client.totalMbps) * 100 : 0
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-background h-full w-full max-w-lg overflow-y-auto border-l p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{client.name}</h2>
            <p className="font-mono text-xs text-muted-foreground">{client.mac}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard title="Всего" value={fmtMbps(client.totalMbps)} hint="сейчас" icon={FlameIcon} tone="warn" />
          <StatCard title="Приём" value={fmtMbps(client.rxMbps)} hint={`${rxShare.toFixed(0)}% потока`} icon={ArrowDownRightIcon} />
          <StatCard title="Отдача" value={fmtMbps(client.txMbps)} hint="в сеть" icon={ArrowUpRightIcon} />
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Детали</CardTitle>
            <CardDescription>Вся доступная информация по клиенту</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {[
              ["IP-адрес", client.ip],
              ["Тип", typeLabel(client.type)],
              ["Сеть", client.ssid],
              ["Диапазон", client.band],
              ["Пик", fmtMbps(client.peakMbps)],
              ["Сигнал", client.signal === null ? "—" : `${client.signal} дБм`],
              ["В сети", client.uptime],
              ["Пакетов", client.packets.toLocaleString("ru-RU")],
              ["Ошибок", String(client.errors)],
              ["Доля трафика", `${client.share.toFixed(1)}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b py-1.5 last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-right font-medium">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Профиль нагрузки</CardTitle>
            <CardDescription>Доля в общем трафике</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span>Приём</span>
              <span className="tabular-nums text-muted-foreground">{rxShare.toFixed(1)}%</span>
            </div>
            <Progress value={rxShare} />
            <p className="mt-2 text-xs text-muted-foreground">
              Пик {fmtMbps(client.peakMbps)} — {(client.peakMbps / (client.totalMbps || 1)).toFixed(1)}× от текущего
              значения. У {(client.signal ?? 0) < -65 && client.type !== "wired" ? "слабом сигнале" : "текущем сигнале"}
              {" "}стоит проверить стабильность соединения, если появятся ошибки.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoadPage() {
  const [query, setQuery] = React.useState("")
  const [type, setType] = React.useState(ALL)
  const [sortBy, setSortBy] = React.useState("total")
  const [pageSize, setPageSize] = React.useState(10)
  const [selected, setSelected] = React.useState<TopClient | null>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let items = demoTopClients.filter((c) => {
      if (type !== ALL && c.type !== type) return false
      if (q && !`${c.name} ${c.ip} ${c.mac} ${c.ssid}`.toLowerCase().includes(q)) return false
      return true
    })
    items = [...items].sort((a, b) => {
      if (sortBy === "rx") return b.rxMbps - a.rxMbps
      if (sortBy === "tx") return b.txMbps - a.txMbps
      if (sortBy === "peak") return b.peakMbps - a.peakMbps
      return b.totalMbps - a.totalMbps
    })
    return items
  }, [query, type, sortBy])

  const pager = usePagination(filtered, pageSize)
  const totalRx = demoTopClients.reduce((s, c) => s + c.rxMbps, 0)
  const totalTx = demoTopClients.reduce((s, c) => s + c.txMbps, 0)
  const leader = demoTopClients[0]
  const chartData = demoLoadHistory.map((p) => ({ ...p }))

  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "Нагрузка" }]} />
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Нагрузка</h1>
            <p className="text-sm text-muted-foreground">
              Кто больше всего грузит сеть: рейтинг клиентов, пики и распределение
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            <InfoIcon className="size-3.5" />
            демо-данные · SSH недоступен
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Лидер" value={leader.name} hint={`${leader.share.toFixed(1)}% всего трафика`} icon={TrophyIcon} tone="warn" />
          <StatCard title="Суммарный приём" value={fmtMbps(totalRx)} hint="по всем клиентам" icon={ArrowDownRightIcon} tone="good" />
          <StatCard title="Суммарная отдача" value={fmtMbps(totalTx)} hint="по всем клиентам" icon={ArrowUpRightIcon} />
          <StatCard title="Клиентов" value={String(demoTopClients.length)} hint="в рейтинге" icon={UsersIcon} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Трафик по времени</CardTitle>
              <CardDescription>Приём и отдача всех клиентов</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="loadRx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="loadTx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={40} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #333", borderRadius: 8 }} />
                    <Area dataKey="rx" type="monotone" name="Приём" fill="url(#loadRx)" stroke="var(--chart-1)" strokeWidth={2} />
                    <Area dataKey="tx" type="monotone" name="Отдача" fill="url(#loadTx)" stroke="var(--chart-2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Нагрузка по сетям</CardTitle>
              <CardDescription>Мбит/с и число клиентов</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demoBandLoad} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={32} />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{ background: "#18181b", border: "1px solid #333", borderRadius: 8 }}
                    />
                    <Bar dataKey="rx" name="Приём" radius={[4, 4, 0, 0]}>
                      {demoBandLoad.map((b) => (
                        <Cell key={b.name} fill={b.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Рейтинг клиентов</CardTitle>
            <CardDescription>
              {filtered.length === demoTopClients.length
                ? `${demoTopClients.length} клиентов`
                : `${filtered.length} из ${demoTopClients.length}`}{" "}
              · нажмите на строку для деталей
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <TableToolbar>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Имя, IP, MAC или сеть…"
                className="w-full sm:w-72"
              />
              <FilterSelect
                value={type}
                onChange={setType}
                label="Тип"
                options={[
                  { value: ALL, label: "Все" },
                  { value: "wireless", label: "Wi-Fi" },
                  { value: "wired", label: "Проводные" },
                  { value: "guest", label: "Гости" },
                ]}
              />
              <FilterSelect
                value={sortBy}
                onChange={setSortBy}
                label="Сортировка"
                options={[
                  { value: "total", label: "По сумме" },
                  { value: "rx", label: "По приёму" },
                  { value: "tx", label: "По отдаче" },
                  { value: "peak", label: "По пику" },
                ]}
              />
            </TableToolbar>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Сеть</TableHead>
                    <TableHead>Приём</TableHead>
                    <TableHead>Отдача</TableHead>
                    <TableHead>Всего</TableHead>
                    <TableHead>Пик</TableHead>
                    <TableHead className="hidden lg:table-cell">Доля</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        Ничего не найдено
                      </TableCell>
                    </TableRow>
                  ) : (
                    pager.items.map((c, i) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {(pager.page - 1) * pageSize + i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {i === 0 && sortBy === "total" ? (
                              <FlameIcon className="size-4 text-amber-500" />
                            ) : (
                              <ActivityIcon className="size-4 text-muted-foreground" />
                            )}
                            <div>
                              <div className="font-medium">{c.name}</div>
                              <div className="font-mono text-xs text-muted-foreground">{c.ip}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.ssid}
                          <div className="text-xs text-muted-foreground">{c.band}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <ArrowDownRightIcon className="size-3 text-[var(--chart-1)]" />
                            {fmtMbps(c.rxMbps)}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpRightIcon className="size-3 text-[var(--chart-2)]" />
                            {fmtMbps(c.txMbps)}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">{fmtMbps(c.totalMbps)}</TableCell>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {fmtMbps(c.peakMbps)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                              <div
                                className="h-full rounded-full bg-[var(--chart-3)]"
                                style={{ width: `${Math.min(c.share, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {c.share.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChevronRightIcon className="size-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

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

        <Card>
          <CardHeader>
            <CardTitle>Интерфейсы и ошибки</CardTitle>
            <CardDescription>Сравнение нагрузки и потерь</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Интерфейс</TableHead>
                  <TableHead>Приём</TableHead>
                  <TableHead>Отдача</TableHead>
                  <TableHead>Утилизация</TableHead>
                  <TableHead className="text-right">Ошибки</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoInterfaceLoad.map((i) => (
                  <TableRow key={i.name}>
                    <TableCell className="flex items-center gap-2 font-medium">
                      <NetworkIcon className="size-4 text-muted-foreground" />
                      <span className="font-mono text-xs">{i.name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{fmtMbps(i.rx)}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{fmtMbps(i.tx)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-[var(--chart-1)]"
                            style={{ width: `${i.utilization}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{i.utilization}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {i.errors > 0 ? (
                        <Badge variant="destructive">{i.errors}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {selected && <ClientDrawer client={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
