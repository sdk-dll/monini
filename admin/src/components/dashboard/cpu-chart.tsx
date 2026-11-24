"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useHistory } from "./use-snapshot"

const chartConfig = {
  cpu: { label: "Процессор", color: "var(--chart-3)" },
  mem: { label: "Память", color: "var(--chart-4)" },
} satisfies ChartConfig

export function CpuChart({ minutes = 60 }: { minutes?: number }) {
  const { points } = useHistory(minutes, "cpu,mem_percent")
  const data = points.map((p) => ({
    time: new Date(p.ts * 1000).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    cpu: p.cpu ?? null,
    mem: p.mem_percent ?? null,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Процессор и память</CardTitle>
        <CardDescription>
          За {minutes < 60 ? `${minutes} мин` : `${Math.round(minutes / 60)} ч`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            Нет истории замеров
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full min-w-0" initialDimension={{ width: 760, height: 260 }}>
            <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Line dataKey="cpu" type="monotone" stroke="var(--color-cpu)" strokeWidth={2} dot={false} connectNulls />
              <Line
                dataKey="mem"
                type="monotone"
                stroke="var(--color-mem)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
