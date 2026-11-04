"""Start the Miso AVD and open the Miso app or its install screen."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from automation.adb_client import first_online_emulator, list_devices, shell
from automation.device_locale import change_locale_args, locale_already_applied, mark_change_locale_tried, read_device_locale
from automation.uiautomator import launch_miso_app
from bridge_config import MISO_AVD, MISO_PACKAGE, miso_sdk_root, resolve_emulator

_ROOT = Path(__file__).resolve().parents[1]


def _spawn_boot_helper() -> None:
    helper = _ROOT / 'emulator-boot-helper.bat'
    if not helper.is_file():
        return
    subprocess.Popen(
        ['cmd', '/c', str(helper)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
    )


def _avd_name(serial: str) -> str:
    try:
        return shell(serial, 'getprop ro.boot.qemu.avd_name', timeout=8).strip()
    except (RuntimeError, OSError):
        return ''


def _online_emulators() -> list:
    return [d for d in list_devices() if d.serial.startswith('emulator-') and d.state == 'device']


def our_emulator_serial() -> str | None:
    for device in _online_emulators():
        if _avd_name(device.serial) == MISO_AVD:
            return device.serial
    return None


def our_emulator_online() -> bool:
    return our_emulator_serial() is not None


def foreign_emulator_online() -> bool:
    return any(_avd_name(d.serial) != MISO_AVD for d in _online_emulators())


def launch_our_emulator(*, force_change_locale: bool = False) -> bool:
    emu = resolve_emulator()
    if not emu.is_file():
        return False
    extra = ['-change-locale', 'ko-KR'] if force_change_locale else change_locale_args()
    if force_change_locale:
        mark_change_locale_tried()
    args = [
        str(emu),
        '-avd',
        MISO_AVD,
        '-gpu',
        'swiftshader_indirect',
        '-no-boot-anim',
        '-no-audio',
        *extra,
    ]
    env = os.environ.copy()
    sdk = miso_sdk_root()
    env['ANDROID_SDK_ROOT'] = str(sdk)
    env['ANDROID_HOME'] = str(sdk)
    try:
        subprocess.Popen(
            args,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
        )
    except OSError:
        return False
    return True


def _locale_change_pending() -> bool:
    if not locale_already_applied():
        return True
    serial = our_emulator_serial()
    if not serial:
        return False
    try:
        return read_device_locale(serial, max_age=0).needs_change
    except (RuntimeError, OSError):
        return False


def start_emulator_detached() -> tuple[bool, str]:
    if our_emulator_online():
        pending = _locale_change_pending()
        _spawn_boot_helper()
        if pending:
            return True, '가상폰을 한국어로 바꾸는 중'
        return True, '가상폰이 이미 켜져 있습니다. 잠시 후 「다시 확인」을 눌러 주세요.'
    if foreign_emulator_online():
        return False, '다른 가상폰이 켜져 있어요. 닫고 계속'

    if not launch_our_emulator():
        if not resolve_emulator().is_file():
            return False, '이 PC에서 가상폰을 켤 수 없습니다.'
        return False, '가상폰을 켜지 못했습니다. 잠시 후 다시 시도해 주세요.'
    _spawn_boot_helper()
    if not locale_already_applied():
        return True, '가상폰을 한국어로 바꾸는 중'
    return True, '가상폰을 켜는 중입니다. 잠시 후 「다시 확인」을 눌러 주세요.'


def open_miso_app() -> tuple[bool, str]:
    device = first_online_emulator()
    if not device:
        return False, '가상폰이 켜진 뒤에 미소 앱을 열 수 있습니다.'
    try:
        launch_miso_app(device.serial)
    except RuntimeError:
        return False, '미소 앱을 열지 못했습니다. 가상폰이 켜진 뒤 다시 시도해 주세요.'
    return True, '가상폰에서 미소 앱을 열었습니다. 로그인한 뒤 「다시 확인」을 눌러 주세요.'


def open_miso_install_screen() -> tuple[bool, str]:
    device = first_online_emulator()
    if not device:
        return False, '가상폰이 켜진 뒤에 설치 화면을 열 수 있습니다.'
    try:
        shell(
            device.serial,
            f'am start -a android.intent.action.VIEW -d market://details?id={MISO_PACKAGE}',
            timeout=20,
        )
    except RuntimeError:
        return False, '미소 설치 화면을 열지 못했습니다. 가상폰에서 Play 스토어가 보이는지 확인해 주세요.'
    return True, '가상폰에서 미소 설치 화면을 열었습니다. 구글 로그인 후 「설치」를 눌러 주세요.'
