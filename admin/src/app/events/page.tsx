"use client"

import * as React from "react"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorBanner, WaitingBanner } from "@/components/dashboard/states"
import { LevelBadge, severityLevel } from "@/components/dashboard/status"
import { useSnapshot } from "@/components/dashboard/use-snapshot"
import {
  ALL,
  FilterSelect,
  Pagination,
  SearchInput,
  TableToolbar,
  usePagination,
} from "@/components/dashboard/table-tools"

export default function EventsPage() {
  const { snapshot } = useSnapshot()
  const logs = React.useMemo(
    () => (snapshot.log_recent ?? []).slice().reverse(),
    [snapshot.log_recent]
  )
  const traps = (snapshot.traps_recent ?? []).slice().reverse()

  const [query, setQuery] = React.useState("")
  const [module, setModule] = React.useState(ALL)
  const [level, setLevel] = React.useState(ALL)
  const [pageSize, setPageSize] = React.useState(25)

  const modules = React.useMemo(
    () => [...new Set(logs.map((l) => l.module).filter(Boolean))].sort(),
    [logs]
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter((event) => {
      if (module !== ALL && event.module !== module) return false
      if (level !== ALL && severityLevel(event.sev) !== level) return false
      if (q && !`${event.ts} ${event.module} ${event.code} ${event.msg}`.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [logs, query, module, level])

  const pager = usePagination(filtered, pageSize)

  const reset = () => {
    setQuery("")
    setModule(ALL)
    setLevel(ALL)
  }

  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "События" }]} />
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">События</h1>
          <p className="text-sm text-muted-foreground">
            <code className="font-mono">display logbuffer</code> и{" "}
            <code className="font-mono">display trapbuffer</code>, новые сверху
          </p>
        </div>

        <ErrorBanner />
        <WaitingBanner />

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle>Журнал устройства</CardTitle>
            <CardDescription>
              {filtered.length === logs.length
                ? `${logs.length} записей`
                : `${filtered.length} из ${logs.length}`}{" "}
              · в буфере {snapshot.log_stats?.current ?? "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <TableToolbar>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Текст, код или модуль…"
                className="w-full sm:w-72"
              />
              <FilterSelect
                value={module}
                onChange={setModule}
                label="Модуль"
                options={[{ value: ALL, label: "Все" }, ...modules.map((m) => ({ value: m, label: m }))]}
              />
              <FilterSelect
                value={level}
                onChange={setLevel}
                label="Уровень"
                options={[
                  { value: ALL, label: "Все" },
                  { value: "error", label: "Ошибки" },
                  { value: "warn", label: "Внимание" },
                  { value: "info", label: "Инфо" },
                ]}
              />
              {(query || module !== ALL || level !== ALL) && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Сбросить фильтры
                </button>
              )}
            </TableToolbar>

            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {logs.length === 0 ? "Журнал пуст" : "Ничего не найдено"}
              </p>
            ) : (
              <ol className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-l pl-5 pr-1">
                {pager.items.map((event, i) => (
                  <li key={`${event.ts}-${i}`} className="relative">
                    <span className="bg-background absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-current text-muted-foreground" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {event.ts?.trim()}
                      </span>
                      <LevelBadge level={severityLevel(event.sev)} />
                      <span className="text-sm font-medium">{event.module}</span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {event.code}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{event.msg}</p>
                  </li>
                ))}
              </ol>
            )}

            <Pagination
              page={pager.page}
              pageCount={pager.pageCount}
              total={pager.total}
              pageSize={pageSize}
              onPage={pager.setPage}
              onPageSize={setPageSize}
            />
          </CardContent>
        </Card>

        {traps.length > 0 && <TrapsCard traps={traps} />}
      </div>
    </>
  )
}

function TrapsCard({ traps }: { traps: Record<string, string | undefined>[] }) {
  const [query, setQuery] = React.useState("")
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return traps
    return traps.filter((t) =>
      Object.entries(t)
        .filter(([, v]) => v)
        .some(([k, v]) => `${k}: ${v}`.toLowerCase().includes(q))
    )
  }, [traps, query])

  return (
    <Card className="flex max-h-72 shrink-0 min-h-40 flex-col">
      <CardHeader>
        <CardTitle>Трапы SNMP</CardTitle>
        <CardDescription>
          {filtered.length === traps.length ? `${traps.length} последних` : `${filtered.length} из ${traps.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <TableToolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Поиск по трапам…"
            className="w-full sm:w-72"
          />
        </TableToolbar>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ничего не найдено</p>
        ) : (
          <ol className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-l pl-5 pr-1">
            {filtered.map((trap, i) => (
              <li key={i} className="relative text-xs">
                <span className="bg-background absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-current text-muted-foreground" />
                <pre className="overflow-x-auto font-mono whitespace-pre-wrap text-muted-foreground">
                  {Object.entries(trap)
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </pre>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
