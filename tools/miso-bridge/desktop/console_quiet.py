"""콘솔 창을 띄우지 않고 실행하고, 이미 뜬 검은 창은 숨긴다."""
from __future__ import annotations

import ctypes
import subprocess
import sys
from ctypes import wintypes
from pathlib import Path

CREATE_NO_WINDOW = 0x08000000
CREATE_NEW_PROCESS_GROUP = 0x00000200
SW_HIDE = 0
SW_MINIMIZE = 6
SW_RESTORE = 9

_MISO_MARK = '\\cbiseo\\misobridge\\'
_kept: list[subprocess.Popen] = []


def no_window_flags() -> int:
    return CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP


def spawn_hidden(
    args: list[str],
    *,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    log_path: Path | None = None,
) -> subprocess.Popen | None:
    """콘솔 창 없이 실행한다. 로그 경로가 있으면 그 파일로 출력한다."""
    stdout = subprocess.DEVNULL
    handle = None
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handle = log_path.open('ab')
        stdout = handle
    try:
        proc = subprocess.Popen(
            args,
            cwd=cwd,
            env=env,
            stdout=stdout,
            stderr=subprocess.STDOUT if handle is not None else subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            creationflags=no_window_flags(),
            close_fds=True,
        )
    except OSError:
        if handle is not None:
            handle.close()
        return None
    _kept.append(proc)
    return proc


def _parent_pid(pid: int) -> int:
    if pid <= 0:
        return 0
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    ntdll = ctypes.WinDLL('ntdll')
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    ntdll.NtQueryInformationProcess.argtypes = [
        wintypes.HANDLE,
        ctypes.c_ulong,
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_void_p,
    ]
    ntdll.NtQueryInformationProcess.restype = ctypes.c_long

    class _Basic(ctypes.Structure):
        _fields_ = [
            ('Reserved1', ctypes.c_void_p),
            ('PebBaseAddress', ctypes.c_void_p),
            ('Reserved2', ctypes.c_void_p * 2),
            ('UniqueProcessId', ctypes.c_void_p),
            ('InheritedFromUniqueProcessId', ctypes.c_void_p),
        ]

    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        return 0
    try:
        info = _Basic()
        status = ntdll.NtQueryInformationProcess(
            handle, 0, ctypes.byref(info), ctypes.sizeof(info), None
        )
        if status != 0:
            return 0
        return int(info.InheritedFromUniqueProcessId or 0)
    finally:
        kernel.CloseHandle(handle)


def _belongs_to_miso(pid: int) -> bool:
    seen: set[int] = set()
    current = pid
    for _ in range(5):
        if current <= 0 or current in seen:
            return False
        seen.add(current)
        if _MISO_MARK in _process_path(current).lower():
            return True
        current = _parent_pid(current)
    return False


def _process_path(pid: int) -> str:
    if pid <= 0:
        return ''
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD),
    ]
    kernel.QueryFullProcessImageNameW.restype = wintypes.BOOL
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        return ''
    try:
        size = wintypes.DWORD(1024)
        buffer = ctypes.create_unicode_buffer(1024)
        if not kernel.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
            return ''
        return buffer.value
    finally:
        kernel.CloseHandle(handle)


def hide_miso_consoles() -> int:
    """미소 연동 프로세스의 검은 콘솔만 숨긴다. 가상폰 화면은 건드리지 않는다."""
    if sys.platform != 'win32':
        return 0
    user32 = ctypes.windll.user32
    hidden = 0

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def visit(hwnd: int, _lparam: int) -> bool:
        nonlocal hidden
        class_name = ctypes.create_unicode_buffer(128)
        user32.GetClassNameW(hwnd, class_name, 128)
        if class_name.value != 'ConsoleWindowClass':
            return True
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if not _belongs_to_miso(int(pid.value)):
            return True
        user32.ShowWindow(hwnd, SW_HIDE)
        hidden += 1
        return True

    user32.EnumWindows(visit, 0)
    return hidden
