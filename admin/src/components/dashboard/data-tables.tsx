"use client"

import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSnapshot } from "./use-snapshot"
import { StatusDot, UtilBar, isUp } from "./status"

export function InterfacesTable({ limit }: { limit?: number }) {
  const { snapshot } = useSnapshot()
  const interfaces = snapshot.interfaces ?? []
  const ipByName = new Map((snapshot.ip_interfaces ?? []).map((i) => [i.name, i.ip]))
  const rows = limit ? interfaces.slice(0, limit) : interfaces
  const up = interfaces.filter((i) => isUp(i.phys)).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Интерфейсы</CardTitle>
        <CardDescription>
          {up} активны из {interfaces.length}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/interfaces" />}>
            Все
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Интерфейс</TableHead>
              <TableHead>Состояние</TableHead>
              <TableHead className="hidden md:table-cell">Вход</TableHead>
              <TableHead className="hidden md:table-cell">Выход</TableHead>
              <TableHead className="text-right">IP-адрес</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Нет данных об интерфейсах
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell>
                  <Link href={`/interfaces`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.proto}</div>
                </TableCell>
                <TableCell>
                  <StatusDot value={row.phys} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <UtilBar value={row.inutil} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <UtilBar value={row.oututil} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {ipByName.get(row.name) ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function MacTable({ limit }: { limit?: number }) {
  const { snapshot } = useSnapshot()
  const macs = snapshot.mac_table ?? []
  const rows = limit ? macs.slice(0, limit) : macs

  return (
    <Card>
      <CardHeader>
        <CardTitle>Клиенты в сети</CardTitle>
        <CardDescription>
          {macs.length} MAC-адресов
          {snapshot.mac_total && snapshot.mac_total > macs.length
            ? ` из ${snapshot.mac_total}`
            : ""}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/clients" />}>
            Все
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MAC</TableHead>
              <TableHead>VLAN</TableHead>
              <TableHead>Порт</TableHead>
              <TableHead className="text-right">Тип</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Нет записей MAC-таблицы
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={`${row.mac}-${row.vlan}-${row.port}`}>
                <TableCell className="font-mono text-xs">{row.mac}</TableCell>
                <TableCell className="text-xs">{row.vlan}</TableCell>
                <TableCell className="text-xs">{row.port}</TableCell>
                <TableCell className="text-right">
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{row.type}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
