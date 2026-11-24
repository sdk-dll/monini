import { cn } from "@/lib/utils"

export type PhysState = string

export function physLabel(value: string): string {
  switch (value.toLowerCase()) {
    case "up":
    case "up(s)":
      return "поднят"
    case "down":
      return "выключен"
    case "*down":
      return "неисправен"
    case "administratively":
      return "отключён"
    default:
      return value
  }
}

export function isUp(value?: string): boolean {
  return !!value && value.toLowerCase().startsWith("up")
}

function utilColor(v: number | null) {
  if (v === null) return "bg-muted-foreground/30"
  if (v >= 80) return "bg-red-500"
  if (v >= 50) return "bg-amber-500"
  return "bg-emerald-500"
}

export function StatusDot({ value, className }: { value?: string; className?: string }) {
  const up = isUp(value)
  const down = value === "*down"
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span
        className={cn(
          "size-2 rounded-full",
          up ? "bg-emerald-500" : down ? "bg-amber-500" : "bg-muted-foreground/40"
        )}
      />
      {physLabel(value ?? "unknown")}
    </span>
  )
}

export function UtilBar({ value }: { value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", utilColor(value))}
          style={{ width: `${Math.min(value ?? 0, 100)}%` }}
        />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground">
        {value === null ? "—" : `${value.toFixed(1)}%`}
      </span>
    </div>
  )
}

/** Huawei severity: 1 emergency … 5 notification/8 debugging. */
export function severityLevel(sev: string | number | undefined): "info" | "warn" | "error" {
  const n = Number(sev)
  if (!Number.isFinite(n)) return "info"
  if (n <= 3) return "error"
  if (n === 4) return "warn"
  return "info"
}

const levelLabel = { info: "инфо", warn: "внимание", error: "ошибка" } as const

export function LevelBadge({ level }: { level: "info" | "warn" | "error" }) {
  const styles = {
    info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    error: "bg-red-500/10 text-red-600 dark:text-red-400",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        styles[level]
      )}
    >
      {levelLabel[level]}
    </span>
  )
}

export function formatBps(bps?: number | null): string {
  if (!bps || bps <= 0) return "0 бит/с"
  const units = ["бит/с", "Кбит/с", "Мбит/с", "Гбит/с"]
  let value = bps
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`
}

export function formatBytesMb(kb?: number | null): string {
  if (kb === null || kb === undefined) return "—"
  return `${(kb / 1024).toFixed(0)} МБ`
}
