#!/usr/bin/env python3
"""
Huawei device monitor backend (stelnet/SSH, legacy DH-group14-sha1).

Architecture
------------
  SSH worker thread (single session, serialized)  ->  poller thread
        |                                               |
        +--> run_command(cmd)                        collects full snapshot
                                                         |
                       storage (SQLite history + ring buffer)  <-- HTTP API
                                                                   |
                                                              FastAPI app
                                                          (JSON + web UI + SSE)

Run:
  .venv/bin/python backend.py                          # 0.0.0.0:8080
  .venv/bin/python backend.py --host 127.0.0.1 --port 9000 --interval 15

Env (all optional):
  HUAWEI_HOST, HUAWEI_USER, HUAWEI_PASS, HUAWEI_PORT
  HUAWEI_POLL_INTERVAL   seconds between snapshots (default 15)
  MONINI_DB              sqlite path (default ./monini.db)
  MONINI_ADMIN_USER/PASS basic auth for the API (default admin / gfhvexVfr1)
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import io
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import traceback
from collections import deque
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Iterator

import paramiko
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials

# network helpers / parsers live in huawei_mon.py (proven against AP4050DN)
import huawei_mon as hm
import agent
from devices import DeviceManager, DeviceRuntime
from registry import Registry

HOST = hm.HOST
POLL_INTERVAL = float(os.environ.get("HUAWEI_POLL_INTERVAL", "60"))
DB_PATH = os.environ.get("MONINI_DB", os.path.join(os.path.dirname(__file__), "monini.db"))
ADMIN_USER = os.environ.get("MONINI_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("MONINI_ADMIN_PASS", hm.PASSWORD)
LOG_HISTORY = 5000  # log lines kept in memory


# ============================================================================
# Additional parsers (complements huawei_mon.py)
# ============================================================================
def _int(value: str | None, default: int = 0) -> int:
    try:
        return int(value) if value is not None else default
    except ValueError:
        return default


def parse_clock(text: str) -> dict:
    info: dict = {}
    m = re.search(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", text, re.M)
    if m:
        info["device_time"] = m.group(1)
    m = re.search(r"Time Zone\(([^)]*)\)\s*:\s*(\S+)", text)
    if m:
        info["timezone_name"] = m.group(1)
        info["timezone"] = m.group(2)
    return info


def parse_interface_detail(text: str) -> dict:
    info: dict = {}
    for key, pat, cast in (
        ("state", r"current state\s*:\s*(\S+)", str),
        ("line_protocol", r"Line protocol current state\s*:\s*(\S+)", str),
        ("mac", r"Hardware address is ([\w-]+)", str),
        ("speed", r"Speed\s*:\s*(\S+)", str),
        ("duplex", r"Duplex:\s*(\w+)", str),
        ("negotiation", r"Negotiation:\s*(\w+)", str),
        ("last_up", r"Last physical up time\s*:\s*(.+?)\s{2,}", str),
        ("last_down", r"Last physical down time\s*:\s*(.+?)\s{2,}", str),
        ("in_bps", r"input rate (\d+) bits/sec", int),
        ("in_pps", r"input rate \d+ bits/sec, (\d+) packets/sec", int),
        ("out_bps", r"output rate (\d+) bits/sec", int),
        ("out_pps", r"output rate \d+ bits/sec, (\d+) packets/sec", int),
        ("in_peak_bps", r"Input peak rate (\d+) bits/sec", int),
        ("out_peak_bps", r"Output peak rate (\d+) bits/sec", int),
        ("rx_unicast", r"^\s+Unicast:\s+(\d+)", int),
        ("rx_multicast", r"^\s+Multicast:\s+(\d+)", int),
        ("rx_broadcast", r"^\s+Broadcast:\s+(\d+)", int),
        ("rx_jumbo", r"^\s+Jumbo:\s+(\d+)", int),
        ("rx_discard", r"^\s+Discard:\s+(\d+)", int),
        ("rx_errors", r"^\s+Total Error:\s+(\d+)", int),
        ("tx_unicast", r"^\s+Unicast:\s+(\d+)", int),
    ):
        if key == "tx_unicast":
            continue
        m = re.search(pat, text, re.M)
        if m:
            info[key] = cast(m.group(1))
    # Output section: Unicast/Multicast/Broadcast under "Output:"
    out = text.split("Output:", 1)
    if len(out) == 2:
        for key, pat in (
            ("tx_unicast", r"^\s+Unicast:\s+(\d+)"),
            ("tx_multicast", r"^\s+Multicast:\s+(\d+)"),
            ("tx_broadcast", r"^\s+Broadcast:\s+(\d+)"),
            ("tx_jumbo", r"^\s+Jumbo:\s+(\d+)"),
            ("tx_discard", r"^\s+Discard:\s+(\d+)"),
            ("tx_errors", r"^\s+Total Error:\s+(\d+)"),
        ):
            m = re.search(pat, out[1], re.M)
            if m:
                info[key] = int(m.group(1))
    return info


def parse_ip_interface_counters(text: str) -> dict:
    info: dict = {}
    for key, pat in (
        ("v4_rx_packets", r"input packets\s*:\s*(\d+)"),
        ("v4_rx_bytes", r"input packets\s*:\s*\d+,\s*bytes\s*:\s*(\d+)"),
        ("v4_tx_packets", r"output packets\s*:\s*(\d+)"),
        ("v4_tx_bytes", r"output packets\s*:\s*\d+,\s*bytes\s*:\s*(\d+)"),
    ):
        m = re.search(pat, text)
        if m:
            info[key] = int(m.group(1))
    m = re.search(r"Internet Address is\s*(\S+)", text)
    if m:
        info["ip"] = m.group(1)
    return info


def parse_logbuffer(text: str) -> dict:
    """`display logbuffer` -> {stats:{...}, entries:[...]} newest last."""
    stats = {}
    for key, pat in (
        ("max_size", r"Allowed max buffer size:\s*(\d+)"),
        ("buffer_size", r"Actual buffer size:\s*(\d+)"),
        ("dropped", r"Dropped messages:\s*(\d+)"),
        ("overwritten", r"Overwritten messages:\s*(\d+)"),
        ("current", r"Current messages:\s*(\d+)"),
    ):
        m = re.search(pat, text)
        if m:
            stats[key] = int(m.group(1))
    entries = []
    for line in text.splitlines():
        m = re.match(
            r"^(?P<ts>[A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2}\.\d+\S*\s*)\S*\s*"
            r"%%\d*(?P<module>[\w-]+)/(?P<sev>\d)/(?P<code>[\w-]+)"
            r"(?:\((?P<kind>\w+)\))?\[(?P<idx>\d+)\]:(?P<msg>.*)$",
            line.strip(),
        )
        if m:
            entries.append(m.groupdict())
    return {"stats": stats, "entries": entries}


def parse_trapbuffer(text: str) -> list[dict]:
    entries = []
    for line in text.splitlines():
        s = line.strip().lstrip("#")
        m = re.match(
            r"^(?P<ts>[A-Z][a-z]{2} \d{2} \d{4} \S+)\s+\S+\s+"
            r"(?P<module>[\w-]+)/(?P<sev>\d)/(?P<code>[\w-]+)\s*:\s*(?P<msg>.*)$",
            s,
        )
        if m:
            entries.append(m.groupdict())
    return entries


def parse_temperature(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        m = re.match(
            r"^\s*(?P<slot>\d+)\s+(?P<card>\S+)\s+(?P<sensor>\d+)\s+"
            r"(?P<name>.+?)\s{2,}(?P<status>\S+)\s+(?P<upper>-?\d+)\s+(?P<lower>-?\d+)\s+(?P<temp>-?\d+|--)",
            line,
        )
        if m:
            rec = m.groupdict()
            rec["temp"] = int(rec["temp"]) if rec["temp"].lstrip("-").isdigit() else None
            rec["upper"] = int(rec["upper"])
            rec["lower"] = int(rec["lower"])
            out.append(rec)
    return out


def parse_pools(text: str) -> list[dict]:
    """`display ip pool` -> per-pool statistics."""
    pools = []
    blocks = re.split(r"\n(?=-{10,}\n\s*Pool-name)", text)
    for block in blocks:
        if "Pool-name" not in block:
            continue
        rec: dict = {}
        for key, pat in (
            ("name", r"Pool-name\s*:\s*(\S+)"),
            ("no", r"Pool-No\s*:\s*(\d+)"),
            ("lease", r"Lease\s*:\s*(.+)"),
            ("gateway", r"Gateway-0\s*:\s*(\S+)"),
            ("network", r"Network\s*:\s*(\S+)"),
            ("mask", r"Mask\s*:\s*(\S+)"),
            ("status", r"Status\s*:\s*(\S+)"),
            ("total", r"Total\s*:\s*(\d+)"),
            ("used", r"Used\s*:\s*(\d+)"),
            ("idle", r"Idle\s*:\s*(\d+)"),
            ("expired", r"Expired\s*:\s*(\d+)"),
            ("conflict", r"Conflict\s*:\s*(\d+)"),
        ):
            m = re.search(pat, block)
            if m:
                val = m.group(1).strip()
                rec[key] = int(val) if key in ("no", "total", "used", "idle", "expired", "conflict") else val
        if rec:
            pools.append(rec)
    return pools


def parse_mac_table(text: str) -> list[dict]:
    out = []
    pat = re.compile(
        r"^(?P<mac>[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4})\s+"
        r"(?P<vlan>\d+)/\S*\s+(?P<port>\S+)\s+(?P<type>\w+)"
    )
    total = None
    m = re.search(r"Total items displayed\s*=\s*(\d+)", text)
    if m:
        total = int(m.group(1))
    for line in text.splitlines():
        m = pat.match(line.strip())
        if m:
            rec = m.groupdict()
            rec["mac"] = rec["mac"].lower()
            rec["vlan"] = int(rec["vlan"])
            out.append(rec)
    return out, total


def parse_lldp(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        m = re.match(
            r"^(?P<local>\S+)\s+(?P<neighbor>\S.*?)\s+(?P<port>\S+)\s+(?P<ttl>\d+)\s*$",
            line,
        )
        if m and m.group("local").upper().startswith(("GE", "ETH", "XGE", "VLANIF", "WLAN")):
            out.append(m.groupdict())
    return out


def parse_ssh_status(text: str) -> dict:
    info = {}
    for key, pat in (
        ("version", r"SSH version\s*:\s*(\S+)"),
        ("timeout", r"SSH connection timeout\s*:\s*(\d+)"),
        ("auth_retries", r"SSH Authentication retries\s*:\s*(\d+)"),
        ("stelnet", r"Stelnet server\s*:\s*(\w+)"),
        ("sftp", r"SFTP Server\s*:\s*(\w+)"),
    ):
        m = re.search(pat, text)
        if m:
            info[key] = m.group(1)
    return info


def parse_vlans(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        m = re.match(r"^(?P<id>\d+)\s+(?P<type>\w+)\s+(?P<status>\w+)", line.strip())
        if m:
            out.append({"id": int(m.group("id")), "type": m.group("type"), "status": m.group("status")})
    return out


def parse_hardware_identity(text: str) -> dict:
    """`display elabel`."""
    info: dict = {}
    for key in ("BoardType", "BarCode", "Description", "Manufactured", "VendorName", "Model", "Item"):
        m = re.search(rf"^{key}=(.+)$", text, re.M)
        if m:
            info[key[0].lower() + key[1:]] = m.group(1).strip()
    return info


def parse_dns(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        m = re.match(r"^(?P<no>\d+)\s+(?P<type>[DS])\s+(?P<status>\w+)\s+(?P<used>\w+)\s+(?P<ip>\d+\.\d+\.\d+\.\d+)", line.strip())
        if m:
            out.append(m.groupdict())
    return out


def parse_ntp(text: str) -> dict:
    info = {}
    for key, pat in (
        ("sync_state", r"clock status:\s*(\S+)"),
        ("stratum", r"clock stratum:\s*(\d+)"),
        ("ref_id", r"reference clock ID:\s*(\S+)"),
        ("precision", r"clock precision:\s*(\S+)"),
        ("offset_ms", r"clock offset:\s*([\d.-]+)"),
        ("root_delay_ms", r"root delay:\s*([\d.-]+)"),
    ):
        m = re.search(pat, text)
        if m:
            info[key] = m.group(1)
    return info


# ============================================================================
# Snapshot collection (all commands run on the shared shell)
# ============================================================================
@dataclass
class Spec:
    key: str
    command: str


SNAPSHOT_SPECS: tuple[Spec, ...] = (
    Spec("version", "display version"),
    Spec("clock", "display clock"),
    Spec("cpu", "display cpu-usage"),
    Spec("memory", "display memory-usage"),
    Spec("temperature", "display temperature all"),
    Spec("interfaces_brief", "display interface brief"),
    Spec("ip_interfaces_brief", "display ip interface brief"),
    Spec("routes", "display ip routing-table"),
    Spec("arp", "display arp"),
    Spec("mac_table", "display mac-address"),
    Spec("lldp", "display lldp neighbor brief"),
    Spec("pools", "display ip pool"),
    Spec("vlans", "display vlan"),
    Spec("dns", "display dns server"),
    Spec("ntp", "display ntp-service status"),
    Spec("ssh", "display ssh server status"),
    Spec("alarms", "display alarm active"),
)

# Heavy/rarely-changing data: fetched on a slower cadence and cached.
SLOW_SPECS: tuple[Spec, ...] = (
    Spec("elabel", "display elabel"),
    Spec("logbuffer", "display logbuffer"),
    Spec("trapbuffer", "display trapbuffer"),
)

WAN_IFACE = os.environ.get("HUAWEI_WAN_IFACE", "GigabitEthernet0/0/0")
LAN_IFACE = os.environ.get("HUAWEI_LAN_IFACE", "Vlanif100")
SLOW_INTERVAL = float(os.environ.get("HUAWEI_SLOW_INTERVAL", "300"))


def collect_snapshot(runtime: "DeviceRuntime") -> dict:
    """Run every spec command and parse. Never raises; records per-command errors."""
    session = runtime.session
    device = runtime.device
    wan_iface = device.get("wan_iface") or WAN_IFACE
    lan_iface = device.get("lan_iface") or LAN_IFACE
    cache: dict[str, str] = runtime.slow_cache
    slow_last: dict[str, float] = runtime.slow_last
    started = time.time()
    raw: dict[str, str] = {}
    errors: dict[str, str] = {}
    for spec in SNAPSHOT_SPECS:
        try:
            raw[spec.key] = session.run(spec.command)
        except Exception as exc:  # noqa: BLE001
            raw[spec.key] = ""
            errors[spec.key] = f"{type(exc).__name__}: {exc}"
    # interface detail/counters need interface names, do them separately
    for key, cmd in (
        ("wan_detail", f"display interface {wan_iface}"),
        ("lan_counters", f"display ip interface {lan_iface}"),
    ):
        try:
            raw[key] = session.run(cmd)
        except Exception as exc:  # noqa: BLE001
            raw[key] = ""
            errors[key] = f"{type(exc).__name__}: {exc}"

    # slow-changing data (log/trap buffers are big and costly to read)
    now = time.time()
    for spec in SLOW_SPECS:
        fresh = (spec.key in slow_last
                 and now - slow_last[spec.key] < SLOW_INTERVAL
                 and spec.key in cache)
        if fresh:
            raw[spec.key] = cache[spec.key]
            continue
        try:
            cache[spec.key] = session.run(spec.command, timeout=60.0)
            slow_last[spec.key] = now
            raw[spec.key] = cache[spec.key]
        except Exception as exc:  # noqa: BLE001
            raw[spec.key] = cache.get(spec.key, "")
            errors[spec.key] = f"{type(exc).__name__}: {exc}"

    snap: dict[str, Any] = {
        "ts": started,
        "collected_in_s": round(time.time() - started, 3),
        "connected": session.connected,
        "device_id": device.get("id"),
        "device_name": device.get("name"),
        "errors": errors,
    }
    try:
        snap.update(hm.parse_version(raw["version"]))
        snap.update(parse_clock(raw["clock"]))
        snap.update(hm.parse_cpu(raw["cpu"]))
        snap.update(hm.parse_memory(raw["memory"]))
        snap["temperature"] = parse_temperature(raw["temperature"])
        snap["identity"] = parse_hardware_identity(raw["elabel"])
        snap["interfaces"] = hm.parse_interfaces(raw["interfaces_brief"])
        snap["ip_interfaces"] = hm.parse_ip_interfaces(raw["ip_interfaces_brief"])
        snap["routes"] = hm.parse_routes(raw["routes"])
        snap["arp"] = hm.parse_arp(raw["arp"])
        macs, mac_total = parse_mac_table(raw["mac_table"])
        snap["mac_table"] = macs
        snap["mac_total"] = mac_total
        snap["lldp"] = parse_lldp(raw["lldp"])
        snap["pools"] = parse_pools(raw["pools"])
        snap["vlans"] = parse_vlans(raw["vlans"])
        snap["dns"] = parse_dns(raw["dns"])
        snap["ntp"] = parse_ntp(raw["ntp"])
        snap["ssh"] = parse_ssh_status(raw["ssh"])
        snap["alarms"] = [l.strip() for l in raw["alarms"].splitlines() if l.strip()]
        log = parse_logbuffer(raw["logbuffer"])
        snap["log_stats"] = log["stats"]
        snap["log_recent"] = log["entries"][-50:]
        snap["traps_recent"] = parse_trapbuffer(raw["trapbuffer"])[-30:]
        snap["wan"] = parse_interface_detail(raw["wan_detail"])
        snap["lan"] = parse_ip_interface_counters(raw["lan_counters"])
        # derived metrics
        snap["wan"]["iface"] = wan_iface
        snap["lan"]["iface"] = lan_iface
        snap["summary"] = {
            "ifaces_up": sum(1 for i in snap["interfaces"] if i["phys"] == "up"),
            "ifaces_total": len(snap["interfaces"]),
            "routes": len(snap["routes"]),
            "arp_entries": len(snap["arp"]),
            "mac_entries": len(macs),
            "mac_total": mac_total,
            "lldp_neighbors": len(snap["lldp"]),
            "dhcp_used": sum(p.get("used", 0) for p in snap["pools"]),
            "dhcp_idle": sum(p.get("idle", 0) for p in snap["pools"]),
            "alarms": len(snap["alarms"]),
        }
    except Exception as exc:  # noqa: BLE001
        snap["parse_error"] = traceback.format_exc(limit=2)
        errors["parse"] = str(exc)
    if "--debug" in os.sys.argv:
        snap["raw"] = raw
    for entry in snap.get("log_recent", []):
        entry["snapshot_ts"] = started
    return snap


# ============================================================================
# Storage: SQLite metrics history + in-memory ring for logs/alerts
# ============================================================================
SCHEMA = """
CREATE TABLE IF NOT EXISTS samples (
    ts REAL PRIMARY KEY,
    cpu REAL, mem_percent REAL,
    wan_in_bps INTEGER, wan_out_bps INTEGER,
    wan_in_pps INTEGER, wan_out_pps INTEGER,
    wan_rx_errors INTEGER, wan_tx_errors INTEGER,
    dhcp_used INTEGER, mac_entries INTEGER,
    ifaces_up INTEGER, ifaces_total INTEGER,
    alarms INTEGER, uptime TEXT
);
CREATE INDEX IF NOT EXISTS samples_ts ON samples(ts);
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL, log_ts TEXT, module TEXT, severity INTEGER, code TEXT, msg TEXT
);
CREATE INDEX IF NOT EXISTS logs_ts ON logs(ts);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL, kind TEXT, severity TEXT, message TEXT, resolved INTEGER DEFAULT 0
);
"""


class Storage:
    def __init__(self, path: str) -> None:
        self.path = path
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()
        self.latest: dict | None = None
        self.history: deque[dict] = deque(maxlen=600)
        self.logs: deque[dict] = deque(maxlen=LOG_HISTORY)
        self.alerts: deque[dict] = deque(maxlen=500)
        self._active_alerts: dict[str, dict] = {}
        self.cond = threading.Condition()

    # -- write -------------------------------------------------------------
    def add(self, snap: dict) -> None:
        s = snap.get("summary", {})
        wan = snap.get("wan", {})
        row = (
            snap["ts"],
            snap.get("cpu_percent"),
            snap.get("mem_percent"),
            wan.get("in_bps"), wan.get("out_bps"),
            wan.get("in_pps"), wan.get("out_pps"),
            wan.get("rx_errors"), wan.get("tx_errors"),
            s.get("dhcp_used"), s.get("mac_entries"),
            s.get("ifaces_up"), s.get("ifaces_total"),
            s.get("alarms"), snap.get("uptime"),
        )
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO samples VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", row
            )
            new_logs = [
                (snap["ts"], e.get("ts"), e.get("module"), _int(e.get("sev")), e.get("code"), e.get("msg"))
                for e in snap.get("log_recent", [])
            ]
            # dedupe: insert only rows newer than the last stored log line
            last = self._conn.execute("SELECT MAX(ts) FROM logs").fetchone()[0]
            if last is None:
                to_insert = new_logs
            else:
                to_insert = [r for r in new_logs if r[0] >= last and r[1] and r[1] > (
                    self._conn.execute("SELECT MAX(log_ts) FROM logs").fetchone()[0] or ""
                )]
            if to_insert:
                self._conn.executemany(
                    "INSERT INTO logs (ts, log_ts, module, severity, code, msg) VALUES (?,?,?,?,?,?)",
                    to_insert,
                )
            self._conn.commit()
        self.latest = snap
        self.history.append({
            "ts": snap["ts"], "cpu": snap.get("cpu_percent"), "mem": snap.get("mem_percent"),
            "in_bps": wan.get("in_bps"), "out_bps": wan.get("out_bps"),
            "in_pps": wan.get("in_pps"), "out_pps": wan.get("out_pps"),
        })
        for entry in snap.get("log_recent", []):
            self.logs.append(entry)
        self._evaluate_alerts(snap)
        with self.cond:
            self.cond.notify_all()

    def _evaluate_alerts(self, snap: dict) -> None:
        checks: list[tuple[str, str, str, bool]] = []

        def add(kind: str, severity: str, message: str, active: bool) -> None:
            checks.append((kind, severity, message, active))

        cpu = snap.get("cpu_percent") or 0
        add("cpu", "warning" if cpu < 85 else "critical",
            f"CPU load {cpu}%", cpu >= 85)
        mem = snap.get("mem_percent") or 0
        add("memory", "warning", f"Memory usage {mem}%", mem >= 90)
        for iface in snap.get("interfaces", []):
            if iface["name"] in ("NULL0",) or iface["name"].startswith("Wlan-Radio"):
                continue
            add(f"iface:{iface['name']}", "critical",
                f"Interface {iface['name']} is {iface['phys']}/{iface['proto']}",
                iface["phys"] != "up" or iface["proto"].startswith("down"))
        for t in snap.get("temperature", []):
            if t.get("temp") is not None and t["temp"] >= t["upper"] - 10:
                add(f"temp:{t['name']}", "critical",
                    f"Sensor {t['name']} at {t['temp']}°C (limit {t['upper']}°C)", True)
        if snap.get("errors"):
            add("collect", "warning", f"Command errors: {list(snap['errors'])}", True)
        if not snap.get("ntp", {}).get("sync_state", "synchronized").startswith("sync"):
            add("ntp", "info", "NTP clock is not synchronized", True)

        now = time.time()
        for kind, severity, message, active in checks:
            current = self._active_alerts.get(kind)
            if active and current is None:
                alert = {"ts": now, "kind": kind, "severity": severity, "message": message, "resolved": False}
                self.alerts.append(alert)
                self._active_alerts[kind] = alert
                with self._lock:
                    self._conn.execute(
                        "INSERT INTO alerts (ts, kind, severity, message, resolved) VALUES (?,?,?,?,0)",
                        (now, kind, severity, message),
                    )
                    self._conn.commit()
            elif not active and current is not None:
                current["resolved"] = True
                current["resolved_ts"] = now
                self._active_alerts.pop(kind, None)
                with self._lock:
                    self._conn.execute(
                        "UPDATE alerts SET resolved=1 WHERE kind=? AND resolved=0", (kind,)
                    )
                    self._conn.commit()

    # -- read --------------------------------------------------------------
    def series(self, since: float, fields: list[str], limit: int = 5000) -> list[dict]:
        cols = ", ".join(["ts"] + [f for f in fields if f in {
            "cpu", "mem_percent", "wan_in_bps", "wan_out_bps", "wan_in_pps", "wan_out_pps",
            "dhcp_used", "mac_entries", "ifaces_up", "ifaces_total", "alarms",
            "wan_rx_errors", "wan_tx_errors",
        }])
        with self._lock:
            rows = self._conn.execute(
                f"SELECT {cols} FROM samples WHERE ts >= ? ORDER BY ts LIMIT ?", (since, limit)
            ).fetchall()
        return [dict(r) for r in rows]

    def query_logs(
        self, limit: int = 200, offset: int = 0, module: str | None = None,
        severity_max: int | None = None, search: str | None = None, since: float | None = None,
    ) -> dict:
        where, args = [], []
        if module:
            where.append("module = ?")
            args.append(module)
        if severity_max is not None:
            where.append("severity <= ?")
            args.append(severity_max)
        if search:
            where.append("msg LIKE ?")
            args.append(f"%{search}%")
        if since:
            where.append("ts >= ?")
            args.append(since)
        clause = ("WHERE " + " AND ".join(where)) if where else ""
        with self._lock:
            total = self._conn.execute(f"SELECT COUNT(*) FROM logs {clause}", args).fetchone()[0]
            rows = self._conn.execute(
                f"SELECT * FROM logs {clause} ORDER BY id DESC LIMIT ? OFFSET ?",
                (*args, limit, offset),
            ).fetchall()
        return {"total": total, "items": [dict(r) for r in rows]}

    def log_modules(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT module, COUNT(*) n, MIN(severity) min_sev FROM logs GROUP BY module ORDER BY n DESC"
            ).fetchall()
        return [dict(r) for r in rows]


STORE = Storage(DB_PATH)
REGISTRY = Registry(DB_PATH)
_STORES: dict[str, Storage] = {}


def store_for(device_id: str | None) -> Storage:
    """Each router keeps its own history/log database, so switching routers
    never mixes samples of different devices."""
    if not device_id or device_id == "default":
        return STORE
    store = _STORES.get(device_id)
    if store is None:
        path = os.path.join(os.path.dirname(DB_PATH), f"monini-{device_id}.db")
        store = _STORES[device_id] = Storage(path)
    return store


# ============================================================================
# Multi-device pollers
# ============================================================================
def _collect_and_store(runtime: DeviceRuntime) -> dict:
    """Poll one device, persist its snapshot and publish it as latest."""
    # Light commands the fast sampler reuses for live values.
    runtime.parsers.update(
        {"version": hm.parse_version, "cpu": hm.parse_cpu, "memory": hm.parse_memory}
    )
    snap = collect_snapshot(runtime)
    store = store_for(runtime.device["id"])
    store.add(snap)
    # The UI shows one device at a time; keep the newest snapshot overall.
    current = STORE.latest
    if current is None or snap.get("ts", 0) >= current.get("ts", 0):
        STORE.latest = snap
    return snap


DEVICES = DeviceManager(REGISTRY, POLL_INTERVAL, _collect_and_store)


def _runtime_for(device_id: str | None) -> DeviceRuntime:
    """Resolve a device runtime, defaulting to the first enabled router."""
    if not device_id:
        for device in REGISTRY.list_devices(raw=True):
            if device.get("enabled"):
                device_id = device["id"]
                break
    if not device_id:
        raise HTTPException(503, "No devices configured")
    runtime = DEVICES.get(device_id)
    if runtime is None:
        raise HTTPException(404, f"Device {device_id} is not running")
    return runtime


def _snapshot_for(device_id: str | None) -> dict:
    runtime = _runtime_for(device_id)
    snap = store_for(runtime.device["id"]).latest
    if not snap:
        raise HTTPException(503, "No data yet")
    return snap


# ============================================================================
# FastAPI app
# ============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    DEVICES.start()
    yield
    DEVICES.stop()


app = FastAPI(title="Monini — Huawei device monitor", version="1.0", lifespan=lifespan)
security = HTTPBasic(auto_error=False)


def require_auth(cred: HTTPBasicCredentials | None = Depends(security)) -> str:
    if not os.environ.get("MONINI_NO_AUTH") == "1":
        if cred is None or not (
            secrets.compare_digest(cred.username, ADMIN_USER)
            and secrets.compare_digest(cred.password, ADMIN_PASS)
        ):
            raise HTTPException(401, "Unauthorized", headers={"WWW-Authenticate": "Basic"})
    return cred.username if cred else "anon"


def _device_param(device: str | None, _: str = Depends(require_auth)) -> DeviceRuntime:
    return _runtime_for(device)


@app.get("/api/health")
def health() -> dict:
    runtimes = DEVICES.status()
    connected = [d for d in runtimes if d.get("connected")]
    return {
        "status": "ok",
        "devices": len(runtimes),
        "devices_connected": len(connected),
        "interval": DEVICES.interval,
        "latest_ts": STORE.latest["ts"] if STORE.latest else None,
    }


# -- devices ----------------------------------------------------------------
@app.get("/api/devices")
def list_devices(_: str = Depends(require_auth)) -> list[dict]:
    return DEVICES.status()


@app.post("/api/devices")
async def create_device(request: Request, _: str = Depends(require_auth)) -> dict:
    body = await request.json()
    if not body.get("host"):
        raise HTTPException(400, "host обязателен")
    device = REGISTRY.add_device(body)
    DEVICES.reload(device["id"])
    return device


@app.patch("/api/devices/{device_id}")
async def update_device(device_id: str, request: Request, _: str = Depends(require_auth)) -> dict:
    body = await request.json()
    device = REGISTRY.update_device(device_id, body)
    if device is None:
        raise HTTPException(404, "устройство не найдено")
    DEVICES.reload(device_id)
    return device


@app.delete("/api/devices/{device_id}")
def delete_device(device_id: str, _: str = Depends(require_auth)) -> dict:
    DEVICES.remove(device_id)
    if not REGISTRY.delete_device(device_id):
        raise HTTPException(404, "устройство не найдено")
    return {"deleted": device_id}


@app.post("/api/devices/{device_id}/check")
async def check_device(device_id: str, _: str = Depends(require_auth)) -> dict:
    """One-off connection test with the stored credentials."""
    device = REGISTRY.get_device(device_id, raw=True)
    if not device:
        raise HTTPException(404, "устройство не найдено")
    from devices import HuaweiSession

    session = HuaweiSession(device["host"], int(device["port"]), device["username"], device["password"])
    try:
        output = await asyncio.to_thread(session.run, "display version", 20.0)
        parsed = hm.parse_version(output)
        return {"ok": True, "parsed": parsed, "output": output[:2000]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
    finally:
        session.close()


# -- snapshot ---------------------------------------------------------------
@app.get("/api/overview")
def overview(device: str | None = None, _: str = Depends(require_auth)) -> dict:
    runtime = _runtime_for(device)
    latest = store_for(runtime.device["id"]).latest
    if not latest:
        raise HTTPException(503, "No data yet")
    snap = dict(latest)
    snap["poller"] = runtime.stats
    snap["active_alerts"] = list(store_for(runtime.device["id"])._active_alerts.values())
    return snap


@app.get("/api/system")
def system_info(device: str | None = None, _: str = Depends(require_auth)) -> dict:
    snap = _snapshot_for(device)
    return {
        "model": snap.get("model"),
        "vrp_version": snap.get("vrp_version"),
        "uptime": snap.get("uptime"),
        "sdram_mb": snap.get("sdram_mb"),
        "device_time": snap.get("device_time"),
        "timezone": snap.get("timezone"),
        "identity": snap.get("identity"),
        "cpu": snap.get("cpu_percent"),
        "cpu_max": snap.get("cpu_max_percent"),
        "mem_percent": snap.get("mem_percent"),
        "mem_used_kb": snap.get("mem_used_kb"),
        "mem_total_kb": snap.get("mem_total_kb"),
        "temperature": snap.get("temperature", []),
        "ntp": snap.get("ntp"),
        "ssh": snap.get("ssh"),
        "dns": snap.get("dns", []),
    }


@app.get("/api/interfaces")
def interfaces(device: str | None = None, _: str = Depends(require_auth)) -> dict:
    snap = _snapshot_for(device)
    return {
        "interfaces": snap.get("interfaces", []),
        "ip_interfaces": snap.get("ip_interfaces", []),
        "wan": snap.get("wan", {}),
        "lan": snap.get("lan", {}),
    }


@app.get("/api/interfaces/{name}")
def interface_detail(name: str, device: str | None = None, _: str = Depends(require_auth)) -> dict:
    if not re.match(r"^[A-Za-z][\w/.-]*$", name):
        raise HTTPException(400, "bad interface name")
    runtime = _runtime_for(device)
    text = runtime.session.run(f"display interface {name}")
    return {"name": name, "parsed": parse_interface_detail(text), "output": text}


@app.get("/api/network")
def network(device: str | None = None, _: str = Depends(require_auth)) -> dict:
    snap = _snapshot_for(device)
    return {
        "routes": snap.get("routes", []),
        "arp": snap.get("arp", []),
        "mac_table": snap.get("mac_table", []),
        "lldp": snap.get("lldp", []),
        "vlans": snap.get("vlans", []),
        "pools": snap.get("pools", []),
    }


@app.get("/api/dhcp")
def dhcp(device: str | None = None, _: str = Depends(require_auth)) -> dict:
    return {"pools": _snapshot_for(device).get("pools", [])}


@app.get("/api/logs")
def logs(
    limit: int = Query(200, le=1000),
    offset: int = 0,
    module: str | None = None,
    severity_max: int | None = None,
    search: str | None = None,
    since: float | None = None,
    _: str = Depends(require_auth),
) -> dict:
    return STORE.query_logs(limit, offset, module, severity_max, search, since)


@app.get("/api/logs/modules")
def log_modules(_: str = Depends(require_auth)) -> list[dict]:
    return STORE.log_modules()


@app.get("/api/traps")
def traps(device: str | None = None, _: str = Depends(require_auth)) -> list[dict]:
    return _snapshot_for(device).get("traps_recent", [])


@app.get("/api/alerts")
def alerts(limit: int = 200, _: str = Depends(require_auth)) -> list[dict]:
    return list(STORE.alerts)[-limit:][::-1]


@app.get("/api/history")
def history(
    minutes: int = Query(60, ge=1, le=60 * 24 * 30),
    fields: str = "cpu,mem_percent,wan_in_bps,wan_out_bps",
    _: str = Depends(require_auth),
) -> dict:
    since = time.time() - minutes * 60
    return {"since": since, "points": STORE.series(since, fields.split(","))}


@app.get("/api/history/export.csv")
def export_csv(minutes: int = Query(1440, ge=1), _: str = Depends(require_auth)) -> StreamingResponse:
    since = time.time() - minutes * 60
    rows = STORE.series(since, ["cpu", "mem_percent", "wan_in_bps", "wan_out_bps", "wan_in_pps", "wan_out_pps"])
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()) if rows else ["ts"])
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=monini-history.csv"},
    )


@app.post("/api/command")
async def run_command(request: Request, _: str = Depends(require_auth)) -> dict:
    body = await request.json()
    command = (body.get("command") or "").strip()
    allowed, reason = agent.command_allowed(command)
    if not allowed:
        raise HTTPException(403, reason)
    runtime = _runtime_for(body.get("device_id"))
    try:
        output = await asyncio.to_thread(runtime.session.run, command, 30.0)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"device error: {exc}") from exc
    return {"command": command, "output": output, "ts": time.time()}


@app.post("/api/refresh")
async def refresh(device: str | None = None, _: str = Depends(require_auth)) -> dict:
    runtime = _runtime_for(device)
    snap = await asyncio.to_thread(collect_snapshot, runtime)
    store = store_for(runtime.device["id"])
    store.add(snap)
    STORE.latest = snap
    return {"ts": snap["ts"]}


@app.get("/api/live")
def live(device: str | None = None, _: str = Depends(require_auth)) -> dict:
    """One-shot live snapshot for a device (same shape as the SSE frames)."""
    runtime = _runtime_for(device)
    return _live_payload(runtime)


def _live_payload(runtime: DeviceRuntime) -> dict:
    """Small, JSON-safe view of the latest snapshot for one device."""
    snap = store_for(runtime.device["id"]).latest or {}
    same_device = bool(snap) and snap.get("device_id") == runtime.device["id"]
    if not same_device:
        snap = {}
    # The poller snapshots every ~60s. When a fast sampler exists, its most
    # recent reading is the real "current" value; otherwise use the snapshot.
    fast = runtime.fast
    current = dict(snap)
    if fast:
        current.update({k: v for k, v in fast.items() if v is not None})
    temps = [t.get("current") for t in snap.get("temperature") or [] if t.get("current") is not None]
    collected = fast.get("ts") if fast else snap.get("ts")
    wan = snap.get("wan") or {}
    summary = snap.get("summary") or {}
    return {
        "type": "live",
        "device_id": runtime.device["id"],
        "ts": time.time(),
        "collected_ts": collected,
        "age_s": round(time.time() - collected, 1) if collected else None,
        "running": True,
        "connected": runtime.session.connected,
        "model": snap.get("model"),
        "vrp_version": snap.get("vrp_version"),
        "uptime": snap.get("uptime"),
        "cpu": current.get("cpu_percent", current.get("cpu_5s_percent")),
        "cpu_max": current.get("cpu_max_percent", snap.get("cpu_max_percent")),
        "mem": current.get("mem_percent"),
        "mem_used_kb": current.get("mem_used_kb"),
        "mem_total_kb": current.get("mem_total_kb"),
        "temp": max(temps) if temps else None,
        "wan": {
            "iface": wan.get("iface"),
            "state": wan.get("state"),
            "ip": wan.get("ip"),
            "in_bps": wan.get("in_bps"),
            "out_bps": wan.get("out_bps"),
            "in_pps": wan.get("in_pps"),
            "out_pps": wan.get("out_pps"),
            "rx_errors": wan.get("rx_errors"),
            "tx_errors": wan.get("tx_errors"),
        } if wan else None,
        "summary": {
            "ifaces_up": summary.get("ifaces_up", 0),
            "ifaces_total": summary.get("ifaces_total", 0),
            "routes": summary.get("routes", 0),
            "arp_entries": summary.get("arp_entries", 0),
            "mac_entries": summary.get("mac_entries", 0),
            "dhcp_used": summary.get("dhcp_used", 0),
            "dhcp_idle": summary.get("dhcp_idle", 0),
            "lldp_neighbors": summary.get("lldp_neighbors", 0),
            "alarms": summary.get("alarms", 0),
        } if summary else None,
        "devices": [
            {"id": d["id"], "name": d["name"], "connected": d["connected"]}
            for d in DEVICES.status()
        ],
    }


@app.get("/api/stream")
async def stream(request: Request, device: str | None = None, _: str = Depends(require_auth)) -> StreamingResponse:
    """SSE: push the live view of one device every second (heartbeats included).

    The heavy snapshot (logs, MAC tables) still refreshes on the poll interval,
    but the UI gets a small frame every second so counters, age and device
    status stay current and switching routers reconnects to the right stream.
    """

    async def gen() -> Iterator[str]:
        while True:
            if await request.is_disconnected():
                break
            try:
                runtime = _runtime_for(device)
                payload = _live_payload(runtime)
            except HTTPException as exc:
                payload = {"type": "live", "device_id": device, "running": False, "error": exc.detail}
            except Exception as exc:  # noqa: BLE001
                payload = {"type": "live", "device_id": device, "running": False, "error": str(exc)}
            yield f"data: {json.dumps(payload, default=str)}\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# -- AI settings ------------------------------------------------------------
@app.get("/api/settings")
def get_settings(_: str = Depends(require_auth)) -> dict:
    return REGISTRY.public_settings()


@app.put("/api/settings")
async def put_settings(request: Request, _: str = Depends(require_auth)) -> dict:
    body = await request.json()
    if "ai" in body and isinstance(body["ai"], dict):
        # an empty api_key from the UI means "keep the stored one"
        if body["ai"].get("api_key") == "":
            body["ai"].pop("api_key")
    REGISTRY.update_settings(body)
    return REGISTRY.public_settings()


@app.get("/api/ai/models")
async def ai_models(_: str = Depends(require_auth)) -> dict:
    settings = REGISTRY.get_settings()
    try:
        models = await agent.list_models(settings["ai"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Не удалось получить список моделей: {exc}") from exc
    return {"models": models, "current": settings["ai"].get("model")}


# -- AI agent ---------------------------------------------------------------
def _agent_tools(default_device: str | None) -> dict:
    """Bind agent tool names to real data sources."""

    def _device(args: dict) -> DeviceRuntime:
        return _runtime_for(args.get("device_id") or default_device)

    async def get_snapshot(args: dict) -> str:
        runtime = _device(args)
        snap = {
            k: v for k, v in (STORE.latest or {}).items()
            if k not in ("raw", "log_recent", "traps_recent")
        }
        snap["poller"] = runtime.stats
        snap["active_alerts"] = list(STORE._active_alerts.values())
        return json.dumps(snap, ensure_ascii=False, default=str)

    async def get_history(args: dict) -> str:
        minutes = int(args.get("minutes") or 60)
        fields = [f.strip() for f in (args.get("fields") or "cpu,mem_percent,wan_in_bps,wan_out_bps").split(",")]
        limit = int(args.get("limit") or 200)
        points = STORE.series(time.time() - minutes * 60, fields)
        if len(points) > limit:
            stride = max(1, len(points) // limit)
            points = points[::stride]
        return json.dumps({"minutes": minutes, "fields": fields, "points": points}, default=str)

    async def search_logs(args: dict) -> str:
        minutes = args.get("minutes")
        since = time.time() - int(minutes) * 60 if minutes else None
        res = STORE.query_logs(
            limit=int(args.get("limit") or 50),
            module=args.get("module"),
            severity_max=args.get("severity_max"),
            search=args.get("query"),
            since=since,
        )
        return json.dumps(res, ensure_ascii=False, default=str)

    async def get_alerts(args: dict) -> str:
        limit = int(args.get("limit") or 50)
        return json.dumps(list(STORE.alerts)[-limit:][::-1], ensure_ascii=False, default=str)

    async def list_devices_tool(_args: dict) -> str:
        return json.dumps(DEVICES.status(), ensure_ascii=False, default=str)

    async def run_command(args: dict) -> str:
        command = (args.get("command") or "").strip()
        allowed, reason = agent.command_allowed(command)
        if not allowed:
            return json.dumps({"error": reason}, ensure_ascii=False)
        runtime = _device(args)
        output = await asyncio.to_thread(runtime.session.run, command, 30.0)
        return json.dumps({"command": command, "output": output[:20_000], "device_id": runtime.device["id"]}, ensure_ascii=False)

    async def export_report(args: dict) -> str:
        minutes = int(args.get("minutes") or 1440)
        since = time.time() - minutes * 60
        points = STORE.series(since, ["cpu", "mem_percent", "wan_in_bps", "wan_out_bps", "ifaces_up", "ifaces_total", "mac_entries", "dhcp_used"])
        snap = STORE.latest or {}
        def stats(key):
            values = [p[key] for p in points if p.get(key) is not None]
            if not values:
                return None
            return {"min": min(values), "max": max(values), "avg": round(sum(values) / len(values), 2), "samples": len(values)}
        report = {
            "window_minutes": minutes,
            "device": {"id": snap.get("device_id"), "name": snap.get("device_name"), "model": snap.get("model"), "uptime": snap.get("uptime")},
            "stats": {k: stats(k) for k in ("cpu", "mem_percent", "wan_in_bps", "wan_out_bps", "mac_entries", "dhcp_used")},
            "interfaces": [
                {"name": i["name"], "phys": i["phys"], "proto": i["proto"], "inutil": i.get("inutil"), "oututil": i.get("oututil")}
                for i in snap.get("interfaces", [])
            ],
            "down_interfaces": [i["name"] for i in snap.get("interfaces", []) if i.get("phys") != "up"],
            "active_alerts": list(STORE._active_alerts.values()),
            "command_errors": snap.get("errors", {}),
        }
        return json.dumps(report, ensure_ascii=False, default=str)

    return {
        "get_snapshot": get_snapshot,
        "get_history": get_history,
        "search_logs": search_logs,
        "get_alerts": get_alerts,
        "list_devices": list_devices_tool,
        "run_command": run_command,
        "export_report": export_report,
    }


@app.get("/api/ai/tools")
def ai_tools(_: str = Depends(require_auth)) -> list[dict]:
    return agent.TOOLS


@app.post("/api/ai/chat")
async def ai_chat(request: Request, _: str = Depends(require_auth)) -> StreamingResponse:
    body = await request.json()
    messages = body.get("messages") or []
    if not isinstance(messages, list) or not messages:
        raise HTTPException(400, "messages обязателен")
    clean = [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    if not clean:
        raise HTTPException(400, "нет сообщений пользователя")
    default_device = body.get("device_id")
    settings = REGISTRY.get_settings()["ai"]
    tools = _agent_tools(default_device)

    async def gen() -> Iterator[str]:
        async for frame in agent.run_agent(
            settings=settings,
            messages=clean,
            device_id=default_device,
            tools_impl=tools,
        ):
            yield frame
            await asyncio.sleep(0)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return DASHBOARD_HTML


DASHBOARD_HTML = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Monini — Huawei AP4050DN</title>
<style>
 :root{--bg:#0e1116;--card:#171c24;--line:#242c38;--fg:#d7dee8;--dim:#7d8794;--ok:#39d98a;--warn:#f5a623;--err:#ff5d5d;--accent:#4d9fff}
 *{box-sizing:border-box}
 body{margin:0;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--fg)}
 header{display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:5}
 h1{font-size:16px;margin:0;font-weight:600}
 .pill{font-size:12px;padding:2px 8px;border-radius:10px;background:var(--card);border:1px solid var(--line);color:var(--dim)}
 .pill.ok{color:var(--ok);border-color:#1d4a36}.pill.bad{color:var(--err);border-color:#5a2323}
 main{padding:16px 20px;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}
 .card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;min-width:0}
 .card h2{font-size:13px;margin:0 0 10px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
 .kpi{display:flex;flex-wrap:wrap;gap:18px}
 .kpi div{min-width:90px}
 .kpi b{display:block;font-size:22px;font-weight:600}
 .kpi span{color:var(--dim);font-size:12px}
 .wide{grid-column:1/-1}
 table{width:100%;border-collapse:collapse;font-size:13px}
 th,td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
 th{color:var(--dim);font-weight:500;font-size:12px}
 td.num{text-align:right;font-variant-numeric:tabular-nums}
 .up{color:var(--ok)}.down{color:var(--err)}
 canvas{width:100%;height:150px;display:block}
 input,button,select{background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit}
 button{cursor:pointer}button:hover{border-color:var(--accent)}
 pre{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;max-height:320px;overflow:auto;font-size:12px;white-space:pre-wrap}
 .logs{max-height:380px;overflow:auto}
 .sev4{color:var(--warn)}.sev3{color:var(--err)}.sev5,.sev6,.sev7{color:#ff2d55;font-weight:600}.sev2{color:#5ad0ff}
 .muted{color:var(--dim)}
 .flex{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
</style></head><body>
<header>
  <h1>Monini</h1>
  <span id="dev" class="pill">…</span>
  <span id="conn" class="pill">…</span>
  <span id="ts" class="pill muted"></span>
  <span style="flex:1"></span>
  <button onclick="refreshNow()">Обновить сейчас</button>
</header>
<main>
  <section class="card wide"><h2>Ресурсы</h2>
    <div class="kpi">
      <div><b id="k-cpu">—</b><span>CPU</span></div>
      <div><b id="k-mem">—</b><span>RAM</span></div>
      <div><b id="k-in">—</b><span>WAN in</span></div>
      <div><b id="k-out">—</b><span>WAN out</span></div>
      <div><b id="k-clients">—</b><span>DHCP leases</span></div>
      <div><b id="k-mac">—</b><span>MAC entries</span></div>
      <div><b id="k-lldp">—</b><span>LLDP</span></div>
      <div><b id="k-alerts">—</b><span>Alerts</span></div>
    </div>
    <canvas id="chart-cpu" height="150"></canvas>
    <canvas id="chart-traffic" height="150" style="margin-top:8px"></canvas>
  </section>

  <section class="card"><h2>Система</h2><div id="sys" class="muted">…</div></section>
  <section class="card"><h2>Температура / NTP</h2><div id="temp" class="muted">…</div></section>
  <section class="card"><h2>Интерфейсы</h2><table id="ifaces"></table></section>
  <section class="card"><h2>DHCP pools</h2><table id="pools"></table></section>

  <section class="card wide"><h2>Логи</h2>
    <div class="flex" style="margin-bottom:8px">
      <input id="q" placeholder="поиск…" style="flex:1;min-width:160px">
      <select id="sev">
        <option value="">все уровни</option><option value="3">≤3 (error+)</option>
        <option value="4">≤4 (warning+)</option><option value="5">≤5 (notice+)</option>
      </select>
      <button onclick="loadLogs()">Найти</button>
    </div>
    <div class="logs"><table id="logs"></table></div>
  </section>

  <section class="card"><h2>Трапы</h2><div class="logs"><table id="traps"></table></div></section>
  <section class="card"><h2>Алерты</h2><div class="logs"><table id="alerts"></table></div></section>

  <section class="card wide"><h2>Консоль</h2>
    <div class="flex"><input id="cmd" placeholder="display interface brief" style="flex:1"><button onclick="runCmd()">Выполнить</button></div>
    <pre id="cmdout" class="muted">Только display / ping / tracert.</pre>
  </section>
</main>
<script>
const $ = id => document.getElementById(id);
const fmtRate = bps => bps == null ? '—' : (bps >= 1e9 ? (bps/1e9).toFixed(2)+' Gb/s'
  : bps >= 1e6 ? (bps/1e6).toFixed(2)+' Mb/s' : bps >= 1e3 ? (bps/1e3).toFixed(1)+' Kb/s' : bps+' b/s');
const esc = s => (s ?? '').toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let hist = [];

async function j(url, opts){ const r = await fetch(url, opts); if(!r.ok) throw new Error(r.status+' '+await r.text()); return r.json(); }

async function loadOverview(){
  const d = await j('/api/overview');
  $('dev').textContent = (d.model||'?') + ' · VRP ' + (d.vrp_version||'?');
  $('conn').textContent = d.connected ? 'connected' : 'disconnected';
  $('conn').className = 'pill ' + (d.connected ? 'ok' : 'bad');
  $('ts').textContent = new Date(d.ts*1000).toLocaleString();
  $('k-cpu').textContent = d.cpu_percent != null ? d.cpu_percent.toFixed(1)+'%' : '—';
  $('k-mem').textContent = d.mem_percent != null ? d.mem_percent+'%' : '—';
  const w = d.wan||{};
  $('k-in').textContent = fmtRate(w.in_bps);
  $('k-out').textContent = fmtRate(w.out_bps);
  const s = d.summary||{};
  $('k-clients').textContent = s.dhcp_used ?? '—';
  $('k-mac').textContent = s.mac_entries ?? '—';
  $('k-lldp').textContent = s.lldp_neighbors ?? '—';
  $('k-alerts').textContent = (d.active_alerts||[]).length;

  const id = d.identity||{};
  $('sys').innerHTML = `
    <table>
     <tr><th>Модель</th><td>${esc(d.model)}</td></tr>
     <tr><th>VRP</th><td>${esc(d.vrp_version)}</td></tr>
     <tr><th>Uptime</th><td>${esc(d.uptime)}</td></tr>
     <tr><th>SDRAM</th><td>${esc(d.sdram_mb)} MB (used ${d.mem_used_kb??'—'} KB)</td></tr>
     <tr><th>Время устройства</th><td>${esc(d.device_time)} ${esc(d.timezone)}</td></tr>
     <tr><th>Board</th><td>${esc(id.boardType)}</td></tr>
     <tr><th>Serial</th><td>${esc(id.barCode)}</td></tr>
     <tr><th>Произв.</th><td>${esc(id.manufactured)}</td></tr>
    </table>`;
  const ntp = d.ntp||{};
  $('temp').innerHTML = `<table>
    ${(d.temperature||[]).map(t=>`<tr><th>${esc(t.name)}</th><td class="num">${t.temp??'—'} °C <span class="muted">/ ${t.upper}°</span></td></tr>`).join('')}
    <tr><th>NTP</th><td class="${ntp.sync_state && ntp.sync_state.startsWith('sync') ? 'up':'down'}">${esc(ntp.sync_state)} · stratum ${esc(ntp.stratum)}</td></tr>
    <tr><th>SSH</th><td>stelnet ${esc((d.ssh||{}).stelnet)} · v${esc((d.ssh||{}).version)}</td></tr>
   </table>`;

  $('ifaces').innerHTML = `<tr><th>Интерфейс</th><th>PHY</th><th>Proto</th><th class="num">In</th><th class="num">Out</th><th class="num">err</th></tr>` +
    (d.interfaces||[]).map(i=>`<tr><td>${esc(i.name)}</td>
      <td class="${i.phys==='up'?'up':'down'}">${esc(i.phys)}</td>
      <td class="${i.proto.startsWith('up')?'up':'down'}">${esc(i.proto)}</td>
      <td class="num">${i.inutil??'—'}%</td><td class="num">${i.oututil??'—'}%</td>
      <td class="num">${(i.inerr??0)+(i.outerr??0)}</td></tr>`).join('');

  $('pools').innerHTML = `<tr><th>Pool</th><th class="num">used</th><th class="num">idle</th><th class="num">expired</th></tr>` +
    (d.pools||[]).map(p=>`<tr><td>${esc(p.name||p.pool)}</td><td class="num">${p.used??'—'}</td>
      <td class="num">${p.idle??'—'}</td><td class="num">${p.expired??'—'}</td></tr>`).join('');

  drawCharts();
}

async function loadHistory(){
  const d = await j('/api/history?minutes=60&fields=cpu,mem_percent,wan_in_bps,wan_out_bps');
  hist = d.points;
  drawCharts();
}

function line(canvas, series, opts){
  const c = canvas, ctx = c.getContext('2d');
  const w = c.clientWidth * devicePixelRatio, h = c.clientHeight * devicePixelRatio;
  c.width = w; c.height = h;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = '#242c38'; ctx.lineWidth = 1;
  for(let i=1;i<4;i++){ const y=h*i/4; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  if(!series.length) return;
  const t0 = series[0][0], t1 = series[series.length-1][0] || t0+1;
  const max = Math.max(1, ...series.map(s=>s[1]));
  series.forEach(([t,v], idx)=>{
    const x = (t-t0)/Math.max(1,t1-t0)*w, y = h - (v/max)*(h-6) - 3;
    if(!idx) ctx.beginPath(), ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.strokeStyle = opts.color; ctx.lineWidth = 1.6*devicePixelRatio; ctx.stroke();
  ctx.fillStyle = '#7d8794'; ctx.font = (10*devicePixelRatio)+'px system-ui';
  ctx.fillText(opts.label + '  max ' + (opts.fmt?opts.fmt(max):max.toFixed(1)), 6, 12*devicePixelRatio);
}

function drawCharts(){
  if(!hist.length) return;
  line($('chart-cpu'), hist.filter(p=>p.cpu!=null).map(p=>[p.ts,p.cpu]), {color:'#4d9fff', label:'CPU %', fmt:v=>v.toFixed(1)+'%'});
  const t = []; hist.forEach(p=>{ if(p.wan_in_bps!=null) t.push([p.ts,p.wan_in_bps]); });
  line($('chart-traffic'), t, {color:'#39d98a', label:'WAN in', fmt:fmtRate});
}

async function loadLogs(){
  const q = $('q').value, sev = $('sev').value;
  const d = await j(`/api/logs?limit=300${q?'&search='+encodeURIComponent(q):''}${sev?'&severity_max='+sev:''}`);
  $('logs').innerHTML = `<tr><th>Время</th><th>Модуль</th><th>Sev</th><th>Сообщение</th></tr>` +
    d.items.map(l=>`<tr><td class="muted">${esc(l.log_ts)}</td><td>${esc(l.module)}</td>
      <td class="sev${l.severity}">${l.severity}</td><td>${esc(l.msg)}</td></tr>`).join('');
}

async function loadTraps(){
  const d = await j('/api/traps');
  $('traps').innerHTML = `<tr><th>Время</th><th>Модуль</th><th>Сообщение</th></tr>` +
    d.slice().reverse().map(t=>`<tr><td class="muted">${esc(t.ts)}</td><td>${esc(t.module)}</td><td>${esc(t.msg)}</td></tr>`).join('');
}

async function loadAlerts(){
  const d = await j('/api/alerts');
  $('alerts').innerHTML = `<tr><th>Время</th><th>Ур.</th><th>Сообщение</th><th>Статус</th></tr>` +
    d.map(a=>`<tr><td class="muted">${new Date(a.ts*1000).toLocaleString()}</td>
      <td class="${a.severity==='critical'?'down':''}">${esc(a.severity)}</td><td>${esc(a.message)}</td>
      <td>${a.resolved?'<span class="up">ok</span>':'<span class="down">active</span>'}</td></tr>`).join('');
}

async function runCmd(){
  $('cmdout').textContent = '…';
  try{
    const d = await j('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({command: $('cmd').value})});
    $('cmdout').textContent = d.output || '(пусто)';
  }catch(e){ $('cmdout').textContent = 'Ошибка: '+e.message; }
}

async function refreshNow(){ await j('/api/refresh',{method:'POST'}); await tick(); }

let es;
function connectSSE(){
  es = new EventSource('/api/stream');
  es.onmessage = () => tick({light:true});
  es.onerror = () => { setTimeout(connectSSE, 3000); };
}

let ticking = false;
async function tick(){
  if(ticking) return; ticking = true;
  try{ await Promise.all([loadOverview(), loadHistory()]); }catch(e){ console.error(e); }
  ticking = false;
}

(async ()=>{
  try{ await tick(); await loadLogs(); await loadTraps(); await loadAlerts(); connectSSE(); }catch(e){ console.error(e); }
  setInterval(loadHistory, 30000);
  setInterval(()=>{ loadLogs(); loadTraps(); loadAlerts(); }, 20000);
})();
</script></body></html>"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--interval", type=float, default=POLL_INTERVAL)
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()
    if args.debug:
        os.sys.argv.append("--debug")
    DEVICES.interval = args.interval
    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
