"""Tool-calling AI agent for monini.

Talks to any OpenAI-compatible endpoint (/chat/completions), lets the model
call read-only tools (snapshots, history, logs, raw VRP commands) and streams
the whole trace to the UI as Server-Sent Events.

Nothing here is device-specific: the caller injects:
  * `settings`      – base_url / api_key / model / limits,
  * `device`        – the router currently selected in the UI,
  * `tools_impl`    – callables implementing the tool names below.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, AsyncIterator, Awaitable, Callable

import httpx

ToolImpl = Callable[[dict], Awaitable[str]]

# ---------------------------------------------------------------------------
# Tool catalogue (JSON-schema, OpenAI tools format)
# ---------------------------------------------------------------------------
TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_snapshot",
            "description": (
                "Текущий полный снапшот роутера: CPU, память, температура, интерфейсы, "
                "IP-интерфейсы, маршруты, ARP, MAC-таблица, DHCP-пулы, LLDP, WAN/lan "
                "счётчики, сводка и последние ошибки сбора."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "device_id": {"type": "string", "description": "ID устройства; по умолчанию выбранный"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_history",
            "description": (
                "История замеров с шагом опроса. Поля: cpu, mem_percent, wan_in_bps, "
                "wan_out_bps, wan_in_pps, wan_out_pps, dhcp_used, mac_entries, "
                "ifaces_up, ifaces_total, alarms, wan_rx_errors, wan_tx_errors."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "minutes": {"type": "integer", "description": "Окно назад в минутах", "default": 60},
                    "fields": {"type": "string", "description": "Список полей через запятую"},
                    "limit": {"type": "integer", "description": "Максимум точек", "default": 200},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_logs",
            "description": "Поиск по журналу устройства (SQLite, накопленный). Фильтры: модуль, минимальная важность, подстрока.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Подстрока в тексте сообщения"},
                    "module": {"type": "string", "description": "Модуль, например DHCP или LLDP"},
                    "severity_max": {"type": "integer", "description": "Только сообщения важнее этого уровня (1..8)"},
                    "minutes": {"type": "integer", "description": "Окно назад в минутах", "default": 1440},
                    "limit": {"type": "integer", "description": "Сколько строк вернуть", "default": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_alerts",
            "description": "Активные и недавние алерты монитора (CPU, память, падение интерфейсов, температура, NTP).",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 50}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_devices",
            "description": "Все роутеры в системе и их состояние (подключён, последняя ошибка, статистика опроса).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": (
                "Выполнить команду только для чтения на роутере (display …/ping/tracert). "
                "Используй, когда нужно уточнить конфигурацию или детальные счётчики."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Например: display interface GigabitEthernet0/0/0"},
                    "device_id": {"type": "string", "description": "ID устройства; по умолчанию выбранный"},
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "export_report",
            "description": (
                "Сформировать отчёт по собранным данным (без выполнения на роутере): "
                "сводка по устройству, аномалии, рекомендации. Возвращает текст, который "
                "можно вставить в итоговый ответ."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "minutes": {"type": "integer", "description": "Окно анализа", "default": 1440},
                },
            },
        },
    },
]

SAFE_COMMAND = re.compile(r"^(display |ping |tracert )", re.I)
FORBIDDEN = re.compile(
    r"\b(reset|reboot|undo|delete|save|format|shutdown|startup|rename|set|copy|ftp|tftp|reload)\b",
    re.I,
)

DEFAULT_SYSTEM_PROMPT = """Ты — сетевой инженер-ассистент в панели monini и наблюдаешь за роутерами Huawei (VRP).
Отвечай по-русски, кратко и по делу.

Правила:
1. Опирайся только на данные из инструментов. Не выдумывай цифры, адреса и имена.
2. Если данных не хватает — вызови подходящий инструмент, а не спрашивай пользователя.
3. Используй run_command только для команд чтения (display/ping/tracert).
4. В диагностике давай конкретику: что произошло, в каком интерфейсе или пуле,
   за какое окно времени, и что проверить дальше.
5. В конце ответа — блок «Что сделать» с 1–3 приоритетными действиями, если есть проблема.
6. Не раскрывай пароли и ключи из настроек.
"""


def command_allowed(command: str) -> tuple[bool, str]:
    command = (command or "").strip()
    if not command:
        return False, "пустая команда"
    if not SAFE_COMMAND.match(command):
        return False, "разрешены только display / ping / tracert"
    if FORBIDDEN.search(command):
        return False, "команда изменяет конфигурацию и запрещена"
    return True, ""


def _sse(event: str, payload: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"


async def run_agent(
    *,
    settings: dict,
    messages: list[dict],
    device_id: str | None,
    tools_impl: dict[str, ToolImpl],
) -> AsyncIterator[str]:
    """Yield SSE frames: meta → tool events → token deltas → done."""

    base_url = (settings.get("base_url") or "").rstrip("/")
    api_key = settings.get("api_key") or ""
    model = settings.get("model") or "gpt-4o-mini"
    max_rounds = int(settings.get("max_tool_rounds") or 8)
    temperature = float(settings.get("temperature") if settings.get("temperature") is not None else 0.2)
    max_tokens = int(settings.get("max_tokens") or 2048)
    system_prompt = settings.get("system_prompt") or DEFAULT_SYSTEM_PROMPT

    if not base_url or not api_key:
        yield _sse("error", {"message": "ИИ не настроен: укажите endpoint и API-ключ в настройках."})
        return

    history: list[dict] = [{"role": "system", "content": system_prompt}, *messages]
    yield _sse("meta", {"model": model, "endpoint": base_url, "device_id": device_id})

    body_common = dict(model=model, tools=TOOLS, tool_choice="auto", temperature=temperature)
    used_tools: list[str] = []

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=20.0)) as client:
        for round_index in range(max_rounds):
            body = {**body_common, "messages": history, "stream": True, "max_tokens": max_tokens}
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            content_parts: list[str] = []
            tool_calls: dict[int, dict] = {}
            finish_reason = None

            try:
                async with client.stream(
                    "POST", f"{base_url}/chat/completions", json=body, headers=headers
                ) as resp:
                    if resp.status_code >= 400:
                        detail = (await resp.aread()).decode(errors="replace")[:800]
                        yield _sse("error", {"message": f"HTTP {resp.status_code}: {detail}"})
                        return
                    async for raw_line in resp.aiter_lines():
                        if not raw_line or not raw_line.startswith("data:"):
                            continue
                        data = raw_line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            continue
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        choice = choices[0]
                        finish_reason = choice.get("finish_reason") or finish_reason
                        delta = choice.get("delta") or {}
                        text = delta.get("content")
                        if text:
                            content_parts.append(text)
                            yield _sse("delta", {"text": text})
                        for call in delta.get("tool_calls") or []:
                            idx = call.get("index", 0)
                            slot = tool_calls.setdefault(
                                idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
                            )
                            if call.get("id"):
                                slot["id"] = call["id"]
                            fn = call.get("function") or {}
                            if fn.get("name"):
                                slot["function"]["name"] += fn["name"]
                            if fn.get("arguments"):
                                slot["function"]["arguments"] += fn["arguments"]
            except (httpx.HTTPError, asyncio.TimeoutError) as exc:
                yield _sse("error", {"message": f"Ошибка соединения с ИИ: {exc}"})
                return

            assistant_msg: dict[str, Any] = {
                "role": "assistant",
                "content": "".join(content_parts) or None,
            }
            if tool_calls:
                assistant_msg["tool_calls"] = [tool_calls[k] for k in sorted(tool_calls)]
            history.append(assistant_msg)

            if not tool_calls:
                yield _sse(
                    "done",
                    {
                        "content": "".join(content_parts),
                        "finish_reason": finish_reason,
                        "rounds": round_index + 1,
                        "tools_used": used_tools,
                    },
                )
                return

            for slot in (tool_calls[k] for k in sorted(tool_calls)):
                name = slot["function"]["name"]
                raw_args = slot["function"]["arguments"] or "{}"
                try:
                    args = json.loads(raw_args) if raw_args.strip() else {}
                except json.JSONDecodeError:
                    args = {}
                used_tools.append(name)
                started = time.time()
                yield _sse("tool_start", {"id": slot["id"], "name": name, "arguments": args})
                impl = tools_impl.get(name)
                if impl is None:
                    result = json.dumps({"error": f"unknown tool {name}"}, ensure_ascii=False)
                else:
                    try:
                        result = await impl(args)
                    except Exception as exc:  # noqa: BLE001
                        result = json.dumps(
                            {"error": f"{type(exc).__name__}: {exc}"}, ensure_ascii=False
                        )
                took_ms = int((time.time() - started) * 1000)
                yield _sse(
                    "tool_result",
                    {"id": slot["id"], "name": name, "took_ms": took_ms, "result": result[:20_000]},
                )
                history.append(
                    {"role": "tool", "tool_call_id": slot["id"], "name": name, "content": result[:20_000]}
                )

        yield _sse("error", {"message": f"Достигнут лимит шагов ({max_rounds}); модель продолжает звать инструменты."})


async def list_models(settings: dict) -> list[dict]:
    base_url = (settings.get("base_url") or "").rstrip("/")
    api_key = settings.get("api_key") or ""
    if not base_url or not api_key:
        raise ValueError("ИИ не настроен: укажите endpoint и API-ключ")
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{base_url}/models", headers={"Authorization": f"Bearer {api_key}"}
        )
        resp.raise_for_status()
        data = resp.json()
    items = []
    for model in data.get("data") or []:
        items.append(
            {
                "id": model.get("id"),
                "name": model.get("display_name") or model.get("id"),
                "supports_tools": model.get("supports_tools", True),
                "context_window": model.get("context_window"),
            }
        )
    return sorted(items, key=lambda m: (not m["supports_tools"], m["id"] or ""))
