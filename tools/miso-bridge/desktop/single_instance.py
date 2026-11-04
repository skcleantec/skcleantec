"""Windows 단일 인스턴스. 숨고 연동 뮤텍스와 이름이 다르다."""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes

from desktop.config import APP_DATA_DIR, ensure_app_data

_MUTEX_NAME = 'Global\\CbiseoMisoBridge_V1'
_SHOW_WINDOW_FLAG = APP_DATA_DIR / 'show.window'
_ERROR_ALREADY_EXISTS = 183
_mutex_handle: int | None = None


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
