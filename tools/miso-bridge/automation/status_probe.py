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
                '연동 프로그램이 동작 중입니다. 에뮬레이터 화면을 건드리지 말고 끝날 때까지 기다려 주세요.',
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
    if online and not miso_installed:
        notes.append('에뮬레이터에 미소 파트너 앱을 설치하고 로그인해 주세요.')
    if online and miso_installed and not miso_foreground:
        notes.append('에뮬레이터에서 미소 앱을 연 뒤 채팅 목록을 열어 주세요.')
    if is_automation_active():
        notes.append(
            '연동 프로그램이 동작 중입니다. 에뮬레이터 화면을 건드리지 말고 끝날 때까지 기다려 주세요.',
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
