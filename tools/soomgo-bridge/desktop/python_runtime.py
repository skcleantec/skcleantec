"""설치본 번들 Python · 개발 PC 시스템 Python 경로."""
from __future__ import annotations

import os
import pathlib
import sys

BRIDGE_DIR = pathlib.Path(__file__).resolve().parent.parent
BUNDLED_PYTHON_DIR = BRIDGE_DIR / 'python'


def bundled_python_exe(*, windowed: bool = False) -> pathlib.Path | None:
    name = 'pythonw.exe' if windowed else 'python.exe'
    candidate = BUNDLED_PYTHON_DIR / name
    return candidate if candidate.is_file() else None


def resolve_python_exe(*, windowed: bool = False) -> str:
    bundled = bundled_python_exe(windowed=windowed)
    if bundled:
        return str(bundled)
    exe = sys.executable
    if windowed and sys.platform == 'win32' and exe.lower().endswith('python.exe'):
        candidate = exe[:-10] + 'pythonw.exe'
        if os.path.isfile(candidate):
            return candidate
    return exe


def using_bundled_python() -> bool:
    return bundled_python_exe(windowed=False) is not None
