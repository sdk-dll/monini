import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

/**
 * Small square icon box used in reference card headers, e.g. the
 * "Total Revenue" / "Product Categories" tiles.
 */
export function IconTile({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
        className
      )}
    >
      <Icon className="size-4" />
    </div>
  )
}

export function CardHeaderRow({
  icon,
  title,
  action,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon ? <IconTile icon={icon} /> : null}
      <div className="min-w-0 flex-1 truncate text-base font-medium">{title}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
