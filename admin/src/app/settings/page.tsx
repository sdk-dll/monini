"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  Loader2Icon,
  PlusIcon,
  RouterIcon,
  SaveIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { apiGet, apiPut } from "@/lib/snapshot"
import { useDevices } from "@/components/dashboard/device-provider"
import type { AiModel, Device, Settings } from "@/lib/api-types"

function AiSettingsForm() {
  const [settings, setSettings] = React.useState<Settings | null>(null)
  const [apiKey, setApiKey] = React.useState("")
  const [models, setModels] = React.useState<AiModel[]>([])
  const [modelsError, setModelsError] = React.useState<string | null>(null)
  const [loadingModels, setLoadingModels] = React.useState(false)
  const [status, setStatus] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    apiGet<Settings>("/settings")
      .then(setSettings)
      .catch((err) => setStatus({ kind: "error", text: err instanceof Error ? err.message : "Ошибка" }))
  }, [])

  const ai = settings?.ai

  function patchAi(patch: Partial<NonNullable<typeof ai>>) {
    setSettings((prev) => (prev ? { ...prev, ai: { ...prev.ai, ...patch } } : prev))
  }

  async function loadModels() {
    setLoadingModels(true)
    setModelsError(null)
    try {
      const res = await apiGet<{ models: AiModel[]; current: string }>("/ai/models")
      setModels(res.models)
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : "Не удалось загрузить модели")
    } finally {
      setLoadingModels(false)
    }
  }

  async function save() {
    if (!ai) return
    setSaving(true)
    setStatus(null)
    try {
      const body: Record<string, unknown> = {
        base_url: ai.base_url,
        model: ai.model,
        temperature: ai.temperature,
        max_tokens: ai.max_tokens,
        max_tool_rounds: ai.max_tool_rounds,
        system_prompt: ai.system_prompt,
      }
      if (apiKey) body.api_key = apiKey
      const updated = await apiPut<Settings>("/settings", body)
      setSettings(updated)
      setApiKey("")
      setStatus({ kind: "ok", text: "Настройки сохранены" })
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Не удалось сохранить" })
    } finally {
      setSaving(false)
    }
  }

  if (!ai) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Подключение к ИИ</CardTitle>
        <CardDescription>
          Любой OpenAI-совместимый endpoint: chat/completions, tool calls, стриминг
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="base-url">Endpoint</Label>
            <Input
              id="base-url"
              value={ai.base_url}
              onChange={(e) => patchAi({ base_url: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="api-key">API-ключ</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={ai.has_api_key ? `Сохранён: ${ai.api_key_masked}` : "sk-…"}
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Модель</Label>
          <div className="flex gap-2">
            <Input
              value={ai.model}
              onChange={(e) => patchAi({ model: e.target.value })}
              className="font-mono text-xs"
              placeholder="gpt-4o-mini"
            />
            <Button variant="outline" onClick={() => void loadModels()} disabled={loadingModels}>
              {loadingModels && <Loader2Icon className="size-4 animate-spin" />}
              Загрузить список
            </Button>
          </div>
          {modelsError && <p className="text-xs text-red-600 dark:text-red-400">{modelsError}</p>}
          {models.length > 0 && (
            <Select value={ai.model} onValueChange={(value) => patchAi({ model: String(value) })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите модель" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="font-mono text-xs">{model.id}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{model.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="temperature">Температура</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={ai.temperature}
              onChange={(e) => patchAi({ temperature: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="max-tokens">Макс. токенов ответа</Label>
            <Input
              id="max-tokens"
              type="number"
              min="256"
              value={ai.max_tokens}
              onChange={(e) => patchAi({ max_tokens: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="max-rounds">Макс. шагов инструментов</Label>
            <Input
              id="max-rounds"
              type="number"
              min="1"
              max="30"
              value={ai.max_tool_rounds}
              onChange={(e) => patchAi({ max_tool_rounds: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="system-prompt">Системный промпт (необязательно)</Label>
          <Textarea
            id="system-prompt"
            value={ai.system_prompt}
            onChange={(e) => patchAi({ system_prompt: e.target.value })}
            placeholder="Оставьте пустым, чтобы использовать встроенный"
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
            Сохранить
          </Button>
          {status && (
            <span
              className={
                status.kind === "ok"
                  ? "inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400"
                  : "inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400"
              }
            >
              {status.kind === "ok" ? <CheckCircle2Icon className="size-4" /> : <XCircleIcon className="size-4" />}
              {status.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function emptyDevice() {
  return {
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
}

function DevicesForm() {
  const { devices, create, update, remove, check, reload } = useDevices()
  const [draft, setDraft] = React.useState(emptyDevice())
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  function startEdit(device: Device) {
    setEditingId(device.id)
    setDraft({
      name: device.name,
      host: device.host,
      port: device.port,
      username: device.username,
      password: "",
      wan_iface: device.wan_iface ?? "",
      lan_iface: device.lan_iface ?? "",
      location: device.location ?? "",
      enabled: device.enabled,
    })
    setStatus(null)
  }

  async function save() {
    if (!draft.host) {
      setStatus("Укажите адрес роутера")
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      if (editingId) {
        await update(editingId, draft)
      } else {
        await create(draft)
      }
      setDraft(emptyDevice())
      setEditingId(null)
      setStatus("Сохранено")
      await reload()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setBusy(false)
    }
  }

  async function test(device: Device) {
    setBusy(true)
    setStatus(`Проверяю ${device.name}…`)
    try {
      const res = await check(device.id)
      setStatus(res.ok ? `Подключение OK: ${JSON.stringify(res.parsed)}` : `Ошибка: ${res.error}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Ошибка проверки")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Роутеры</CardTitle>
          <CardDescription>{devices.length} устройств в системе</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
            >
              <span
                className={
                  device.connected
                    ? "size-2 rounded-full bg-emerald-500"
                    : "size-2 rounded-full bg-red-500"
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {device.name}
                  {!device.enabled && <Badge variant="secondary">выключен</Badge>}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {device.username}@{device.host}:{device.port}
                  {device.location ? ` · ${device.location}` : ""}
                </div>
                {device.last_error && (
                  <div className="text-xs text-red-600 dark:text-red-400">{device.last_error}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void test(device)} disabled={busy}>
                  Проверить
                </Button>
                <Button variant="outline" size="sm" onClick={() => startEdit(device)}>
                  Изменить
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Удалить роутер «${device.name}»?`)) void remove(device.id)
                  }}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {devices.length === 0 && (
            <p className="text-sm text-muted-foreground">Роутеров пока нет — добавьте первый ниже.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Изменить роутер" : "Добавить роутер"}</CardTitle>
          <CardDescription>SSH (stelnet) доступ с правами администратора</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Название</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Офис, 2 этаж"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Расположение</Label>
              <Input
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Москва"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Адрес</Label>
              <Input
                value={draft.host}
                onChange={(e) => setDraft({ ...draft, host: e.target.value })}
                placeholder="192.168.1.1"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Порт SSH</Label>
              <Input
                type="number"
                value={draft.port}
                onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Пользователь</Label>
              <Input
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Пароль {editingId && <span className="text-muted-foreground">(пусто — оставить прежний)</span>}</Label>
              <Input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>WAN-интерфейс</Label>
              <Input
                value={draft.wan_iface}
                onChange={(e) => setDraft({ ...draft, wan_iface: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>LAN-интерфейс</Label>
              <Input
                value={draft.lan_iface}
                onChange={(e) => setDraft({ ...draft, lan_iface: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.enabled}
              onCheckedChange={(checked) => setDraft({ ...draft, enabled: Boolean(checked) })}
            />
            <span className="text-sm">Опрашивать это устройство</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={busy}>
              {editingId ? <SaveIcon className="size-4" /> : <PlusIcon className="size-4" />}
              {editingId ? "Сохранить" : "Добавить"}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null)
                  setDraft(emptyDevice())
                }}
              >
                Отмена
              </Button>
            )}
            {status && <span className="text-sm text-muted-foreground">{status}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <>
      <SiteHeader breadcrumbs={[{ title: "monini" }, { title: "Настройки" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Настройки</h1>
          <p className="text-sm text-muted-foreground">ИИ-ассистент и роутеры</p>
        </div>
        <Tabs defaultValue="ai">
          <TabsList>
            <TabsTrigger value="ai">ИИ-ассистент</TabsTrigger>
            <TabsTrigger value="devices">
              <RouterIcon className="size-4" />
              Роутеры
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="pt-4">
            <AiSettingsForm />
          </TabsContent>
          <TabsContent value="devices" className="pt-4">
            <DevicesForm />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
