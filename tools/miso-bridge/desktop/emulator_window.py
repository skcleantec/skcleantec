"""가상폰(에뮬레이터) 창을 앞으로 띄운다. 최소화돼 있으면 복원한다."""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes

from bridge_config import MISO_AVD

SW_RESTORE = 9
SW_MINIMIZE = 6
HWND_TOP = 0
SWP_SHOWWINDOW = 0x0040
_user_opened = False


class _Rect(ctypes.Structure):
    _fields_ = [
        ('left', ctypes.c_long),
        ('top', ctypes.c_long),
        ('right', ctypes.c_long),
        ('bottom', ctypes.c_long),
    ]


def _find_hwnd() -> int | None:
    if sys.platform != 'win32':
        return None
    user32 = ctypes.windll.user32
    needle = MISO_AVD.strip() or 'CbiseoMiso'
    found: list[int] = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def visit(hwnd: int, _lparam: int) -> bool:
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        class_name = ctypes.create_unicode_buffer(128)
        user32.GetClassNameW(hwnd, class_name, 128)
        if class_name.value == 'ConsoleWindowClass':
            return True
        if needle in buffer.value:
            found.append(hwnd)
        return True

    user32.EnumWindows(visit, 0)
    return found[0] if found else None


def minimize_emulator_window() -> None:
    """사용자가 화면 보기를 누르기 전에는 가상폰 창을 최소화한다."""
    if _user_opened or sys.platform != 'win32':
        return
    hwnd = _find_hwnd()
    if not hwnd:
        return
    ctypes.windll.user32.ShowWindow(hwnd, SW_MINIMIZE)


def bring_emulator_to_front(anchor=None) -> tuple[bool, str]:
    """상태 창이 있으면 그 오른쪽에 붙여 복원하고, 없으면 앞으로만 띄운다."""
    if sys.platform != 'win32':
        return False, '가상폰 창은 Windows에서만 앞으로 띄울 수 있습니다.'
    hwnd = _find_hwnd()
    if not hwnd:
        return False, '가상폰 창을 찾지 못했습니다. 잠시 후 다시 눌러 주세요.'
    global _user_opened
    _user_opened = True
    user32 = ctypes.windll.user32
    user32.ShowWindow(hwnd, SW_RESTORE)
    rect = _Rect()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    width = max(320, rect.right - rect.left)
    height = max(480, rect.bottom - rect.top)
    x = rect.left
    y = rect.top
    if anchor is not None:
        try:
            anchor.update_idletasks()
            x = int(anchor.winfo_rootx()) + int(anchor.winfo_width()) + 8
            y = int(anchor.winfo_rooty())
        except Exception:
            pass
    user32.SetWindowPos(hwnd, HWND_TOP, x, y, width, height, SWP_SHOWWINDOW)
    foreground = user32.GetForegroundWindow()
    foreground_thread = user32.GetWindowThreadProcessId(foreground, None)
    target_thread = user32.GetWindowThreadProcessId(hwnd, None)
    attached = False
    if foreground_thread and target_thread and foreground_thread != target_thread:
        attached = bool(user32.AttachThreadInput(foreground_thread, target_thread, True))
    user32.BringWindowToTop(hwnd)
    user32.SetForegroundWindow(hwnd)
    if attached:
        user32.AttachThreadInput(foreground_thread, target_thread, False)
    return True, '가상폰 화면을 상태 창 옆에 열었습니다.'
