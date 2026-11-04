"""Windows 단일 인스턴스. 숨고 연동 뮤텍스와 이름이 다르다.

죽었는데 잠금만 남은 경우는 하트비트(30초)와 17891 응답으로 가른다.
"""
from __future__ import annotations

import ctypes
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from ctypes import wintypes

from desktop.config import APP_DATA_DIR, append_launch_log, ensure_app_data

_MUTEX_NAME = 'Global\\CbiseoMisoBridge_V1'
_SHOW_WINDOW_FLAG = APP_DATA_DIR / 'show.window'
_HEARTBEAT = APP_DATA_DIR / 'instance.heartbeat'
_HEARTBEAT_FRESH_SEC = 30
_ERROR_ALREADY_EXISTS = 183
_mutex_handle: int | None = None


def touch_heartbeat() -> None:
    ensure_app_data()
    try:
        _HEARTBEAT.write_text(str(time.time()), encoding='utf-8')
    except OSError:
        pass


def heartbeat_fresh(now: float | None = None) -> bool:
    try:
        age = (now if now is not None else time.time()) - _HEARTBEAT.stat().st_mtime
    except OSError:
        return False
    return 0 <= age <= _HEARTBEAT_FRESH_SEC


def port_responds() -> bool:
    try:
        with urllib.request.urlopen('http://127.0.0.1:17891/status?lite=1', timeout=2) as response:
            return int(getattr(response, 'status', 200)) < 500
    except (OSError, urllib.error.URLError, TimeoutError, ValueError):
        return False


def instance_alive() -> bool:
    return heartbeat_fresh() or port_responds()


def try_acquire_single_instance() -> bool:
    global _mutex_handle
    if sys.platform != 'win32':
        return True
    if _mutex_handle is not None:
        return True
    k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    k32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
    k32.CreateMutexW.restype = wintypes.HANDLE
    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    k32.CloseHandle.restype = wintypes.BOOL
    handle = k32.CreateMutexW(None, False, _MUTEX_NAME)
    if ctypes.get_last_error() == _ERROR_ALREADY_EXISTS:
        if handle:
            k32.CloseHandle(handle)
        return False
    _mutex_handle = int(handle)
    return True


def release_single_instance() -> None:
    global _mutex_handle
    if sys.platform != 'win32' or _mutex_handle is None:
        return
    try:
        k32 = ctypes.WinDLL('kernel32')
        k32.CloseHandle.argtypes = [wintypes.HANDLE]
        k32.CloseHandle(_mutex_handle)
    except Exception:
        pass
    _mutex_handle = None


def request_show_existing_window() -> None:
    ensure_app_data()
    try:
        _SHOW_WINDOW_FLAG.write_text('1', encoding='utf-8')
    except OSError:
        pass


def consume_show_window_request() -> bool:
    if not _SHOW_WINDOW_FLAG.is_file():
        return False
    try:
        _SHOW_WINDOW_FLAG.unlink()
    except OSError:
        return False
    return True


def _install_dir() -> str:
    from desktop.config import BRIDGE_DIR

    return str(BRIDGE_DIR)


def stop_stale_processes() -> list[int]:
    """설치 폴더 안의 응답 없는 프로세스만 끝낸다. 숨고 연동 폴더는 경로가 달라 대상이 아니다."""
    if sys.platform != 'win32':
        return []
    root = _install_dir().replace("'", '')
    script = (
        "Get-CimInstance Win32_Process | Where-Object { "
        f"$_.ExecutablePath -and $_.ExecutablePath.ToLower().StartsWith('{root.lower()}') "
        f"-and $_.ProcessId -ne {os.getpid()} "
        "} | ForEach-Object { $_.ProcessId }"
    )
    try:
        result = subprocess.run(
            ['powershell', '-NoProfile', '-Command', script],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=20,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    pids: list[int] = []
    for line in (result.stdout or '').splitlines():
        text = line.strip()
        if text.isdigit():
            pids.append(int(text))
    for pid in pids:
        subprocess.run(
            ['taskkill', '/F', '/PID', str(pid)],
            capture_output=True,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    if pids:
        time.sleep(0.6)
    return pids


def resolve_single_instance() -> str:
    """acquired | show_existing."""
    if try_acquire_single_instance():
        append_launch_log('실행 판단: 새로 실행')
        touch_heartbeat()
        return 'acquired'
    if instance_alive():
        append_launch_log('실행 판단: 이미 실행 중이라 창을 띄웁니다.')
        request_show_existing_window()
        return 'show_existing'
    append_launch_log('실행 판단: 이전 실행이 응답하지 않아 잠금을 무시하고 새로 실행합니다.')
    stopped = stop_stale_processes()
    append_launch_log(f'실행 판단: 응답 없는 프로세스 종료 pid={stopped or "-"}')
    if try_acquire_single_instance():
        append_launch_log('실행 판단: 잠금을 넘기고 새로 실행합니다.')
        touch_heartbeat()
        return 'acquired'
    append_launch_log('실행 판단: 잠금을 넘기지 못해 기존 창만 요청합니다.')
    request_show_existing_window()
    return 'show_existing'
