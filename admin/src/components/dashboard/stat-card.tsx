import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "default",
  loading = false,
}: {
  title: string
  value: string | null
  hint: string
  icon: React.ComponentType<{ className?: string }>
  trend?: { value: string; positive: boolean }
  tone?: "default" | "warn" | "good"
  loading?: boolean
}) {
  const showSkeleton = loading || value === null
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        {showSkeleton ? (
          <Skeleton className="my-1 h-7 w-24" />
        ) : (
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        )}
        <CardAction>
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg ring-1 ring-foreground/10",
              tone === "warn" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              tone === "good" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              tone === "default" && "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
        {showSkeleton ? (
          <Skeleton className="h-3 w-20" />
        ) : (
          <>
            {trend ? (
              <span
                className={cn(
                  "font-medium",
                  trend.positive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {trend.value}
              </span>
            ) : null}
            <span>{hint}</span>
          </>
        )}
      </CardContent>
    </Card>
  )
}
