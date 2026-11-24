"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Router,
  Server,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import type { Device } from "@/lib/types"
import { useDevices } from "@/components/providers/devices-provider"
import { cn, relativeTime } from "@/lib/utils"

const emptyForm = {
  id: "",
  name: "",
  host: "",
  port: 22,
  username: "admin",
  password: "",
  wan_iface: "GigabitEthernet0/0/0",
  lan_iface: "Vlanif100",
  location: "",
  enabled: true,
}

export function DevicesPage() {
  const { devices, selectedId, setSelectedId, reload } = useDevices()
  const [form, setForm] = useState<Record<string, string | number | boolean>>(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<Record<string, { ok: boolean; message: string }>>({})

  function openAdd() {
    setForm({ ...emptyForm })
    setEditing(null)
    setError(null)
    setOpen(true)
  }

  function openEdit(d: Device) {
    setForm({
      id: d.id,
      name: d.name,
      host: d.host,
      port: d.port,
      username: d.username,
      password: "",
      wan_iface: d.wan_iface,
      lan_iface: d.lan_iface,
      location: d.location,
      enabled: d.enabled,
    })
    setEditing(d.id)
    setError(null)
    setOpen(true)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = { ...form }
      if (!payload.password) delete payload.password
      if (!payload.id) delete payload.id
      if (editing) await api.updateDevice(editing, payload)
      else await api.addDevice(payload as { host: string })
      setOpen(false)
      reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(d: Device) {
    if (!confirm(`Delete device "${d.name}"? Its poller will be stopped.`)) return
    try {
      await api.deleteDevice(d.id)
      reload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function testConnection(d: Device) {
    setChecking(d.id)
    try {
      const res = await api.checkDevice(d.id)
      setCheckResult((prev) => ({
        ...prev,
        [d.id]: {
          ok: res.ok,
          message: res.ok
            ? `${res.parsed?.model ?? "Connected"} · ${res.parsed?.vrp_version ?? "VRP unknown"}`
            : res.error ?? "Connection failed",
        },
      }))
    } catch (e) {
      setCheckResult((prev) => ({ ...prev, [d.id]: { ok: false, message: (e as Error).message } }))
    } finally {
      setChecking(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground">
            Manage routers, credentials and pollers. {devices.length} configured · {devices.filter((d) => d.connected).length} online.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={reload}><RefreshCw className="size-4" /> Refresh</Button>
          <Button onClick={openAdd}><Plus className="size-4" /> Add device</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {devices.map((d) => {
          const check = checkResult[d.id]
          return (
            <Card key={d.id} className={cn("gap-3", selectedId === d.id && "ring-1 ring-ring/40")}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <span className={cn("flex size-9 items-center justify-center rounded-lg", d.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                    <Router className="size-5" />
                  </span>
                  <div>
                    <CardTitle className="text-base">{d.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{d.host}:{d.port} · {d.username}</p>
                  </div>
                </div>
                <Badge variant={d.enabled ? (d.connected ? "default" : "destructive") : "secondary"}>
                  {d.enabled ? (d.connected ? "Online" : "Offline") : "Disabled"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                  <Info label="ID" value={d.id} />
                  <Info label="WAN" value={d.wan_iface} />
                  <Info label="LAN" value={d.lan_iface} />
                  <Info label="Location" value={d.location || "—"} />
                  <Info label="Last OK" value={d.last_ok ? relativeTime(d.last_ok) : "never"} />
                  <Info label="Polls" value={`${d.poller.runs} / ${d.poller.failures} fail`} />
                </div>
                {d.last_error ? (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span className="line-clamp-2">{d.last_error}</span>
                  </div>
                ) : null}
                {check ? (
                  <div className={cn("flex items-center gap-2 text-xs", check.ok ? "text-emerald-600" : "text-red-600")}>
                    {check.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                    <span className="truncate">{check.message}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" disabled={checking === d.id} onClick={() => testConnection(d)}>
                    {checking === d.id ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                    Test connection
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon-sm" onClick={() => openEdit(d)}><Pencil className="size-3.5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon-sm" onClick={() => { setSelectedId(d.id); window.location.href = "/" }}><Server className="size-3.5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Use as active device</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="icon-sm" className="ml-auto text-destructive" onClick={() => remove(d)}><Trash2 className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit device" : "Add device"}</DialogTitle>
            <DialogDescription>
              Credentials are stored in the backend registry. The password is masked in all responses.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Name"><Input value={String(form.name)} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Router office" /></Field>
            <Field label="Host" required><Input value={String(form.host)} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.1" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SSH port"><Input type="number" value={Number(form.port)} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></Field>
              <Field label="Username"><Input value={String(form.username)} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            </div>
            <Field label={editing ? "Password (leave empty to keep)" : "Password"}>
              <Input type="password" value={String(form.password)} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="WAN interface"><Input value={String(form.wan_iface)} onChange={(e) => setForm({ ...form, wan_iface: e.target.value })} /></Field>
              <Field label="LAN interface"><Input value={String(form.lan_iface)} onChange={(e) => setForm({ ...form, lan_iface: e.target.value })} /></Field>
            </div>
            <Field label="Location"><Input value={String(form.location)} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(form.enabled)} onCheckedChange={(v) => setForm({ ...form, enabled: v })} id="enabled" />
              <Label htmlFor="enabled">Enabled (poll this device)</Label>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.host}>{busy ? "Saving…" : "Save device"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required ? " *" : ""}</Label>
      {children}
    </div>
  )
}
