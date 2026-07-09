"""Windows 단일 인스턴스 — 중복 실행 시 기존 창만 표시"""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes

from desktop.config import APP_DATA_DIR, ensure_app_data

_MUTEX_NAME = 'Global\\CbiseoSoomgoBridge_V1'
_SHOW_WINDOW_FLAG = APP_DATA_DIR / 'show.window'
_ERROR_ALREADY_EXISTS = 183


def try_acquire_single_instance() -> bool:
    """True면 이 프로세스가 유일한 인스턴스."""
    if sys.platform != 'win32':
        return True
    k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    k32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
    k32.CreateMutexW.restype = wintypes.HANDLE
    handle = k32.CreateMutexW(None, False, _MUTEX_NAME)
    if ctypes.get_last_error() == _ERROR_ALREADY_EXISTS:
        if handle:
            k32.CloseHandle(handle)
        return False
    return True


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
