"""가상폰(에뮬레이터) 창. 새로 켠 직후 한 번만 최소화하고, 사용자가 열면 그대로 둔다."""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes

from bridge_config import MISO_AVD

SW_RESTORE = 9
SW_MINIMIZE = 6
HWND_TOP = 0
SWP_SHOWWINDOW = 0x0040
_HUMAN_STAGES = frozenset({'no_miso', 'miso_logged_out'})
_user_opened = False
_minimized_hwnds: set[int] = set()
_revealed_reasons: set[str] = set()


class _Rect(ctypes.Structure):
    _fields_ = [
        ('left', ctypes.c_long),
        ('top', ctypes.c_long),
        ('right', ctypes.c_long),
        ('bottom', ctypes.c_long),
    ]


def reset_emulator_window_state() -> None:
    """테스트용. 프로세스 안의 창 정책만 비운다."""
    global _user_opened
    _user_opened = False
    _minimized_hwnds.clear()
    _revealed_reasons.clear()


def user_opened_emulator() -> bool:
    return _user_opened


def mark_user_opened() -> None:
    global _user_opened
    _user_opened = True


def _install_reveal_path():
    from desktop.config import APP_DATA_DIR

    return APP_DATA_DIR / 'reveal.install'


def note_install_screen_opened() -> None:
    """첫 설치 마법사·설치 화면 열기 직후. 트레이가 창을 앞으로 띄울 때까지 남긴다."""
    from desktop.config import ensure_app_data

    ensure_app_data()
    try:
        _install_reveal_path().write_text('1', encoding='utf-8')
    except OSError:
        pass


def install_reveal_pending() -> bool:
    try:
        return _install_reveal_path().is_file()
    except OSError:
        return False


def clear_install_reveal() -> None:
    try:
        _install_reveal_path().unlink()
    except OSError:
        pass


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


def _show_window(hwnd: int, cmd: int) -> None:
    if sys.platform != 'win32':
        return
    ctypes.windll.user32.ShowWindow(hwnd, cmd)


def _is_iconic(hwnd: int) -> bool:
    if sys.platform != 'win32':
        return False
    return bool(ctypes.windll.user32.IsIconic(hwnd))


def _restore_and_focus(hwnd: int, anchor=None) -> None:
    if sys.platform != 'win32':
        return
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


def _reveal_reason(setup_stage: str, install_reveal: bool) -> str:
    if install_reveal:
        return 'install'
    if setup_stage in _HUMAN_STAGES:
        return setup_stage
    return ''


def sync_emulator_visibility(
    *,
    setup_stage: str = '',
    automation_active: bool = False,
    always_visible: bool = False,
    install_reveal: bool = False,
) -> str:
    """leave | minimize | show. 자동화 중에는 창을 건드리지 않는다."""
    global _user_opened
    if automation_active:
        return 'leave'
    hwnd = _find_hwnd()
    if hwnd and hwnd in _minimized_hwnds and not _is_iconic(hwnd):
        _user_opened = True
    reason = _reveal_reason(setup_stage, install_reveal)
    if reason and hwnd and reason not in _revealed_reasons:
        if _user_opened and not _is_iconic(hwnd):
            _revealed_reasons.add(reason)
            return 'show'
        else:
            ok, _message = bring_emulator_to_front(None)
            if not ok:
                return 'leave'
            _revealed_reasons.add(reason)
            return 'show'
    if _user_opened or always_visible:
        return 'leave'
    if reason:
        return 'leave'
    if not hwnd or hwnd in _minimized_hwnds:
        return 'leave'
    _minimized_hwnds.add(hwnd)
    _show_window(hwnd, SW_MINIMIZE)
    return 'minimize'


def minimize_emulator_window() -> None:
    """호환용. 같은 핸들은 한 번만 최소화한다."""
    sync_emulator_visibility()


def bring_emulator_to_front(anchor=None) -> tuple[bool, str]:
    """상태 창이 있으면 그 오른쪽에 붙여 복원하고, 없으면 앞으로만 띄운다."""
    if sys.platform != 'win32':
        return False, '가상폰 창은 Windows에서만 앞으로 띄울 수 있습니다.'
    hwnd = _find_hwnd()
    if not hwnd:
        return False, '가상폰 창을 찾지 못했습니다. 잠시 후 다시 눌러 주세요.'
    mark_user_opened()
    _restore_and_focus(hwnd, anchor)
    return True, '가상폰 화면을 상태 창 옆에 열었습니다.'
