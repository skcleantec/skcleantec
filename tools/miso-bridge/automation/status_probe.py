"""Build GET /status payload from adb probes."""
from __future__ import annotations

import time

from bridge_config import MISO_AVD, MISO_LOCALE, MISO_PACKAGE, PORT
from automation.adb_client import (
    first_online_emulator,
    get_foreground_package,
    get_package_version,
    get_page_size,
    is_package_installed,
    list_devices,
)
from automation.chat_list import is_automation_active
from version_info import APP_VERSION, BRIDGE_API_VERSION

_full_cache: tuple[float, dict] | None = None
FULL_CACHE_TTL_SEC = 8.0


def _base_payload(*, serial: str | None, adb_ok: bool, device_count: int) -> dict:
    return {
        'ok': True,
        'bridgeVersion': BRIDGE_API_VERSION,
        'appVersion': APP_VERSION,
        'phase': 'motion',
        'host': '127.0.0.1',
        'port': PORT,
        'avdName': MISO_AVD,
        'locale': MISO_LOCALE,
        'adbConnected': adb_ok,
        'emulatorReady': adb_ok,
        'emulatorSerial': serial,
        'automationActive': is_automation_active(),
        'deviceCount': device_count,
    }


def build_status_payload(*, lite: bool = False) -> dict:
    """lite=1 — 폴링용 경량 조회(dumpsys·uiautomator 없음, 에뮬 마우스 방해 최소)."""
    global _full_cache

    devices = list_devices()
    online = first_online_emulator()
    serial = online.serial if online else None
    adb_ok = online is not None

    if lite:
        miso_installed = is_package_installed(serial) if online else False
        notes: list[str] = []
        if is_automation_active():
            notes.append(
                '브릿지 자동화 실행 중 — 에뮬 마우스/터치가 잠시 먹지 않을 수 있습니다. 완료 후 사용하세요.',
            )
        return {
            **_base_payload(serial=serial, adb_ok=adb_ok, device_count=len(devices)),
            'statusMode': 'lite',
            'misoInstalled': miso_installed,
            'misoAppVersion': None,
            'misoForeground': None,
            'misoLoggedIn': None,
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

    miso_installed = is_package_installed(serial) if online else False
    miso_version = get_package_version(serial) if miso_installed else None
    foreground = get_foreground_package(serial) if online else None
    page_size = get_page_size(serial) if online else None
    miso_foreground = foreground == MISO_PACKAGE if foreground else False

    notes: list[str] = []
    if page_size == 16384:
        notes.append('AVD page size 16KB — some apps may hang; prefer API 34 Play image.')
    if online and not miso_installed:
        notes.append('Install Miso Partner (com.miso.cleaner) on emulator.')
    if online and miso_installed and not miso_foreground:
        notes.append('Open Miso app on emulator for full automation later.')
    if is_automation_active():
        notes.append(
            '브릿지 자동화 실행 중 — 에뮬 마우스/터치가 잠시 먹지 않을 수 있습니다. 완료 후 사용하세요.',
        )

    payload = {
        **_base_payload(serial=serial, adb_ok=adb_ok, device_count=len(devices)),
        'statusMode': 'full',
        'misoInstalled': miso_installed,
        'misoAppVersion': miso_version,
        'misoForeground': miso_foreground,
        'misoLoggedIn': None,
        'misoLoggedInNote': '로그인 여부는 모션 연결 단계에서 UIAutomator로 판별 예정',
        'currentChatId': None,
        'currentChatTitle': None,
        'pageSize': page_size,
        'notes': notes,
        'stubs': [],
        'cached': False,
    }
    _full_cache = (now, payload)
    return payload
