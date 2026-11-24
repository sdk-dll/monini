// API types for devices, settings and the AI agent.

export type Device = {
  id: string
  name: string
  host: string
  port: number
  username: string
  wan_iface?: string
  lan_iface?: string
  location?: string
  enabled: boolean
  created_at: number
  password_masked: string
  has_password: boolean
  connected: boolean
  last_ok: number | null
  last_error: string | null
  poller: {
    runs: number
    failures: number
    last_duration: number | null
    started: number
    last_error: string | null
  } | null
}

export type DeviceInput = {
  name: string
  host: string
  port: number
  username: string
  password?: string
  wan_iface?: string
  lan_iface?: string
  location?: string
  enabled: boolean
}

export type AiSettings = {
  base_url: string
  model: string
  temperature: number
  max_tokens: number
  max_tool_rounds: number
  system_prompt: string
  api_key_masked: string
  has_api_key: boolean
}

export type Settings = { ai: AiSettings }

export type AiModel = {
  id: string
  name: string
  supports_tools: boolean
  context_window: number | null
}

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type ToolCall = {
  id: string
  name: string
  arguments: unknown
  status: "running" | "done" | "error"
  result?: string
  tookMs?: number
}
