"""Multi-device session + poller manager.

Each registered router gets its own HuaweiSession and PacerThread, so the UI
can switch between routers instantly and every router keeps its own history.
"""
from __future__ import annotations

import os
import threading
import time
import traceback
from typing import Any

import paramiko

import huawei_mon as hm
from registry import Registry

# Cheap commands polled on a short cadence so the UI shows real current values
# between the heavy full snapshots (which take tens of seconds).
FAST_COMMANDS: tuple[tuple[str, str], ...] = (
    ("cpu", "display cpu-usage"),
    ("memory", "display memory-usage"),
)


def parse_fast(parsers, raw: dict[str, str]) -> dict:
    """Turn the fast command output into live fields."""
    out: dict[str, Any] = {"ts": time.time()}
    try:
        out.update(parsers["version"](raw.get("version", "")))
    except Exception:  # noqa: BLE001
        pass
    try:
        out.update(parsers["cpu"](raw.get("cpu", "")))
    except Exception:  # noqa: BLE001
        pass
    try:
        out.update(parsers["memory"](raw.get("memory", "")))
    except Exception:  # noqa: BLE001
        pass
    return out


class HuaweiSession:
    """One persistent interactive SSH shell per device, guarded by a lock."""

    def __init__(self, host: str, port: int, username: str, password: str) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self._lock = threading.Lock()
        self._client: paramiko.SSHClient | None = None
        self._chan: paramiko.Channel | None = None
        self.last_ok: float | None = None
        self.last_error: str | None = None

    def _open(self) -> None:
        self.close()
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            self.host,
            self.port,
            self.username,
            self.password,
            look_for_keys=False,
            allow_agent=False,
            timeout=10.0,
            banner_timeout=10.0,
            auth_timeout=10.0,
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
        self._client = client
        self._chan = hm.open_shell(client)
        self.last_ok = time.time()

    def close(self) -> None:
        for obj in (self._chan, self._client):
            try:
                if obj:
                    obj.close()
            except Exception:  # noqa: BLE001
                pass
        self._chan = None
        self._client = None

    def run(self, command: str, timeout: float = 25.0) -> str:
        """Execute one VRP command, reconnecting once on failure."""
        with self._lock:
            for attempt in (1, 2):
                try:
                    if self._client is None or self._chan is None or self._chan.closed:
                        self._open()
                    assert self._chan is not None
                    out = hm.run_command(self._client, command, timeout=timeout, chan=self._chan)
                    self.last_ok = time.time()
                    return out
                except Exception as exc:  # noqa: BLE001
                    self.last_error = f"{type(exc).__name__}: {exc}"
                    self.close()
                    if attempt == 2:
                        raise
            return ""

    @property
    def connected(self) -> bool:
        return self._chan is not None and not self._chan.closed


class DeviceRuntime:
    """Everything tied to one device: session, latest snapshot, poller, stats."""

    def __init__(self, device: dict, interval: float, collect) -> None:
        self.device = device
        self.interval = interval
        self.collect = collect
        self.session = HuaweiSession(
            device["host"], int(device["port"]), device["username"], device["password"]
        )
        self.stop_event = threading.Event()
        self.fast: dict[str, Any] = {}          # latest fast-sample values + ts
        self.fast_interval = float(os.environ.get("MONINI_FAST_INTERVAL", "5"))
        self.slow_cache: dict[str, str] = {}
        self.slow_last: dict[str, float] = {}
        self.parsers: dict[str, Any] = {}
        self.thread = threading.Thread(target=self._loop, name=f"poller-{device['id']}", daemon=True)
        self.fast_thread = threading.Thread(
            target=self._fast_loop, name=f"fast-{device['id']}", daemon=True
        )
        self.stats: dict[str, Any] = {
            "runs": 0,
            "failures": 0,
            "last_duration": None,
            "started": time.time(),
            "last_error": None,
        }

    def start(self) -> None:
        self.thread.start()
        if self.fast_interval > 0:
            self.fast_thread.start()

    def stop(self, timeout: float = 10.0) -> None:
        self.stop_event.set()
        self.session.close()
        for thread in (self.fast_thread, self.thread):
            if thread.is_alive():
                thread.join(timeout)

    def _fast_loop(self) -> None:
        """Sample CPU/memory on a short cadence between the heavy snapshots."""
        while not self.stop_event.is_set():
            started = time.time()
            try:
                raw = {key: self.session.run(cmd, timeout=20.0) for key, cmd in FAST_COMMANDS}
                parsed = parse_fast(self.parsers, raw)
                parsed["ts"] = time.time()
                self.fast = parsed
            except Exception:  # noqa: BLE001 - the heavy loop reports failures
                pass
            elapsed = time.time() - started
            self.stop_event.wait(max(1.0, self.fast_interval - elapsed))

    def _loop(self) -> None:
        while not self.stop_event.is_set():
            started = time.time()
            try:
                snap = self.collect(self)
                self.stats["runs"] += 1
                self.stats["last_duration"] = round(time.time() - started, 2)
                self.stats["last_error"] = None
            except Exception as exc:  # noqa: BLE001
                self.stats["failures"] += 1
                self.stats["last_error"] = f"{type(exc).__name__}: {exc}"
                traceback.print_exc()
            elapsed = time.time() - started
            self.stop_event.wait(max(0.5, self.interval - elapsed))


class DeviceManager:
    def __init__(self, registry: Registry, interval: float, collect) -> None:
        self.registry = registry
        self.interval = interval
        self.collect = collect
        self._lock = threading.Lock()
        self._runtimes: dict[str, DeviceRuntime] = {}

    def start(self) -> None:
        for device in self.registry.list_devices(raw=True):
            if device.get("enabled"):
                with self._lock:
                    if device["id"] not in self._runtimes:
                        self._runtimes[device["id"]] = self._spawn(device)

    def stop(self) -> None:
        with self._lock:
            runtimes = list(self._runtimes.values())
            self._runtimes.clear()
        for rt in runtimes:
            rt.stop()

    def _spawn(self, device: dict) -> DeviceRuntime:
        rt = DeviceRuntime(device, self.interval, self.collect)
        rt.start()
        return rt

    def reload(self, device_id: str | None = None) -> None:
        """Restart one device's poller (used after edit/credentials change)."""
        with self._lock:
            targets = [device_id] if device_id else list(self._runtimes)
        for did in targets:
            self.remove(did)
        devices = self.registry.list_devices(raw=True)
        for device in devices:
            if device_id and device["id"] != device_id:
                continue
            if device.get("enabled"):
                with self._lock:
                    if device["id"] not in self._runtimes:
                        self._runtimes[device["id"]] = self._spawn(device)

    def remove(self, device_id: str) -> None:
        with self._lock:
            rt = self._runtimes.pop(device_id, None)
        if rt:
            rt.stop()

    def get(self, device_id: str) -> DeviceRuntime | None:
        with self._lock:
            return self._runtimes.get(device_id)

    def status(self) -> list[dict]:
        devices = self.registry.list_devices(raw=True)
        out = []
        with self._lock:
            runtimes = dict(self._runtimes)
        for device in devices:
            rt = runtimes.get(device["id"])
            out.append(
                {
                    **self.registry.public(device),
                    "connected": bool(rt and rt.session.connected),
                    "last_ok": rt.session.last_ok if rt else None,
                    "last_error": (rt.session.last_error if rt else None),
                    "poller": rt.stats if rt else None,
                }
            )
        return out
