"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Search,
  Settings2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type Column<T> = {
  key: string
  header: React.ReactNode
  value: (row: T) => string | number | undefined | null
  cell?: (row: T) => React.ReactNode
  /** Show a <select> filter populated from unique values. */
  filter?: boolean
  /** Column can be hidden via the View menu. Default true. */
  hideable?: boolean
  defaultVisible?: boolean
  defaultSort?: "asc" | "desc"
  className?: string
}

/** Reusable data table: search, per-column filters, sorting, column
 * visibility, page-size and pagination. Supports client and manual modes. */
export function DataTable<T>({
  rows,
  columns,
  searchPlaceholder = "Search…",
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = "No rows to display",
  getRowKey,
  toolbar,
  manual,
}: {
  rows: T[]
  columns: Column<T>[]
  searchPlaceholder?: string
  pageSize?: number
  pageSizeOptions?: number[]
  emptyMessage?: string
  getRowKey: (row: T, index: number) => string | number
  toolbar?: React.ReactNode
  /** Server-side mode: data is already filtered/sorted/paginated. */
  manual?: {
    total: number
    page: number
    size: number
    onPageChange: (page: number) => void
    onSizeChange: (size: number) => void
    onSearch?: (q: string) => void
    search?: string
  }
}) {
  const [query, setQuery] = React.useState("")
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const [page, setPage] = React.useState(0)
  const [size, setSize] = React.useState(pageSize)
  const [hidden, setHidden] = React.useState<Record<string, boolean>>({})

  const isManual = Boolean(manual)
  const searchValue = manual?.search ?? query
  const currentSize = manual?.size ?? size
  const currentPage = manual?.page ?? page
  const totalRows = manual?.total ?? rows.length

  React.useEffect(() => {
    if (!isManual) setPage(0)
  }, [query, filters, size, rows, isManual])

  const shownColumns = React.useMemo(
    () => columns.filter((c) => !hidden[c.key] && c.defaultVisible !== false),
    [columns, hidden]
  )

  const filtered = React.useMemo(() => {
    if (isManual) return rows
    const q = query.trim().toLowerCase()
    let out = rows.filter((row) => {
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue
        const col = columns.find((c) => c.key === key)
        if (col && String(col.value(row) ?? "") !== value) return false
      }
      if (!q) return true
      return columns.some((c) => {
        const v = c.value(row)
        return v !== undefined && v !== null && String(v).toLowerCase().includes(q)
      })
    })
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col) {
        out = [...out].sort((a, b) => {
          const av = col.value(a)
          const bv = col.value(b)
          if (av === undefined || av === null) return 1
          if (bv === undefined || bv === null) return -1
          const an = Number(av)
          const bn = Number(bv)
          const cmp =
            !Number.isNaN(an) && !Number.isNaN(bn) && av !== "" && bv !== ""
              ? an - bn
              : String(av).localeCompare(String(bv), undefined, { numeric: true })
          return sort.dir === "asc" ? cmp : -cmp
        })
      }
    }
    return out
  }, [rows, columns, query, filters, sort, isManual])

  const pages = Math.max(1, Math.ceil(totalRows / currentSize))
  const safePage = Math.min(currentPage, pages - 1)
  const pageRows = isManual ? rows : filtered.slice(safePage * currentSize, safePage * currentSize + currentSize)

  const filterColumns = React.useMemo(() => columns.filter((c) => c.filter), [columns])

  const optionsFor = React.useCallback(
    (col: Column<T>) =>
      Array.from(
        new Set(
          rows
            .map((r) => col.value(r))
            .filter((v) => v !== undefined && v !== null && v !== "")
            .map((v) => String(v))
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [rows]
  )

  function toggleSort(col: Column<T>) {
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: col.defaultSort ?? "asc" }
      if (prev.dir === "asc") return { key: col.key, dir: "desc" }
      return null
    })
  }

  function setSearch(v: string) {
    if (manual?.onSearch) manual.onSearch(v)
    else setQuery(v)
    if (!isManual) setPage(0)
  }

  function setCurrentPage(p: number) {
    if (manual) manual.onPageChange(p)
    else setPage(p)
  }

  function setCurrentSize(s: number) {
    if (manual) manual.onSizeChange(s)
    else setSize(s)
    setCurrentPage(0)
  }

  const anyFilter = Boolean(searchValue) || Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-64 pl-9"
          />
        </div>
        {filterColumns.map((col) => (
          <Select
            key={col.key}
            value={filters[col.key] ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, [col.key]: v === "all" ? "" : v }))}
          >
            <SelectTrigger className="h-9 w-40">
              <Settings2 className="mr-1 size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {String(col.header).toLowerCase()}</SelectItem>
              {optionsFor(col).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {anyFilter ? (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilters({}) }}>
            <X className="size-3.5" /> Clear
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto h-9">
              <Settings2 className="size-3.5" /> View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.filter((c) => c.hideable !== false).map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={!hidden[col.key] && col.defaultVisible !== false}
                onCheckedChange={(checked) =>
                  setHidden((h) => ({ ...h, [col.key]: !checked }))
                }
              >
                {String(col.header)}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setHidden({})}>
              <EyeOff className="size-3.5" /> Show all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {toolbar}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {shownColumns.map((col) => (
                <TableHead key={col.key} className={cn("whitespace-nowrap", col.className)}>
                  <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-foreground">
                    {col.header}
                    {sort?.key === col.key ? (
                      sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                    ) : null}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={shownColumns.length} className="h-32 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, i) => (
                <TableRow key={getRowKey(row, i)} className="align-top">
                  {shownColumns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell ? col.cell(row) : String(col.value(row) ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {totalRows
            ? `${safePage * currentSize + 1}-${Math.min((safePage + 1) * currentSize, totalRows)} of ${totalRows}`
            : "0 rows"}
          {!isManual && filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
        </span>
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select value={String(currentSize)} onValueChange={(v) => setCurrentSize(Number(v))}>
            <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <span>Page {safePage + 1} of {pages}</span>
          <Button variant="outline" size="icon-xs" disabled={safePage === 0} onClick={() => setCurrentPage(0)} aria-label="First page"><ChevronsLeft className="size-3.5" /></Button>
          <Button variant="outline" size="icon-xs" disabled={safePage === 0} onClick={() => setCurrentPage(safePage - 1)} aria-label="Previous page"><ChevronLeft className="size-3.5" /></Button>
          <Button variant="outline" size="icon-xs" disabled={safePage >= pages - 1} onClick={() => setCurrentPage(safePage + 1)} aria-label="Next page"><ChevronRight className="size-3.5" /></Button>
          <Button variant="outline" size="icon-xs" disabled={safePage >= pages - 1} onClick={() => setCurrentPage(pages - 1)} aria-label="Last page"><ChevronsRight className="size-3.5" /></Button>
        </div>
      </div>
    </div>
  )
}
