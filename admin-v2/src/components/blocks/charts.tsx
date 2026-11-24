import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Recharts-free sparkline/area charts matching the reference styling. */
/* ------------------------------------------------------------------ */

function smoothPath(points: [number, number][]) {
  if (points.length === 0) return ""
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cx = (prev[0] + curr[0]) / 2
    d += ` C ${cx} ${prev[1]}, ${cx} ${curr[1]}, ${curr[0]} ${curr[1]}`
  }
  return d
}

export function Sparkline({
  data,
  className,
  stroke = "currentColor",
  fill = false,
  showDots = false,
  strokeWidth = 1.5,
  width = 120,
  height = 40,
}: {
  data: number[]
  className?: string
  stroke?: string
  fill?: boolean
  showDots?: boolean
  strokeWidth?: number
  width?: number
  height?: number
}) {
  const safe = data.map((v) => (Number.isFinite(v) ? v : 0))
  const min = safe.length ? Math.min(...safe) : 0
  const max = safe.length ? Math.max(...safe) : 1
  const span = max - min || 1
  const pad = 4
  const points: [number, number][] = safe.map((v, i) => [
    pad + (i / Math.max(1, data.length - 1)) * (width - pad * 2),
    height - pad - ((v - min) / span) * (height - pad * 2),
  ])
  const line = smoothPath(points)
  const area = points.length
    ? `${line} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`
    : ""

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill ? <path d={area} fill="currentColor" opacity={0.15} /> : null}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {showDots
        ? points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2} fill="var(--background)" stroke={stroke} strokeWidth={1.5} />
          ))
        : null}
    </svg>
  )
}

/** Line chart with a shaded area, used for the "Total Revenue" block. */
export function AreaLineChart({
  data,
  labels,
  compare,
  className,
  height = 220,
}: {
  data: number[]
  compare?: number[]
  labels: string[]
  className?: string
  height?: number
}) {
  const width = 640
  const padX = 4
  const padTop = 8
  const padBottom = 24
  const chartH = height - padBottom
  const safe = data.map((v) => (Number.isFinite(v) ? v : 0))
  const safeCmp = (compare ?? []).map((v) => (Number.isFinite(v) ? v : 0))
  const all = [...safe, ...safeCmp]
  const max = Math.max(1, ...all) * 1.08
  const scaleY = (v: number) => padTop + (1 - v / max) * (chartH - padTop)
  const scaleX = (i: number) =>
    padX + (i / Math.max(1, data.length - 1)) * (width - padX * 2)

  const pts = safe.map((v, i) => [scaleX(i), scaleY(v)] as [number, number])
  const cmp = safeCmp.map((v, i) => [scaleX(i), scaleY(v)] as [number, number])
  const line = smoothPath(pts)
  const area = pts.length
    ? `${line} L ${pts[pts.length - 1][0]} ${chartH} L ${pts[0][0]} ${chartH} Z`
    : ""

  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden>
        {pts.map(([x], i) => (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={padTop}
            y2={chartH}
            stroke="var(--border)"
            strokeDasharray="3 4"
            strokeWidth={1}
          />
        ))}
        <path d={area} fill="var(--foreground)" opacity={0.06} />
        {cmp.length ? (
          <path
            d={smoothPath(cmp)}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.6}
            strokeWidth={1.25}
          />
        ) : null}
        <path d={line} fill="none" stroke="var(--foreground)" strokeWidth={1.75} />
        {pts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2.5}
            fill="var(--background)"
            stroke="var(--foreground)"
            strokeWidth={1.5}
          />
        ))}
        {labels.map((label, i) => (
          <text
            key={label + i}
            x={scaleX(i)}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}

/** Stacked horizontal bar per month, used by "Revenue by Channel". */
export function StackedChannelChart({
  rows,
  segments,
}: {
  rows: { label: string; values: number[] }[]
  segments: { label: string; className: string }[]
}) {
  const max = Math.max(...rows.map((r) => r.values.reduce((a, b) => a + b, 0)))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", s.className)} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[2.5rem_1fr] items-center gap-2">
            <span className="text-xs text-muted-foreground">{row.label}</span>
            <div className="flex h-5 overflow-hidden rounded-sm">
              {row.values.map((v, i) => (
                <div
                  key={i}
                  className={cn(segments[i]?.className, "border-r border-background/20 last:border-r-0")}
                  style={{ width: `${(v / max) * 100}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between pl-12 text-[10px] text-muted-foreground">
        {["$0", "$30K", "$60K", "$90K", "$120K"].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  )
}

/** Vertical bars, used by payment-volume / monthly-sales blocks. */
export function VerticalBars({
  labels,
  values,
  className,
  highlight,
  height = 180,
  twoTone = false,
}: {
  labels: string[]
  values: number[]
  className?: string
  highlight?: number[]
  height?: number
  twoTone?: boolean
}) {
  const max = Math.max(...values)
  return (
    <div className={cn("flex h-full w-full items-end gap-2", className)} style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1">
          <div className="relative flex h-full items-end">
            {twoTone ? (
              <div className="flex w-full flex-col justify-end gap-0.5">
                <div
                  className="w-full rounded-t-sm bg-foreground"
                  style={{ height: `${(v / max) * 60}%` }}
                />
                <div
                  className="w-full bg-muted-foreground/70"
                  style={{ height: `${(v / max) * 35}%` }}
                />
              </div>
            ) : (
              <div
                className={cn(
                  "w-full rounded-t-sm",
                  highlight?.includes(i) ? "bg-foreground" : "bg-muted-foreground/40"
                )}
                style={{ height: `${(v / max) * 100}%` }}
              />
            )}
          </div>
          <span className="text-center text-[10px] text-muted-foreground">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}
