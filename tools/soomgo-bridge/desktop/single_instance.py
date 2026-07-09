"""Windows 단일 인스턴스 — 중복 실행 시 기존 창만 표시"""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes

from desktop.config import APP_DATA_DIR, ensure_app_data

_MUTEX_NAME = 'Global\\CbiseoSoomgoBridge_V1'
_SHOW_WINDOW_FLAG = APP_DATA_DIR / 'show.window'
_ERROR_ALREADY_EXISTS = 183

# CreateMutex 핸들을 프로세스 종료까지 유지해야 잠금이 풀리지 않음
_mutex_handle: int | None = None


def try_acquire_single_instance() -> bool:
    """True면 이 프로세스가 유일한 인스턴스."""
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
    last_err = ctypes.get_last_error()
    if last_err == _ERROR_ALREADY_EXISTS:
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
    """이미 실행 중인 인스턴스에 상태창 표시를 요청."""
    ensure_app_data()
    try:
        _SHOW_WINDOW_FLAG.write_text('1', encoding='utf-8')
    except OSError:
        pass


def consume_show_window_request() -> bool:
    """표시 요청 플래그가 있으면 소비 후 True."""
    if not _SHOW_WINDOW_FLAG.exists():
        return False
    try:
        _SHOW_WINDOW_FLAG.unlink(missing_ok=True)
    except OSError:
        pass
    return True
