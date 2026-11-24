"use client"

import Link from "next/link"
import {
  ActivityIcon,
  CpuIcon,
  HardDriveIcon,
  ThermometerIcon,
  WifiIcon,
} from "lucide-react"

import { SiteHeader } from "@/components/dashboard/site-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { TrafficChart } from "@/components/dashboard/traffic-chart"
import { CpuChart } from "@/components/dashboard/cpu-chart"
import { InterfacesTable, MacTable } from "@/components/dashboard/data-tables"
import { ErrorBanner, WaitingBanner } from "@/components/dashboard/states"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { LevelBadge, formatBps, formatBytesMb, severityLevel } from "@/components/dashboard/status"
import { Skeleton } from "@/components/ui/skeleton"
import { useLiveMetrics, useSnapshot } from "@/components/dashboard/use-snapshot"

export default function OverviewPage() {
  const { snapshot, source, connected } = useSnapshot()
  const metrics = useLiveMetrics()
  const ready = metrics.hasData
  const cpu = ready ? metrics.cpu : null
  const mem = ready ? metrics.mem : null
  const temp = metrics.temp
  const summary = ready ? metrics.summary : null
  const wan = ready ? metrics.wan : null
  const logs = (snapshot.log_recent ?? []).slice(-4).reverse()

  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "Обзор" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Обзор</h1>
            <p className="text-sm text-muted-foreground">
              {snapshot.model ?? "—"} · VRP {snapshot.vrp_version ?? "—"}
              {snapshot.errors && Object.keys(snapshot.errors).length > 0
                ? ` · не выполнено команд: ${Object.keys(snapshot.errors).length}`
                : ""}
            </p>
          </div>
          {ready && connected && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              title="Данные обновляются каждую секунду; CPU и память измеряются на роутере раз в 5 секунд"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              live · обновлено{" "}
              {metrics.liveAt
                ? new Date(metrics.liveAt * 1000).toLocaleTimeString("ru-RU")
                : "—"}
            </span>
          )}
          {!ready && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
              ждём данные
            </span>
          )}
        </div>

        <ErrorBanner />
        <WaitingBanner />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Процессор"
            value={cpu === null ? null : `${cpu.toFixed(1)}%`}
            hint={`пик ${(metrics.cpuMax ?? 0).toFixed(1)}%`}
            icon={CpuIcon}
            tone={(cpu ?? 0) > 80 ? "warn" : "default"}
            loading={!ready}
          />
          <StatCard
            title="Память"
            value={mem === null ? null : `${mem}%`}
            hint={`${formatBytesMb(metrics.memUsedKb)} / ${formatBytesMb(metrics.memTotalKb)}`}
            icon={HardDriveIcon}
            loading={!ready}
          />
          <StatCard
            title="WAN-приём"
            value={wan?.in_bps != null ? formatBps(wan.in_bps) : null}
            hint={wan ? `отдача ${formatBps(wan.out_bps)}` : "нет данных"}
            icon={ActivityIcon}
            tone="good"
            loading={!ready}
          />
          <StatCard
            title="Температура"
            value={temp === null ? (ready ? "—" : null) : `${temp} °C`}
            hint={temp !== null && temp > 60 ? "выше нормы" : "в норме"}
            icon={ThermometerIcon}
            tone={temp !== null && temp > 60 ? "warn" : "good"}
            loading={!ready}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <TrafficChart minutes={60} />
          <CpuChart minutes={60} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <InterfacesTable limit={4} />
            <MacTable limit={5} />
          </div>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Последние события</CardTitle>
                <CardDescription>Журнал устройства</CardDescription>
                <CardAction>
                  <Link href="/events" className="text-muted-foreground hover:text-foreground">
                    <ActivityIcon className="size-4" />
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Журнал пуст</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {logs.map((event, i) => (
                      <li key={`${event.ts}-${i}`} className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {event.ts?.slice(11, 19) ?? ""}
                          </span>
                          <LevelBadge level={severityLevel(event.sev)} />
                          <span className="text-sm font-medium">{event.module}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{event.msg}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Сводка</CardTitle>
                <CardDescription>Состояние сети</CardDescription>
                <CardAction>
                  <WifiIcon className="size-4 text-muted-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {!ready && <Skeleton className="h-24 w-full" />}
                {ready && (
                  <>
                <Row label="Интерфейсы" value={summary ? `${summary.ifaces_up} / ${summary.ifaces_total}` : "—"} />
                <Row label="Маршруты" value={String(summary?.routes ?? "—")} />
                <Row label="ARP-записи" value={String(summary?.arp_entries ?? "—")} />
                <Row
                  label="DHCP занято"
                  value={
                    summary
                      ? `${summary.dhcp_used} из ${summary.dhcp_used + (summary.dhcp_idle ?? 0)}`
                      : "—"
                  }
                />
                <Row label="Соседи LLDP" value={String(summary?.lldp_neighbors ?? "—")} />
                <Row label="MAC-записей" value={String(summary?.mac_entries ?? "—")} />
                <Row label="Аварии" value={String(summary?.alarms ?? "—")} />
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Память</span>
                    <span className="tabular-nums">{mem ?? "—"}%</span>
                  </div>
                  <Progress value={mem ?? 0} />
                </div>
                  </>
                )}
                <Link
                  href="/device"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Подробнее об устройстве →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
