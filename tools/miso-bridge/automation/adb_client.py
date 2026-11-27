"""ADB helpers for emulator + Miso app probes."""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from bridge_config import MISO_PACKAGES, resolve_adb


@dataclass
class AdbDevice:
    serial: str
    state: str


def _run(args: list[str], timeout: float = 30.0) -> tuple[int, str, str]:
    adb = resolve_adb()
    if not adb.is_file():
        return 127, '', f'adb not found: {adb}'
    try:
        proc = subprocess.run(
            [str(adb), *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding='utf-8',
            errors='replace',
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except subprocess.TimeoutExpired:
        return 124, '', f'adb timeout after {timeout}s'
    return proc.returncode, proc.stdout or '', proc.stderr or ''


def list_devices() -> list[AdbDevice]:
    code, out, _ = _run(['devices'])
    if code != 0:
        return []
    devices: list[AdbDevice] = []
    for line in out.splitlines()[1:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) >= 2:
            devices.append(AdbDevice(serial=parts[0], state=parts[1]))
    return devices


def first_online_emulator() -> AdbDevice | None:
    for d in list_devices():
        if d.serial.startswith('emulator-') and d.state == 'device':
            return d
    return None


def shell_result(serial: str | None, command: str, timeout: float = 30.0) -> tuple[int, str, str]:
    args = ['shell', command]
    if serial:
        args = ['-s', serial, *args]
    return _run(args, timeout=timeout)


def shell(serial: str | None, command: str, timeout: float = 30.0) -> str:
    code, out, err = shell_result(serial, command, timeout=timeout)
    if code != 0:
        raise RuntimeError(err.strip() or out.strip() or f'adb shell failed ({code})')
    return out.strip()


def installed_miso_package(serial: str | None) -> str | None:
    """설치된 미소 패키지. 최신 앱(com.miso)을 먼저 본다."""
    for package in MISO_PACKAGES:
        try:
            out = shell(serial, f'pm path {package}')
        except RuntimeError:
            continue
        if out.startswith('package:'):
            return package
    return None


def is_miso_package(package: str | None) -> bool:
    return bool(package) and package in MISO_PACKAGES


def is_package_installed(serial: str | None) -> bool:
    return installed_miso_package(serial) is not None


def get_package_version(serial: str | None) -> str | None:
    package = installed_miso_package(serial)
    if not package:
        return None
    try:
        out = shell(serial, f'dumpsys package {package}')
    except RuntimeError:
        return None
    for line in out.splitlines():
        if 'versionName=' in line:
            m = re.search(r'versionName=([^\s]+)', line)
            if m:
                return m.group(1)
    return None


def get_foreground_package(serial: str | None) -> str | None:
    try:
        out = shell(serial, 'dumpsys window', timeout=15)
    except RuntimeError:
        return None
    focus = ''
    for line in out.splitlines():
        if 'mCurrentFocus=' in line or 'mFocusedApp=' in line:
            focus += line + '\n'
    if 'Not Responding' in focus or '응답하지 않음' in focus:
        return None
    m = re.search(r'mCurrentFocus=Window\{[^ ]+ u0 ([^/]+)/', out)
    if m:
        pkg = m.group(1).strip()
        if pkg and 'Not Responding' not in pkg:
            return pkg
    m = re.search(r'mFocusedApp=ActivityRecord\{[^ ]+ u0 ([^/]+)/', out)
    if m:
        pkg = m.group(1).strip()
        if pkg and 'Not Responding' not in pkg:
            return pkg
    return None


def get_page_size(serial: str | None) -> int | None:
    try:
        out = shell(serial, 'getconf PAGE_SIZE')
        return int(out.strip())
    except (RuntimeError, ValueError):
        return None


def tap(serial: str | None, x: int, y: int) -> None:
    shell(serial, f'input tap {x} {y}')


def pull_file(serial: str | None, remote: str, local: Path) -> None:
    args = ['pull', remote, str(local)]
    if serial:
        args = ['-s', serial, *args]
    code, out, err = _run(args, timeout=60)
    if code != 0:
        raise RuntimeError(err.strip() or out.strip() or f'adb pull failed ({code})')
