"""설치본에 동봉된 Python 경로."""
from __future__ import annotations

import pathlib
import sys

BRIDGE_DIR = pathlib.Path(__file__).resolve().parent.parent
BUNDLED_PYTHON_DIR = BRIDGE_DIR / 'python'


def bundled_python_exe(*, windowed: bool = False) -> pathlib.Path | None:
    name = 'pythonw.exe' if windowed else 'python.exe'
    candidate = BUNDLED_PYTHON_DIR / name
    return candidate if candidate.is_file() else None


def _sibling(host: pathlib.Path, windowed: bool) -> pathlib.Path:
    name = 'pythonw.exe' if windowed else 'python.exe'
    sibling = host.parent / name
    return sibling if sibling.is_file() else host


def resolve_python_exe(*, windowed: bool = False) -> str:
    host = pathlib.Path(sys.executable).resolve()
    if host.name.lower() in ('python.exe', 'pythonw.exe'):
        return str(_sibling(host, windowed))
    bundled = bundled_python_exe(windowed=windowed)
    if bundled:
        return str(bundled)
    return sys.executable
