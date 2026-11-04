"""Start the Miso AVD and open the Miso app or its install screen."""
from __future__ import annotations

import subprocess
from pathlib import Path

from automation.adb_client import first_online_emulator, list_devices, shell
from automation.uiautomator import launch_miso_app
from bridge_config import MISO_AVD, MISO_PACKAGE, resolve_emulator

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


def _emulator_visible() -> bool:
    return any(d.serial.startswith('emulator-') for d in list_devices())


def start_emulator_detached() -> tuple[bool, str]:
    if first_online_emulator() or _emulator_visible():
        _spawn_boot_helper()
        return True, '이미 켜진 가상폰을 사용합니다. 잠시 후 「다시 확인」을 눌러 주세요.'

    emu = resolve_emulator()
    if not emu.is_file():
        return False, '이 PC에서 가상폰을 켤 수 없습니다.'
    args = [
        str(emu),
        '-avd',
        MISO_AVD,
        '-gpu',
        'swiftshader_indirect',
        '-no-boot-anim',
        '-no-audio',
    ]
    try:
        subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
        )
    except OSError:
        return False, '가상폰을 켜지 못했습니다. 잠시 후 다시 시도해 주세요.'
    _spawn_boot_helper()
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
    return True, '가상폰에서 미소 설치 화면을 열었습니다.'
