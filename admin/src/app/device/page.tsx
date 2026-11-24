"use client"

import * as React from "react"

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
import { Progress } from "@/components/ui/progress"
import { CpuChart } from "@/components/dashboard/cpu-chart"
import { ErrorBanner, WaitingBanner } from "@/components/dashboard/states"
import { Skeleton } from "@/components/ui/skeleton"
import { formatBytesMb } from "@/components/dashboard/status"
import { useLiveMetrics, useSnapshot } from "@/components/dashboard/use-snapshot"
import { SearchInput, TableToolbar } from "@/components/dashboard/table-tools"

export default function DevicePage() {
  const { snapshot } = useSnapshot()
  const metrics = useLiveMetrics()
  const ready = metrics.hasData
  const cpu = ready ? metrics.cpu : null
  const cpuMax = metrics.cpuMax
  const mem = ready ? metrics.mem : null
  const temp = metrics.temp
  const identity = snapshot.identity ?? {}
  const temps = snapshot.temperature ?? []
  const errors = snapshot.errors ?? {}
  const [errorQuery, setErrorQuery] = React.useState("")
  const filteredErrors = React.useMemo(() => {
    const q = errorQuery.trim().toLowerCase()
    const entries = Object.entries(errors)
    if (!q) return entries
    return entries.filter(([k, v]) => `${k} ${v}`.toLowerCase().includes(q))
  }, [errors, errorQuery])

  const info: [string, string][] = [
    ["Модель", snapshot.model ?? "—"],
    ["Версия VRP", snapshot.vrp_version ?? "—"],
    ["Время работы", snapshot.uptime ?? "—"],
    ["SDRAM", snapshot.sdram_mb ? `${snapshot.sdram_mb} МБ` : "—"],
    ["Время устройства", snapshot.device_time ?? "—"],
    ["Часовой пояс", snapshot.timezone ?? "—"],
    ...Object.entries(identity)
      .slice(0, 6)
      .map(([k, v]) => [k, String(v)] as [string, string]),
  ]

  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "Устройство" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Устройство</h1>
          <p className="text-sm text-muted-foreground">
            Из <code className="font-mono">display version</code>, CPU, памяти и температуры
          </p>
        </div>

        <ErrorBanner />
        <WaitingBanner />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Идентификация</CardTitle>
              <CardDescription>Аппаратное и программное обеспечение</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {info.map(([label, value]) => (
                    <TableRow key={label}>
                      <TableCell className="w-48 text-muted-foreground">{label}</TableCell>
                      <TableCell className="font-mono text-xs">{value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ресурсы</CardTitle>
              <CardDescription>Текущая нагрузка</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>Процессор</span>
                  {cpu === null ? (
                    <Skeleton className="h-4 w-28" />
                  ) : (
                    <span className="tabular-nums text-muted-foreground">
                      {cpu.toFixed(1)}% (пик {(cpuMax ?? 0).toFixed(1)}%)
                    </span>
                  )}
                </div>
                {cpu === null ? <Skeleton className="h-1 w-full" /> : <Progress value={cpu} />}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>Память</span>
                  {mem === null ? (
                    <Skeleton className="h-4 w-40" />
                  ) : (
                    <span className="tabular-nums text-muted-foreground">
                      {mem}% · {formatBytesMb(metrics.memUsedKb)} /{" "}
                      {formatBytesMb(metrics.memTotalKb)}
                    </span>
                  )}
                </div>
                {mem === null ? <Skeleton className="h-1 w-full" /> : <Progress value={mem} />}
              </div>
              {temps.map((t, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>Температура{t.name ? ` · ${t.name}` : ""}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {t.current ?? "—"} °C
                      {t.high !== undefined ? ` (порог ${t.high} °C)` : ""}
                    </span>
                  </div>
                  <Progress value={t.current ? Math.min((t.current / 80) * 100, 100) : 0} />
                </div>
              ))}
              <div className="flex flex-col gap-2 pt-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WAN-интерфейс</span>
                  <span className="font-mono text-xs">{snapshot.wan?.iface ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP</span>
                  <span className="font-mono text-xs">{snapshot.wan?.ip ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Сбор снапшота</span>
                  <span className="tabular-nums">
                    {snapshot.collected_in_s ? `${snapshot.collected_in_s} с` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Температура</span>
                  <span className="tabular-nums">{temp === null ? "—" : `${temp} °C`}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <CpuChart minutes={60} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>NTP и SSH</CardTitle>
              <CardDescription>Синхронизация времени и доступ</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {Object.entries(snapshot.ntp ?? {}).map(([k, v]) => (
                    <TableRow key={`ntp-${k}`}>
                      <TableCell className="w-40 text-muted-foreground">NTP {k}</TableCell>
                      <TableCell className="font-mono text-xs">{String(v)}</TableCell>
                    </TableRow>
                  ))}
                  {Object.entries(snapshot.ssh ?? {}).map(([k, v]) => (
                    <TableRow key={`ssh-${k}`}>
                      <TableCell className="w-40 text-muted-foreground">SSH {k}</TableCell>
                      <TableCell className="font-mono text-xs">{String(v)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ошибки сбора</CardTitle>
              <CardDescription>
                {Object.keys(errors).length === 0
                  ? "Все команды выполнены"
                  : `${Object.keys(errors).length} команд с ошибкой`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {Object.keys(errors).length > 0 && (
                <TableToolbar>
                  <SearchInput
                    value={errorQuery}
                    onChange={setErrorQuery}
                    placeholder="Команда или текст ошибки…"
                    className="w-full sm:w-64"
                  />
                </TableToolbar>
              )}
              {Object.keys(errors).length === 0 ? (
                <p className="text-sm text-muted-foreground">Ошибок нет</p>
              ) : filteredErrors.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Ничего не найдено</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Команда</TableHead>
                      <TableHead>Ошибка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredErrors.map(([key, message]) => (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-xs">{key}</TableCell>
                        <TableCell className="text-xs text-red-600 dark:text-red-400">
                          {message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
