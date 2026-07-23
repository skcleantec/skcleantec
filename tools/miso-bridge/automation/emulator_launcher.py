"""Start PoC AVD (optional — used by /emulator/start later)."""
from __future__ import annotations

import subprocess
from pathlib import Path

from bridge_config import MISO_AVD, MISO_LOCALE, resolve_emulator


def start_emulator_detached() -> tuple[bool, str]:
    emu = resolve_emulator()
    if not emu.is_file():
        return False, f'emulator not found: {emu}'
    args = [
        str(emu),
        '-avd',
        MISO_AVD,
        '-gpu',
        'swiftshader_indirect',
        '-no-boot-anim',
        '-no-audio',
        f'-prop persist.sys.locale={MISO_LOCALE}',
    ]
    try:
        subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
        )
    except OSError as e:
        return False, str(e)
    return True, MISO_AVD
