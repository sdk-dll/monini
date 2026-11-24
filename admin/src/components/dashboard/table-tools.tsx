"use client"

import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Filter values that mean "no filtering"; shown as "Все". */
export const ALL = "__all__"

/** Debounced search input with a clear button. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Поиск…",
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [text, setText] = React.useState(value)

  React.useEffect(() => setText(value), [value])

  React.useEffect(() => {
    if (text === value) return
    const timer = window.setTimeout(() => onChange(text), 250)
    return () => window.clearTimeout(timer)
  }, [text, value, onChange])

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-8 pr-8 pl-8"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("")
            onChange("")
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Очистить поиск"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** Small select for a single filter. */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  label?: string
  className?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger className={cn("h-8 w-auto min-w-36 gap-1.5", className)} size="sm">
        {label && <span className="text-muted-foreground">{label}</span>}
        <span className="truncate">{current?.label ?? placeholder ?? "—"}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function TableToolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = React.useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  React.useEffect(() => {
    setPage(1)
  }, [items.length, pageSize])

  const safePage = Math.min(page, pageCount)
  const slice = React.useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  )

  return { page: safePage, pageCount, setPage, items: slice, total: items.length }
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  onPageSize,
  pageSizeOptions = [10, 25, 50, 100],
}: {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize?: (size: number) => void
  pageSizeOptions?: number[]
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <span className="text-xs text-muted-foreground tabular-nums">
        {from}–{to} из {total}
      </span>
      <div className="flex items-center gap-1">
        {onPageSize && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger className="mr-2 h-8 w-auto" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / стр.
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="icon-sm" onClick={() => onPage(1)} disabled={page <= 1}>
          <ChevronsLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="px-2 text-xs tabular-nums text-muted-foreground">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
        >
          <ChevronRightIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPage(pageCount)}
          disabled={page >= pageCount}
        >
          <ChevronsRightIcon />
        </Button>
      </div>
    </div>
  )
}
