import { cn } from "@/lib/utils"
import { ChevronRight, Home, Search } from "lucide-react"
import Link from "next/link"

/**
 * Title strip used by the "original" app pages: breadcrumb on the left,
 * command-search in the middle and primary actions on the right.
 */
export function PageTitleBar({
  crumbs,
  title,
  description,
  actions,
  className,
}: {
  crumbs: string[]
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            <Home className="size-4" />
          </Link>
          {crumbs.map((crumb, i) => (
            <span key={crumb + i} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5" />
              <span className={i === crumbs.length - 1 ? "text-foreground" : ""}>
                {crumb}
              </span>
            </span>
          ))}
        </nav>
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search pages or run commands"
            className="h-9 w-72 rounded-lg border bg-muted/40 pr-12 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
            readOnly
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘ K
          </kbd>
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  delta,
  negative,
  footer,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  hint?: string
  delta?: string
  negative?: boolean
  footer?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        {delta ? (
          <span
            className={cn(
              "text-xs font-medium",
              negative ? "text-red-600" : "text-emerald-600"
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      {footer ? <div className="mt-auto pt-2 text-sm">{footer}</div> : null}
    </div>
  )
}

export function SegmentedTabs({
  tabs,
  active = 0,
}: {
  tabs: string[]
  active?: number
}) {
  return (
    <div className="flex w-fit rounded-lg border bg-muted/50 p-0.5">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            i === active
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
