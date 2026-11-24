"""Device registry + settings storage for monini.

Keeps a list of routers (id, name, host, credentials, poll interval) in SQLite,
so the UI can switch between them and the poller can monitor several at once.
Secrets are masked in every API response; only the backend sees plaintext.
"""
from __future__ import annotations

import json
import os
import secrets
import sqlite3
import threading
import time
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    wan_iface TEXT,
    lan_iface TEXT,
    location TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

DEFAULT_SETTINGS: dict[str, Any] = {
    "ai": {
        "base_url": os.environ.get("MONINI_AI_BASE_URL", "https://ru.cheapvibecode.ru/v1"),
        "api_key": os.environ.get("MONINI_AI_API_KEY", ""),
        "model": os.environ.get("MONINI_AI_MODEL", "deepseek-v4.1-flash-1017"),
        "temperature": 0.2,
        "max_tokens": 2048,
        "max_tool_rounds": 8,
        "system_prompt": "",
    }
}


def _mask(secret: str) -> str:
    if not secret:
        return ""
    if len(secret) <= 8:
        return "*" * len(secret)
    return f"{secret[:6]}…{secret[-4:]}"


class Registry:
    def __init__(self, path: str) -> None:
        self.path = path
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()
        self._seed_default_device()

    # -- devices -----------------------------------------------------------
    def _seed_default_device(self) -> None:
        if self.list_devices(raw=True):
            return
        import huawei_mon as hm  # local import to avoid a cycle

        self.add_device(
            {
                "id": "default",
                "name": f"Default {hm.HOST}",
                "host": hm.HOST,
                "port": hm.PORT,
                "username": hm.USERNAME,
                "password": hm.PASSWORD,
                "wan_iface": os.environ.get("HUAWEI_WAN_IFACE", "GigabitEthernet0/0/0"),
                "lan_iface": os.environ.get("HUAWEI_LAN_IFACE", "Vlanif100"),
                "location": "",
                "enabled": True,
            }
        )

    def list_devices(self, raw: bool = False) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM devices ORDER BY created_at").fetchall()
        items = [dict(r) for r in rows]
        return items if raw else [self.public(d) for d in items]

    def get_device(self, device_id: str, raw: bool = False) -> dict | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
        if row is None:
            return None
        item = dict(row)
        return item if raw else self.public(item)

    def add_device(self, data: dict) -> dict:
        device_id = data.get("id") or secrets.token_hex(6)
        row = (
            device_id,
            data.get("name") or data["host"],
            data["host"],
            int(data.get("port") or 22),
            data.get("username") or "admin",
            data.get("password") or "",
            data.get("wan_iface") or "",
            data.get("lan_iface") or "",
            data.get("location") or "",
            1 if data.get("enabled", True) else 0,
            time.time(),
        )
        with self._lock:
            self._conn.execute("INSERT OR REPLACE INTO devices VALUES (?,?,?,?,?,?,?,?,?,?,?)", row)
            self._conn.commit()
        return self.get_device(device_id) or {}

    def update_device(self, device_id: str, data: dict) -> dict | None:
        current = self.get_device(device_id, raw=True)
        if not current:
            return None
        merged = {**current, **{k: v for k, v in data.items() if v is not None}}
        # an empty password in an update means "keep the stored one"
        if not data.get("password"):
            merged["password"] = current["password"]
        merged["id"] = device_id
        return self.add_device(merged)

    def delete_device(self, device_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute("DELETE FROM devices WHERE id=?", (device_id,))
            self._conn.commit()
        return cur.rowcount > 0

    def public(self, device: dict) -> dict:
        out = {k: v for k, v in device.items() if k != "password"}
        out["password_masked"] = _mask(device.get("password", ""))
        out["has_password"] = bool(device.get("password"))
        out["enabled"] = bool(device.get("enabled"))
        return out

    # -- settings ----------------------------------------------------------
    def get_settings(self) -> dict:
        with self._lock:
            rows = self._conn.execute("SELECT key, value FROM settings").fetchall()
        stored = {r["key"]: json.loads(r["value"]) for r in rows}
        out = json.loads(json.dumps(DEFAULT_SETTINGS))
        for key, value in stored.items():
            if isinstance(value, dict) and isinstance(out.get(key), dict):
                out[key].update(value)
            else:
                out[key] = value
        return out

    def update_settings(self, patch: dict) -> dict:
        # Accept both {"ai": {...}} and a flattened {...} payload (the UI sends
        # the nested form; older clients sent it flat).
        if "ai" not in patch:
            ai_keys = set(DEFAULT_SETTINGS["ai"])
            if ai_keys & set(patch):
                patch = {"ai": {k: v for k, v in patch.items() if k in ai_keys}}
        current = self.get_settings()
        for key, value in patch.items():
            if isinstance(value, dict) and isinstance(current.get(key), dict):
                current[key].update(value)
            else:
                current[key] = value
        with self._lock:
            for key, value in current.items():
                self._conn.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                    (key, json.dumps(value)),
                )
            self._conn.commit()
        return current

    def public_settings(self) -> dict:
        settings = self.get_settings()
        ai = dict(settings.get("ai") or {})
        ai["api_key_masked"] = _mask(ai.get("api_key", ""))
        ai["has_api_key"] = bool(ai.get("api_key"))
        ai.pop("api_key", None)
        settings = dict(settings)
        settings["ai"] = ai
        return settings
