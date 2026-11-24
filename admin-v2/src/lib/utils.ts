export { cn } from "cn"

/** Human-readable timestamp ("12s ago", "3m ago", "2h ago"). */
export function relativeTime(ts?: number | null): string {
  if (!ts) return "never"
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - ts))
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatBytes(bytes?: number, digits = 1): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "—"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 ? 0 : digits)} ${units[i]}`
}

export function formatBps(bps?: number): string {
  if (bps === undefined || bps === null || Number.isNaN(bps)) return "—"
  if (bps === 0) return "0 bps"
  return `${formatBytes(bps, 1)}/s`
}

export function severityLabel(severity: number | string): string {
  if (typeof severity === "string") return severity
  return ["emergency", "alert", "critical", "error", "warning", "notice", "info", "debug"][severity] ?? String(severity)
}

export function splitLines(text?: string): string[] {
  if (!text) return []
  return text.split("\n").filter(Boolean)
}
