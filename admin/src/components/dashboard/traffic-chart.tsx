"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { bpsToMbit } from "@/lib/snapshot"
import { useHistory } from "./use-snapshot"

const chartConfig = {
  rx: { label: "Приём", color: "var(--chart-1)" },
  tx: { label: "Отдача", color: "var(--chart-2)" },
} satisfies ChartConfig

function pointTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

export function TrafficChart({ minutes = 60 }: { minutes?: number }) {
  const { points } = useHistory(minutes, "wan_in_bps,wan_out_bps")

  const data = points.map((p) => ({
    time: pointTime(p.ts),
    rx: Number(bpsToMbit(p.wan_in_bps).toFixed(2)),
    tx: Number(bpsToMbit(p.wan_out_bps).toFixed(2)),
  }))

  const last = data.at(-1)
  const peak = data.reduce((m, p) => Math.max(m, p.rx), 0)

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Трафик WAN</CardTitle>
        <CardDescription>
          За {minutes < 60 ? `${minutes} мин` : `${Math.round(minutes / 60)} ч`}, Мбит/с
        </CardDescription>
        <CardAction className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <ArrowDownRightIcon className="size-4 text-[var(--chart-1)]" />
            <span className="text-foreground font-medium tabular-nums">{last?.rx ?? 0}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <ArrowUpRightIcon className="size-4 text-[var(--chart-2)]" />
            <span className="text-foreground font-medium tabular-nums">{last?.tx ?? 0}</span>
          </span>
          <span className="text-xs text-muted-foreground">пик {peak.toFixed(1)}</span>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            Ещё нет замеров — история появится после первых опросов
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full min-w-0" initialDimension={{ width: 760, height: 260 }}>
            <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fillRx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-rx)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-rx)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-tx)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-tx)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Area dataKey="rx" type="monotone" fill="url(#fillRx)" stroke="var(--color-rx)" strokeWidth={2} />
              <Area dataKey="tx" type="monotone" fill="url(#fillTx)" stroke="var(--color-tx)" strokeWidth={2} />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
