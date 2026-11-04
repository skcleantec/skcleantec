"""Build GET /status payload from adb probes."""
from __future__ import annotations

import time

from automation.device_locale import read_device_locale
from automation.emulator_launcher import our_emulator_serial
from bridge_config import MISO_AVD, MISO_PACKAGE, PORT, resolve_adb, resolve_emulator
from automation.adb_client import (
    first_online_emulator,
    get_foreground_package,
    get_package_version,
    get_page_size,
    is_package_installed,
    list_devices,
    shell,
)
from automation.chat_list import is_automation_active
from version_info import APP_VERSION, BRIDGE_API_VERSION

_full_cache: tuple[float, dict] | None = None
_login_cache: dict[str, tuple[float, bool]] = {}
FULL_CACHE_TTL_SEC = 8.0
LOGIN_CACHE_TTL_SEC = 45.0


def _boot_completed(serial: str) -> bool:
    try:
        return shell(serial, 'getprop sys.boot_completed', timeout=8).strip() == '1'
    except RuntimeError:
        return False


def _probe_logged_in(serial: str) -> bool | None:
    """로그인 화면이 보이면 False. 자동 조작 중에는 마지막 결과만 쓴다."""
    now = time.time()
    cached = _login_cache.get(serial)
    if cached and now - cached[0] < LOGIN_CACHE_TTL_SEC:
        return cached[1]
    if is_automation_active():
        return cached[1] if cached else None
    try:
        from automation.chat_list import _looks_like_login_screen
        from automation.uiautomator import dump_ui

        root = dump_ui(serial, 'miso-status-login')
        logged_in = not _looks_like_login_screen(root)
    except Exception:
        return cached[1] if cached else None
    _login_cache[serial] = (now, logged_in)
    return logged_in


def resolve_setup_stage(
    *,
    devices: list,
    online_serial: str | None,
    miso_installed: bool,
    logged_in: bool | None,
    locale_korean: bool = True,
) -> str:
    emulators = [d for d in devices if str(getattr(d, 'serial', '')).startswith('emulator-')]
    if not resolve_adb().is_file():
        return 'no_emulator'
    if not emulators and not resolve_emulator().is_file():
        return 'no_emulator'
    if not emulators:
        return 'emulator_off'
    if not online_serial or not _boot_completed(online_serial):
        return 'booting'
    if not locale_korean:
        return 'locale_pending'
    if not miso_installed:
        return 'no_miso'
    if logged_in is False:
        return 'miso_logged_out'
    return 'ready'


def _base_payload(*, serial: str | None, adb_ok: bool, device_count: int, locale: str) -> dict:
    return {
        'ok': True,
        'bridgeVersion': BRIDGE_API_VERSION,
        'appVersion': APP_VERSION,
        'phase': 'motion',
        'host': '127.0.0.1',
        'port': PORT,
        'avdName': MISO_AVD,
        'locale': locale,
        'adbConnected': adb_ok,
        'emulatorReady': adb_ok,
        'emulatorSerial': serial,
        'automationActive': is_automation_active(),
        'deviceCount': device_count,
    }


def _locale_for_status(our_serial: str | None, booted: bool) -> tuple[str, bool]:
    """실제 persist/product. 한국어가 아니면 locale_pending. system_locales 단독은 성공이 아니다."""
    if not our_serial or not booted:
        return '', True
    parts = read_device_locale(our_serial)
    return parts.actual, not parts.needs_change


def build_status_payload(*, lite: bool = False) -> dict:
    """lite=1 — 폴링용 경량 조회(dumpsys·uiautomator 없음, 에뮬 마우스 방해 최소)."""
    global _full_cache

    devices = list_devices()
    our_serial = our_emulator_serial()
    online = first_online_emulator()
    serial = our_serial or (online.serial if online else None)
    adb_ok = online is not None or our_serial is not None

    if lite:
        miso_installed = is_package_installed(serial) if serial else False
        booted = bool(serial) and _boot_completed(serial)
        locale_value, locale_korean = _locale_for_status(our_serial, booted and our_serial == serial)
        logged_in = _probe_logged_in(serial) if serial and booted and miso_installed else None
        setup_stage = resolve_setup_stage(
            devices=devices,
            online_serial=serial if booted else None,
            miso_installed=miso_installed,
            logged_in=logged_in,
            locale_korean=locale_korean,
        )
        notes: list[str] = []
        if setup_stage == 'locale_pending':
            notes.append('가상폰을 한국어로 바꾸는 중')
        if is_automation_active():
            notes.append(
                '연동 프로그램이 동작 중입니다. 에뮬레이터 화면을 건드리지 말고 끝날 때까지 기다려 주세요.',
            )
        return {
            **_base_payload(serial=serial, adb_ok=adb_ok, device_count=len(devices), locale=locale_value),
            'statusMode': 'lite',
            'setupStage': setup_stage,
            'misoInstalled': miso_installed,
            'misoAppVersion': None,
            'misoForeground': None,
            'misoLoggedIn': logged_in,
            'pageSize': None,
            'notes': notes,
            'stubs': [],
        }

    now = time.time()
    if _full_cache and now - _full_cache[0] < FULL_CACHE_TTL_SEC:
        cached = dict(_full_cache[1])
        cached['automationActive'] = is_automation_active()
        cached['cached'] = True
        return cached

    miso_installed = is_package_installed(serial) if serial else False
    miso_version = get_package_version(serial) if miso_installed else None
    foreground = get_foreground_package(serial) if serial else None
    page_size = get_page_size(serial) if serial else None
    miso_foreground = foreground == MISO_PACKAGE if foreground else False

    booted = bool(serial) and _boot_completed(serial)
    locale_value, locale_korean = _locale_for_status(our_serial, booted and our_serial == serial)
    logged_in = _probe_logged_in(serial) if serial and booted and miso_installed else None
    setup_stage = resolve_setup_stage(
        devices=devices,
        online_serial=serial if booted else None,
        miso_installed=miso_installed,
        logged_in=logged_in,
        locale_korean=locale_korean,
    )
    notes: list[str] = []
    if setup_stage == 'locale_pending':
        notes.append('가상폰을 한국어로 바꾸는 중')
    if is_automation_active():
        notes.append(
            '연동 프로그램이 동작 중입니다. 에뮬레이터 화면을 건드리지 말고 끝날 때까지 기다려 주세요.',
        )

    payload = {
        **_base_payload(serial=serial, adb_ok=adb_ok, device_count=len(devices), locale=locale_value),
        'statusMode': 'full',
        'setupStage': setup_stage,
        'misoInstalled': miso_installed,
        'misoAppVersion': miso_version,
        'misoForeground': miso_foreground,
        'misoLoggedIn': logged_in,
        'misoLoggedInNote': None,
        'currentChatId': None,
        'currentChatTitle': None,
        'pageSize': page_size,
        'notes': notes,
        'stubs': [],
        'cached': False,
    }
    _full_cache = (now, payload)
    return payload
