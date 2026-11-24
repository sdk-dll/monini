#!/usr/bin/env python3
"""
Huawei router monitor via stelnet (SSH) with legacy algorithms.

The router (HUAWEI-1.5 banner) only supports:
  kex:     diffie-hellman-group14-sha1   (dropped by paramiko 4+/cryptography)
  hostkey: ssh-rsa / ecdsa-sha2-nistp256

This module restores group14-sha1 kex support and parses a set of
"display ..." commands into a dict / JSON. Works as CLI and as importable lib.

Usage:
  ./huawei_mon.py                 # one-shot snapshot, human readable
  ./huawei_mon.py --json          # one-shot snapshot, JSON
  ./huawei_mon.py --watch 30      # poll every 30s, print each sample as JSON
  ./huawei_mon.py --cmd "display cpu-usage"
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field

import paramiko

HOST = os.environ.get("HUAWEI_HOST", "192.168.1.1")
USERNAME = os.environ.get("HUAWEI_USER", "admin")
PASSWORD = os.environ.get("HUAWEI_PASS", "gfhvexVfr1")
PORT = int(os.environ.get("HUAWEI_PORT", "22"))

# ----------------------------------------------------------------------------
# Legacy DH group14-sha1 kex (dropped from paramiko >= 4 / cryptography)
# ----------------------------------------------------------------------------
import hashlib  # noqa: E402

import paramiko.kex_group14 as _g14  # noqa: E402
from paramiko.kex_group14 import KexGroup14SHA256  # noqa: E402


class KexGroup14SHA1(KexGroup14SHA256):
    """diffie-hellman-group14-sha1 — same DH group, SHA-1 as hash."""

    name = "diffie-hellman-group14-sha1"
    hash_algo = hashlib.sha1


def _install_legacy_kex() -> None:
    # paramiko resolves kex classes from Transport._kex_info by name
    kex_info = paramiko.Transport._kex_info  # noqa: SLF001
    if KexGroup14SHA1.name not in kex_info:
        kex_info[KexGroup14SHA1.name] = KexGroup14SHA1
    names = list(paramiko.Transport._preferred_kex)  # noqa: SLF001
    if KexGroup14SHA1.name not in names:
        # keep legacy kex last so modern ones are preferred when available
        paramiko.Transport._preferred_kex = tuple(names) + (KexGroup14SHA1.name,)  # noqa: SLF001


_install_legacy_kex()


# ----------------------------------------------------------------------------
# SSH helpers
# ----------------------------------------------------------------------------
def connect(timeout: float = 10.0) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        PORT,
        USERNAME,
        PASSWORD,
        look_for_keys=False,
        allow_agent=False,
        timeout=timeout,
        banner_timeout=timeout,
        auth_timeout=timeout,
        disabled_algorithms=dict(
            kex=[
                "mlkem768x25519-sha256",
                "curve25519-sha256@libssh.org",
                "ecdh-sha2-nistp256",
                "ecdh-sha2-nistp384",
                "ecdh-sha2-nistp521",
            ]
        ),
    )
    return client


_PAGINATION = re.compile(r"^\s*---- More ----.*$", re.M)
_ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
_PROMPT = re.compile(r"(?:<[^<>\r\n]+>|\[[^\[\]\r\n]+\])\s*$")


def open_shell(client: paramiko.SSHClient, timeout: float = 15.0) -> paramiko.Channel:
    """Huawei VRP (AP/router) only offers interactive shell; exec channel hangs."""
    chan = client.get_transport().open_session(timeout=timeout)
    chan.settimeout(timeout)
    chan.get_pty()
    chan.invoke_shell()
    chan.send("\n")
    _drain(chan, timeout)
    chan.send("screen-length 0 temporary\n")
    _drain(chan, timeout)
    chan.send("screen-width 512\n")
    _drain(chan, timeout)
    return chan


def _drain(chan: paramiko.Channel, timeout: float = 15.0) -> None:
    """Read whatever is pending until the channel goes quiet."""
    chan.settimeout(0.3)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if not chan.recv(65535):
                break
        except Exception:  # noqa: BLE001 - idle for 0.3s == end of output
            break
    chan.settimeout(timeout)


def _read_until_prompt(chan: paramiko.Channel, timeout: float = 15.0,
                       command: str | None = None) -> str:
    """Read until the VRP prompt shows up at the end of the (fresh) output.

    If `command` is given, the echoed command line is skipped first so that an
    older prompt still sitting in the buffer cannot be mistaken for the answer.
    """
    buf = ""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            chunk = chan.recv(65535).decode(errors="replace")
        except Exception:  # noqa: BLE001 - socket timeout
            break
        if not chunk:
            break
        buf += chunk
        text = _ANSI.sub("", _PAGINATION.sub("", buf))
        if command and command.strip() not in text:
            continue  # echo of our command not received yet
        if _PROMPT.search(text):
            break
    return buf


_ECHO = re.compile(r"^\s*<[^<>\r\n]+>\S.*$", re.M)


def run_command(client: paramiko.SSHClient, command: str, timeout: float = 20.0,
                chan: paramiko.Channel | None = None) -> str:
    """Run one VRP command on an interactive shell and return its output.

    Marks the answer with a unique `echo` sentinel: its echo line contains a
    token nobody would type, so stray async output (e.g. `display elabel`)
    cannot be mistaken for the answer we are waiting for.
    """
    own = chan is None
    if own:
        chan = open_shell(client, timeout)
    marker = f"__mon_{int(time.time() * 1000) % 1000000}__"
    try:
        _drain(chan, timeout)  # clear leftovers
        chan.send(command.strip() + "\n")
        chan.send(f"echo {marker}\n")
        buf = ""
        deadline = time.time() + timeout
        chan.settimeout(0.3)
        while time.time() < deadline:
            try:
                chunk = chan.recv(65535).decode(errors="replace")
            except Exception:  # noqa: BLE001 - idle
                chunk = ""
            if chunk:
                buf += chunk
            if marker in buf:
                # output between the echoed command and the marker line
                break
        # collect whatever was written after the marker line (prompt)
        _drain(chan, 1.0)
    finally:
        if own:
            chan.close()

    text = _ANSI.sub("", _PAGINATION.sub("", buf.replace("\r\n", "\n").replace("\r", "\n")))
    lines = text.splitlines()
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped == command.strip():
            out.clear()  # keep only output after the last echo of our command
            continue
        if stripped in (f"echo {marker}", marker):
            break
        if not stripped or marker in stripped:
            continue
        if stripped.startswith("screen-length") or stripped.startswith("screen-width"):
            continue
        if stripped.startswith("Info: The configuration takes effect"):
            continue
        if re.match(r"^<[^<>]+>", stripped):  # prompt line
            continue
        out.append(line)
    return "\n".join(out).strip()


# ----------------------------------------------------------------------------
# Parsers
# ----------------------------------------------------------------------------
def parse_version(text: str) -> dict:
    info: dict = {}
    m = re.search(r"VRP \(R\) software,?\s*[Vv]ersion\s*([^\s,]+)", text)
    if m:
        info["vrp_version"] = m.group(1)
    m = re.search(r"(?:MPU \(R\) software,?\s*[Vv]ersion|Version)\s*([\w.()]+)", text)
    if m:
        info.setdefault("vrp_version", m.group(1))
    # "Huawei AP4050DN Router uptime is 0 week, 0 day, 21 hours, 27 minutes"
    m = re.search(r"Huawei\s+(?P<model>\S+?)\s+(?:Router|Flexible Router|Access Point|Switch)?\s*uptime is (?P<up>.+)$",
                  text, re.M)
    if m:
        info["model"] = m.group("model")
        info["uptime"] = m.group("up").strip()
    else:
        m = re.search(r"uptime is (.+)$", text, re.M)
        if m:
            info["uptime"] = m.group(1).strip()
    m = re.search(r"SDRAM Memory Size\s*:\s*(\d+)\s*M", text)
    if m:
        info["sdram_mb"] = int(m.group(1))
    return info


def parse_cpu(text: str) -> dict:
    """`display cpu-usage`: "CPU   Usage: 18.2%   Max: 98.6%"."""
    info: dict = {}
    m = re.search(r"CPU\s+Usage:\s*([\d.]+)%", text)
    if m:
        info["cpu_percent"] = float(m.group(1))
    m = re.search(r"Max:\s*([\d.]+)%", text)
    if m:
        info["cpu_max_percent"] = float(m.group(1))
    m = re.search(r"CPU\s+Usage Stat\. Cycle:\s*(\d+)\s*\((\w+)\)", text)
    if m:
        info["cpu_cycle_sec"] = int(m.group(1))
    m = re.search(r"CPU\s+Usage Stat\. Time\s*:\s*(.+)$", text, re.M)
    if m:
        info["cpu_stat_time"] = m.group(1).strip()
    # classic VRP format fallback: five seconds / one minute / five minutes
    for key, pat in (
        ("cpu_5s_percent", r"five seconds:\s*(\d+)%"),
        ("cpu_1m_percent", r"one minute:\s*(\d+)%"),
        ("cpu_5m_percent", r"five minutes:\s*(\d+)%"),
    ):
        m = re.search(pat, text)
        if m:
            info[key] = int(m.group(1))
    return info


def parse_memory(text: str) -> dict:
    """`display memory-usage` on V200R019 (AP4050DN)."""
    info: dict = {}
    m = re.search(r"System Total Memory Is:\s*(\d+)\s*kbytes", text)
    if m:
        info["mem_total_kb"] = int(m.group(1))
    m = re.search(r"Total Memory Used Is:\s*(\d+)\s*kbytes", text)
    if m:
        info["mem_used_kb"] = int(m.group(1))
    m = re.search(r"Memory Using Percentage Is:\s*(\d+)%", text)
    if m:
        info["mem_percent"] = int(m.group(1))
    # older / other VRP format
    if "mem_percent" not in info:
        m = re.search(r"Memory utilization\s*:\s*(\d+)%", text, re.I)
        if m:
            info["mem_percent"] = int(m.group(1))
    return info


_IFACE_ROW = re.compile(
    r"^(?P<name>\S+)\s+(?P<phys>up|down|\*down)\s+(?P<proto>up|down|up\(s\))"
    r"\s+(?P<inutil>\d+(?:\.\d+)?%|--)\s+(?P<oututil>\d+(?:\.\d+)?%|--)"
    r"(?:\s+(?P<inerr>\d+)\s+(?P<outerr>\d+))?"
)


def _pct(v: str | None) -> float | None:
    if not v or v == "--":
        return None
    return float(v.rstrip("%"))


def parse_interfaces(text: str) -> list[dict]:
    """`display interface brief` (PHY / Protocol / InUti / OutUti / errors)."""
    out = []
    for line in text.splitlines():
        m = _IFACE_ROW.match(line.strip())
        if not m:
            continue
        rec = m.groupdict()
        rec["inutil"] = _pct(rec["inutil"])
        rec["oututil"] = _pct(rec["oututil"])
        for k in ("inerr", "outerr"):
            rec[k] = int(rec[k]) if rec.get(k) is not None else None
        out.append(rec)
    return out


_IPIFACE = re.compile(
    r"^(?P<name>\S+)\s+(?P<ip>\d+\.\d+\.\d+\.\d+/\d+|unassigned)"
    r"\s+(?P<phys>up|down|\*down)\s+(?P<proto>up|down|up\(s\))"
)


def parse_ip_interfaces(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        m = _IPIFACE.match(line.strip())
        if m:
            out.append(m.groupdict())
    return out


_ROUTE_ROW = re.compile(
    r"^(?P<destination>\d+\.\d+\.\d+\.\d+/\d+)\s+(?P<proto>\S+)\s+"
    r"(?P<pref>\d+)\s+(?P<cost>\d+)\s+(?P<flags>\S+)\s+"
    r"(?P<next_hop>\S+)\s+(?P<iface>\S+)"
)


def parse_routes(text: str) -> list[dict]:
    """`display ip routing-table`."""
    out = []
    for line in text.splitlines():
        m = _ROUTE_ROW.match(line.strip())
        if not m:
            continue
        rec = m.groupdict()
        rec["pref"] = int(rec["pref"])
        rec["cost"] = int(rec["cost"])
        out.append(rec)
    return out


_ARP_ROW = re.compile(
    r"^(?P<ip>\d+\.\d+\.\d+\.\d+)\s+(?P<mac>[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}|"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}|[0-9a-fA-F:]{17})"
    r"\s+(?P<expire>\S+)?\s*(?P<type>\S+)?\s+(?P<iface>\S+)"
)


def parse_arp(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        m = _ARP_ROW.match(line.strip())
        if not m:
            continue
        rec = m.groupdict()
        rec["mac"] = rec["mac"].lower()
        out.append(rec)
    return out


def parse_wan(text: str) -> dict:
    """Parse `display interface <wan>-0/0/1` style detail output."""
    info = {}
    m = re.search(r"current state\s*:\s*(\S+)", text)
    if m:
        info["state"] = m.group(1)
    m = re.search(r"Line protocol current state\s*:\s*(\S+)", text)
    if m:
        info["line_protocol"] = m.group(1)
    m = re.search(r"Internet Address is\s*(\S+)", text)
    if m:
        info["ip"] = m.group(1)
    for key, pat in (
        ("in_errors", r"Errors:\s*(\d+)"),
        ("out_errors", r"Output errors:\s*(\d+)"),
        ("rx_packets", r"Unicast:\s*(\d+)"),
    ):
        m = re.search(pat, text)
        if m and key not in info:
            info[key] = int(m.group(1))
    m = re.search(r"Last 300 seconds input rate (\d+)\s*bytes/sec,\s*(\d+)\s*bits/sec", text)
    if m:
        info["in_bps"] = int(m.group(2))
    m = re.search(r"Last 300 seconds output rate (\d+)\s*bytes/sec,\s*(\d+)\s*bits/sec", text)
    if m:
        info["out_bps"] = int(m.group(2))
    return info


COMMANDS = {
    "version": "display version",
    "cpu": "display cpu-usage",
    "memory": "display memory-usage",
    "interfaces": "display interface brief",
    "ip_interfaces": "display ip interface brief",
    "routes": "display ip routing-table",
    "arp": "display arp",
    "wireless": "display station assoc-info",
}

def snapshot(client: paramiko.SSHClient, chan: paramiko.Channel | None = None) -> dict:
    data: dict = {"ts": time.time()}
    raw: dict = {}
    for key, cmd in COMMANDS.items():
        try:
            raw[key] = run_command(client, cmd, chan=chan)
        except Exception as exc:  # noqa: BLE001
            raw[key] = ""
            data.setdefault("errors", {})[key] = str(exc)

    data.update(parse_version(raw["version"]))
    data.update(parse_cpu(raw["cpu"]))
    data.update(parse_memory(raw["memory"]))
    data["interfaces"] = parse_interfaces(raw["interfaces"])
    data["ip_interfaces"] = parse_ip_interfaces(raw["ip_interfaces"])
    data["routes"] = parse_routes(raw["routes"])
    data["arp"] = parse_arp(raw["arp"])
    if "wireless" in raw:
        data["wireless_lines"] = len([l for l in raw["wireless"].splitlines() if l.strip()])
    if "--debug" in sys.argv:
        data["raw"] = raw
    return data


def main() -> int:
    ap = argparse.ArgumentParser(description="Huawei router monitor (stelnet/SSH)")
    ap.add_argument("--json", action="store_true", help="output JSON")
    ap.add_argument("--watch", type=float, metavar="SEC", help="poll interval")
    ap.add_argument("--cmd", help="run a single raw command and print output")
    ap.add_argument("--debug", action="store_true", help="include raw command output in JSON")
    args = ap.parse_args()

    client = connect()
    try:
        if args.cmd:
            out = run_command(client, args.cmd)
            lines = out.splitlines()
            # drop leftover shell init noise (screen-length ack + prompt line)
            while lines and (lines[0].startswith("Info: The configuration takes effect")
                             or re.match(r"^\s*<[^<>]+>", lines[0])):
                lines.pop(0)
            print("\n".join(lines))
            return 0
        chan = open_shell(client)
        while True:
            sample_started = time.time()
            data = snapshot(client, chan)
            if args.json or args.watch:
                print(json.dumps(data, ensure_ascii=False), flush=True)
            else:
                _pretty(data)
            if not args.watch:
                return 0
            if time.time() - sample_started < args.watch:
                time.sleep(args.watch - (time.time() - sample_started))
    finally:
        client.close()


def _pretty(data: dict) -> None:
    print(f"Model:   {data.get('model', '?')}  VRP {data.get('vrp_version', '?')}")
    print(f"Uptime:  {data.get('uptime', '?')}")
    cpu = data.get("cpu_percent", data.get("cpu_5s_percent", "?"))
    mx = data.get("cpu_max_percent")
    print(f"CPU:     {cpu}%" + (f"  (max {mx}%)" if mx is not None else ""))
    print(f"Memory:  {data.get('mem_percent', '?')}%"
          + (f"  ({data['mem_used_kb']} / {data['mem_total_kb']} KB)"
             if "mem_used_kb" in data else ""))
    print("\nInterfaces:")
    for it in data.get("interfaces", []):
        inu = "-" if it["inutil"] is None else f"{it['inutil']}%"
        outu = "-" if it["oututil"] is None else f"{it['oututil']}%"
        print(f"  {it['name']:<24} {it['phys']:<6} {it['proto']:<6} in {inu:<7} out {outu}")
    print("\nIP interfaces:")
    for it in data.get("ip_interfaces", []):
        print(f"  {it['name']:<24} {it['ip']:<20} {it['phys']:<5} {it['proto']}")
    print("\nDefault route / next hops:")
    for r in data.get("routes", []):
        if r["destination"] in ("0.0.0.0/0",):
            print(f"  {r['destination']} -> {r['next_hop']} via {r['iface']} ({r['proto']})")
    print(f"\nRoutes: {len(data.get('routes', []))}   ARP entries: {len(data.get('arp', []))}")
    if data.get("errors"):
        print(f"\nErrors: {data['errors']}")


if __name__ == "__main__":
    raise SystemExit(main())
