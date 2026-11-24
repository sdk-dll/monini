"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  Wrench,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError } from "@/lib/api"
import type { AiSettings } from "@/lib/types"
import { appTitles } from "@/lib/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, relativeTime } from "@/lib/utils"

const links = [
  { title: "General", href: "/settings", icon: Settings2 },
  { title: "AI settings", href: "/settings/ai", icon: KeyRound },
  { title: "API / Tools", href: "/settings/tools", icon: Wrench },
  { title: "About", href: "/settings/about", icon: CircleAlert },
]

const envRows = [
  ["MONINI_ADMIN_USER", "Basic Auth username"],
  ["MONINI_ADMIN_PASS", "Basic Auth password"],
  ["MONINI_DB", "SQLite database path"],
  ["HUAWEI_POLL_INTERVAL", "Snapshot poll interval (s)"],
  ["HUAWEI_SLOW_INTERVAL", "Slow commands interval (s)"],
  ["MONINI_FAST_INTERVAL", "Fast CPU/mem poll (s)"],
  ["HUAWEI_WAN_IFACE", "Default WAN interface"],
  ["HUAWEI_LAN_IFACE", "Default LAN interface"],
  ["MONINI_AI_BASE_URL", "OpenAI-compatible endpoint"],
  ["MONINI_AI_MODEL", "Default AI model"],
]

export function SettingsPage({ tab = "general" }: { tab?: "general" | "ai" | "tools" | "about" }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Backend connection, AI agent and monitoring configuration.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex h-fit flex-col gap-1 rounded-lg bg-muted/50 p-1.5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                pathname === l.href ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <l.icon className="size-4" /> {l.title}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          {tab === "general" ? <GeneralPanel /> : null}
          {tab === "ai" ? <AiPanel /> : null}
          {tab === "tools" ? <ToolsPanel /> : null}
          {tab === "about" ? <AboutPanel /> : null}
        </div>
      </div>
    </div>
  )
}

function GeneralPanel() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.health()
      .then((h) => { setHealth(h as unknown as Record<string, unknown>); setError(null) })
      .catch((e) => setError((e as Error).message))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-sm text-muted-foreground">Backend health and environment reference.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Status", health?.status ?? "—", Activity],
          ["Devices", String(health?.devices ?? "—"), Server],
          ["Connected", String(health?.devices_connected ?? "—"), CheckCircle2],
          ["Poll interval", health?.interval ? `${health.interval}s` : "—", Clock3],
        ].map(([label, value, Icon]) => {
          const C = Icon as React.ElementType
          return (
            <Card key={label as string}>
              <CardContent className="flex items-center gap-3 pt-4 pb-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><C className="size-4" /></span>
                <div><div className="text-xs text-muted-foreground">{label as string}</div><div className="text-xl font-semibold">{value as string}</div></div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Server className="size-4" /> Backend</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Row label="Latest snapshot" value={health?.latest_ts ? relativeTime(health.latest_ts as number) : "never"} />
          <Row label="API base" value="/api (proxied to backend)" />
          <Row label="Auth" value="HTTP Basic (from backend .env)" />
          <Row label="Telemetry" value="SSE /api/stream" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Settings2 className="size-4" /> Environment variables</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {envRows.map(([name, desc]) => (
            <div key={name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <code className="font-mono font-medium">{name}</code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}

function AiPanel() {
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [form, setForm] = useState<Partial<AiSettings> & { api_key?: string }>({})
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([api.settings(), api.aiModels()]).then(([s, m]) => {
      if (s.status === "fulfilled") {
        setSettings(s.value.ai)
        setForm(s.value.ai)
      }
      if (m.status === "fulfilled") setModels(m.value.models)
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await api.saveSettings({ ai: form })
      setSettings(res.ai)
      setForm(res.ai)
      setMessage("Settings saved")
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading settings…</div>

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">AI settings</h2>
          <p className="text-sm text-muted-foreground">OpenAI-compatible endpoint and agent behavior.</p>
        </div>
        <Button onClick={save} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save"}</Button>
      </div>
      {message ? <p className={cn("text-sm", message === "Settings saved" ? "text-emerald-600" : "text-destructive")}>{message}</p> : null}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Field label="Base URL">
            <Input value={form.base_url ?? ""} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.example.com/v1" />
          </Field>
          <Field label="API key" hint={settings?.has_api_key ? `Current: ${settings.api_key_masked} (leave empty to keep)` : "Not set"}>
            <Input type="password" value={form.api_key ?? ""} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Model">
              <Input list="ai-models" value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <datalist id="ai-models">{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist>
            </Field>
            <Field label="Temperature">
              <Input type="number" step="0.1" min="0" max="2" value={form.temperature ?? 0.2} onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })} />
            </Field>
            <Field label="Max tokens">
              <Input type="number" value={form.max_tokens ?? 2048} onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) })} />
            </Field>
            <Field label="Max tool rounds">
              <Input type="number" value={form.max_tool_rounds ?? 8} onChange={(e) => setForm({ ...form, max_tool_rounds: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="System prompt" hint="Instructions given to the agent before each conversation.">
            <Textarea value={form.system_prompt ?? ""} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} className="min-h-40 font-mono text-xs" />
          </Field>
          {models.length ? (
            <div className="flex flex-wrap gap-1.5">
              {models.slice(0, 20).map((m) => (
                <button key={m.id} onClick={() => setForm({ ...form, model: m.id })} className={cn("rounded-md border px-2 py-1 text-[10px] hover:bg-muted", form.model === m.id && "bg-primary text-primary-foreground")}>{m.id}</button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}

function ToolsPanel() {
  const [tools, setTools] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.aiTools().then(setTools).catch(() => setTools([])).finally(() => setLoading(false))
  }, [])

  const endpoints = [
    ["GET", "/api/health", "Poller status"],
    ["GET", "/api/devices", "List devices"],
    ["GET", "/api/overview", "Latest snapshot"],
    ["GET", "/api/system", "System info"],
    ["GET", "/api/interfaces", "Interfaces"],
    ["GET", "/api/network", "Routes, ARP, MAC, VLAN"],
    ["GET", "/api/dhcp", "DHCP pools"],
    ["GET", "/api/logs", "Log search"],
    ["GET", "/api/alerts", "Alerts"],
    ["GET", "/api/history", "Metric history"],
    ["POST", "/api/command", "Read-only VRP command"],
    ["GET", "/api/stream", "Live SSE telemetry"],
    ["POST", "/api/ai/chat", "Agent chat (SSE)"],
  ]

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">API &amp; tools</h2>
        <p className="text-sm text-muted-foreground">Agent tool catalog and available HTTP endpoints.</p>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4" /> Agent tools ({tools.length})</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {loading ? <div className="py-4 text-sm text-muted-foreground">Loading…</div> : null}
          {tools.map((t, i) => {
            const fn = (t.function ?? {}) as Record<string, unknown>
            return (
              <div key={i} className="py-3">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-medium">{String(fn.name ?? t.name ?? "tool")}</code>
                  {Boolean(fn.supports_tools ?? t.supports_tools) ? <Badge variant="secondary">tools</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{String(fn.description ?? t.description ?? "")}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ExternalLink className="size-4" /> HTTP API</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {endpoints.map(([method, path, desc]) => (
            <div key={path} className="flex items-center gap-3 py-2 text-xs">
              <Badge variant={method === "GET" ? "secondary" : "default"} className="w-12 justify-center">{method}</Badge>
              <code className="font-mono font-medium">{path}</code>
              <span className="ml-auto text-muted-foreground">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}

function AboutPanel() {
  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">About Monini</h2>
        <p className="text-sm text-muted-foreground">A monitoring console for Huawei VRP routers over STelnet.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 text-sm">
          <Row label="Frontend" value="Next.js 16 + shadcn/ui" />
          <Row label="Backend" value="FastAPI + SQLite" />
          <Row label="Transport" value="Paramiko interactive SSH shell" />
          <Row label="Polling" value="Heavy snapshot + fast CPU/mem + slow log/trap buffer" />
          <Row label="Auth" value="HTTP Basic" />
          <Row label="Telemetry" value="Server-Sent Events (1s frames)" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="size-4" /> Safety</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Console commands are restricted to <code className="rounded bg-muted px-1">display</code>, <code className="rounded bg-muted px-1">ping</code> and <code className="rounded bg-muted px-1">tracert</code>. Mutating keywords (reset, reboot, undo, save, shutdown…) are rejected by the backend.
        </CardContent>
      </Card>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
