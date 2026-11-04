"""가상폰(에뮬레이터) 창을 앞으로 띄운다. 최소화돼 있으면 복원한다."""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes

from bridge_config import MISO_AVD

SW_RESTORE = 9
HWND_TOP = 0
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002
SWP_SHOWWINDOW = 0x0040


def bring_emulator_to_front() -> tuple[bool, str]:
    if sys.platform != 'win32':
        return False, '가상폰 창은 Windows에서만 앞으로 띄울 수 있습니다.'
    user32 = ctypes.windll.user32
    needle = MISO_AVD.strip() or 'CbiseoMiso'
    found: list[int] = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def visit(hwnd: int, _lparam: int) -> bool:
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        title = buffer.value
        if needle in title:
            found.append(hwnd)
        return True

    user32.EnumWindows(visit, 0)
    if not found:
        return False, '가상폰 창을 찾지 못했습니다. 「가상폰 다시 켜기」를 눌러 주세요.'
    hwnd = found[0]
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, SW_RESTORE)
    else:
        user32.ShowWindow(hwnd, 5)
    user32.SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
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
    return True, '가상폰 화면을 앞으로 띄웠습니다.'
