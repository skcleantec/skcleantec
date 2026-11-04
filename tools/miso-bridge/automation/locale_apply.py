"""한국어가 아니면 -change-locale 로 한 번 다시 켜고, 그래도 아니면 설정 화면을 누른다."""
from __future__ import annotations

import os
import subprocess
import time

from automation.adb_client import shell
from automation.device_locale import (
    change_locale_was_tried,
    clear_locale_cache,
    clear_locale_ok_marker,
    keyboard_ui_boot_path,
    locale_ui_boot_path,
    mark_change_locale_tried,
    mark_locale_applied,
    read_device_locale,
)
from automation.uiautomator import collect_nodes, dump_ui, tap_node
from bridge_config import resolve_adb

_LOCK_NAME = 'locale-apply.lock'
_GBOARD_ID = 'com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME'
_LANGUAGE_NEEDLES = (
    'korean (south korea)',
    '한국어 (대한민국)',
    'south korea',
    '대한민국',
    'korean',
    '한국어',
)
_ADD_LANGUAGE = ('add a language', '언어 추가', '언어추가')
_MOVE_TOP = ('move to top', '맨 위로', '위로 이동', 'set as default')


def _app_data():
    from automation.device_locale import app_data_dir

    return app_data_dir()


def _log(message: str) -> None:
    try:
        from desktop.config import append_tray_event

        append_tray_event(message)
    except Exception:
        pass


def _lock_path():
    return _app_data() / _LOCK_NAME


def _acquire_lock() -> bool:
    path = _lock_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file():
        age = time.time() - path.stat().st_mtime
        if age < 20 * 60:
            return False
        try:
            path.unlink()
        except OSError:
            return False
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False
    try:
        os.write(fd, str(os.getpid()).encode())
    finally:
        os.close(fd)
    return True


def _release_lock() -> None:
    try:
        _lock_path().unlink(missing_ok=True)
    except OSError:
        pass


def _wait_lock_clear(timeout: float) -> None:
    path = _lock_path()
    deadline = time.time() + timeout
    while time.time() < deadline and path.is_file():
        time.sleep(2)


def _our_serial() -> str | None:
    from automation.emulator_launcher import our_emulator_serial

    return our_emulator_serial()


def _boot_completed(serial: str) -> bool:
    try:
        return shell(serial, 'getprop sys.boot_completed', timeout=8).strip() == '1'
    except (RuntimeError, OSError):
        return False


def _wait_our_booted(timeout: float) -> str | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        serial = _our_serial()
        if serial and _boot_completed(serial):
            return serial
        time.sleep(3)
    return None


def _wait_our_gone(timeout: float = 90) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not _our_serial():
            return True
        time.sleep(1)
    return not _our_serial()


def _keep_awake(serial: str) -> None:
    for cmd in (
        'input keyevent 224',
        'input keyevent 82',
        'wm dismiss-keyguard',
        'settings put system screen_off_timeout 2147483647',
        'svc power stayon true',
        'settings put secure show_ime_with_hard_keyboard 1',
    ):
        try:
            shell(serial, cmd, timeout=8)
        except (RuntimeError, OSError):
            pass


def _boot_id(serial: str) -> str:
    try:
        token = shell(serial, 'cat /proc/sys/kernel/random/boot_id', timeout=8).strip()
    except (RuntimeError, OSError):
        token = ''
    return token or 'unknown'


def _kill_our_emulator(serial: str) -> bool:
    from bridge_config import MISO_AVD

    try:
        name = shell(serial, 'getprop ro.boot.qemu.avd_name', timeout=8).strip()
    except (RuntimeError, OSError):
        return False
    if name != MISO_AVD:
        return False
    adb = resolve_adb()
    if not adb.is_file():
        return False
    try:
        subprocess.run(
            [str(adb), '-s', serial, 'emu', 'kill'],
            capture_output=True,
            text=True,
            timeout=20,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return _wait_our_gone()


def _automation_busy() -> bool:
    try:
        from automation.chat_list import is_automation_active

        return bool(is_automation_active())
    except Exception:
        return False


def _blob(text: str, desc: str) -> str:
    return f'{text}\n{desc}'.lower()


def _dump(serial: str):
    try:
        return dump_ui(serial, 'miso-locale')
    except (RuntimeError, OSError):
        return None


def _already_checked(serial: str, needles: tuple[str, ...]) -> bool:
    root = _dump(serial)
    if root is None:
        return False
    lowered = tuple(item.lower() for item in needles)
    for node in root.iter('node'):
        blob = f"{node.get('text') or ''}\n{node.get('content-desc') or ''}".lower()
        if 'north korea' in blob or '조선민주주의' in blob:
            continue
        if not any(needle in blob for needle in lowered):
            continue
        if node.get('checked') == 'true':
            return True
    return False


def _tap_needles(serial: str, needles: tuple[str, ...], *, scrolls: int = 4) -> bool:
    lowered = tuple(item.lower() for item in needles)
    for _ in range(scrolls + 1):
        root = _dump(serial)
        if root is None:
            return False
        fallback = None
        for node in collect_nodes(root):
            blob = _blob(node.text, node.content_desc)
            if not any(needle in blob for needle in lowered):
                continue
            if 'north korea' in blob or '조선민주주의' in blob:
                continue
            if not node.center:
                continue
            if node.clickable:
                tap_node(serial, node)
                time.sleep(1.1)
                return True
            fallback = fallback or node
        if fallback is not None:
            tap_node(serial, fallback)
            time.sleep(1.1)
            return True
        try:
            shell(serial, 'input swipe 540 1500 540 700 350', timeout=8)
        except (RuntimeError, OSError):
            return False
        time.sleep(0.6)
    return False


def _focus_search(serial: str) -> None:
    root = _dump(serial)
    if root is None:
        return
    for node in collect_nodes(root):
        blob = _blob(node.text, node.content_desc)
        rid = node.resource_id.lower()
        if 'search' in rid or 'search' in blob or '검색' in blob:
            if node.center:
                tap_node(serial, node)
                time.sleep(0.4)
                return


def _move_korean_to_top(serial: str) -> None:
    if _tap_needles(serial, _MOVE_TOP, scrolls=1):
        return
    root = _dump(serial)
    if root is None:
        return
    target = None
    for node in collect_nodes(root):
        blob = _blob(node.text, node.content_desc)
        if any(needle in blob for needle in ('한국어', 'korean', '대한민국', 'south korea')):
            if 'north korea' in blob:
                continue
            if node.center:
                target = node
                break
    if target is None or target.center is None:
        return
    x, y = target.center
    try:
        shell(serial, f'input swipe {x} {y} {x} 280 500', timeout=8)
    except (RuntimeError, OSError):
        return
    time.sleep(1)


def apply_korean_via_ui(serial: str) -> None:
    """설정 → 시스템 → 언어 → 언어 추가 → 한국어(대한민국) → 맨 위."""
    if _automation_busy():
        return
    boot_id = _boot_id(serial)
    marker = locale_ui_boot_path()
    try:
        if marker.is_file() and marker.read_text(encoding='utf-8').strip() == boot_id:
            return
    except OSError:
        pass
    try:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(boot_id, encoding='utf-8')
    except OSError:
        pass
    _log('가상폰을 한국어로 바꾸는 중')
    try:
        shell(serial, 'am start -a android.settings.LOCALE_SETTINGS', timeout=15)
    except (RuntimeError, OSError):
        try:
            shell(serial, 'am start -a android.settings.SETTINGS', timeout=15)
        except (RuntimeError, OSError):
            return
    time.sleep(1.6)
    if not _tap_needles(serial, _ADD_LANGUAGE, scrolls=2):
        _tap_needles(serial, ('system', '시스템'), scrolls=2)
        _tap_needles(serial, ('languages', 'language', '언어'), scrolls=3)
        _tap_needles(serial, _ADD_LANGUAGE, scrolls=2)
    time.sleep(0.8)
    _focus_search(serial)
    try:
        shell(serial, 'input text Korean', timeout=8)
    except (RuntimeError, OSError):
        pass
    time.sleep(0.8)
    _tap_needles(serial, _LANGUAGE_NEEDLES, scrolls=6)
    time.sleep(0.8)
    _tap_needles(serial, ('south korea', '대한민국'), scrolls=4)
    time.sleep(0.8)
    _move_korean_to_top(serial)
    try:
        shell(serial, 'input keyevent 3', timeout=8)
    except (RuntimeError, OSError):
        pass


def _gboard_korean_on(serial: str) -> bool:
    """켜진 입력기 목록에 한국어가 있을 때만 참으로 본다. 전체 언어 목록은 보지 않는다."""
    try:
        enabled = shell(serial, 'settings get secure enabled_input_methods', timeout=15).lower()
    except (RuntimeError, OSError):
        return False
    if 'inputmethod.latin' not in enabled:
        return False
    return any(token in enabled for token in ('ko_kr', 'ko-kr', ':ko', '한국어'))


def _add_gboard_korean(serial: str) -> None:
    if _automation_busy():
        return
    boot_id = _boot_id(serial)
    marker = keyboard_ui_boot_path()
    try:
        if marker.is_file() and marker.read_text(encoding='utf-8').strip() == boot_id:
            return
    except OSError:
        pass
    try:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(boot_id, encoding='utf-8')
    except OSError:
        pass
    try:
        shell(serial, f'ime enable {_GBOARD_ID}', timeout=15)
    except (RuntimeError, OSError):
        pass
    try:
        shell(
            serial,
            f'am start -a android.settings.INPUT_METHOD_SUBTYPE_SETTINGS -e input_method_id {_GBOARD_ID}',
            timeout=15,
        )
    except (RuntimeError, OSError):
        try:
            shell(serial, 'am start -a android.settings.INPUT_METHOD_SETTINGS', timeout=15)
        except (RuntimeError, OSError):
            return
    time.sleep(1.4)
    _tap_needles(serial, ('gboard',), scrolls=3)
    _tap_needles(serial, ('languages', '언어'), scrolls=3)
    _tap_needles(serial, ('add keyboard', '키보드 추가', 'add language', '언어 추가'), scrolls=2)
    _focus_search(serial)
    try:
        shell(serial, 'input text Korean', timeout=8)
    except (RuntimeError, OSError):
        pass
    time.sleep(0.6)
    if _already_checked(serial, ('korean', '한국어', 'south korea', '대한민국')):
        try:
            shell(serial, 'input keyevent 3', timeout=8)
        except (RuntimeError, OSError):
            pass
        return
    _tap_needles(serial, _LANGUAGE_NEEDLES, scrolls=5)
    _tap_needles(serial, ('south korea', '대한민국'), scrolls=3)
    try:
        shell(serial, 'input keyevent 3', timeout=8)
    except (RuntimeError, OSError):
        pass


def ensure_korean_keyboard(serial: str) -> None:
    if _gboard_korean_on(serial):
        return
    _add_gboard_korean(serial)


def _confirm_korean(serial: str) -> bool:
    clear_locale_cache()
    parts = read_device_locale(serial, max_age=0)
    if not parts.props_korean:
        time.sleep(2)
        clear_locale_cache()
        parts = read_device_locale(serial, max_age=0)
    if parts.props_korean:
        mark_locale_applied()
        ensure_korean_keyboard(serial)
        _log(f'가상폰 표시 언어: {parts.actual}')
        return True
    return False


def _apply() -> None:
    serial = _wait_our_booted(180)
    if not serial:
        return
    _keep_awake(serial)
    if _confirm_korean(serial):
        return
    if _automation_busy():
        _log('가상폰을 한국어로 바꾸는 중')
        return
    if not change_locale_was_tried():
        mark_change_locale_tried()
        clear_locale_ok_marker()
        if _kill_our_emulator(serial):
            from automation.emulator_launcher import launch_our_emulator

            if not launch_our_emulator(force_change_locale=True):
                _log('가상폰을 한국어로 바꾸는 중')
                return
            serial = _wait_our_booted(240)
            if not serial:
                _log('가상폰을 한국어로 바꾸는 중')
                return
            _keep_awake(serial)
            if _confirm_korean(serial):
                return
    if serial and not _automation_busy():
        apply_korean_via_ui(serial)
        ensure_korean_keyboard(serial)
        if not _confirm_korean(serial):
            _log('가상폰을 한국어로 바꾸는 중')


def finish_locale_after_boot() -> int:
    """부팅 도우미에서 호출. 실패해도 설치 마법사를 막지 않도록 0을 반환한다."""
    try:
        if not _acquire_lock():
            _wait_lock_clear(600)
            serial = _our_serial()
            if serial and _boot_completed(serial):
                _confirm_korean(serial)
            return 0
        try:
            _apply()
        finally:
            _release_lock()
    except Exception as exc:
        _log(f'가상폰을 한국어로 바꾸는 중 ({exc})')
        _release_lock()
    return 0


if __name__ == '__main__':
    raise SystemExit(finish_locale_after_boot())
