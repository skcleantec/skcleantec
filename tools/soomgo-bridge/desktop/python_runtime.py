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


def _sibling_python_exe(host: pathlib.Path) -> pathlib.Path:
    """pythonw ↔ python.exe (같은 폴더)."""
    name = host.name.lower()
    if name == 'pythonw.exe':
        sibling = host.parent / 'python.exe'
        return sibling if sibling.is_file() else host
    if name == 'python.exe':
        return host
    return host


def _sibling_pythonw(host: pathlib.Path) -> pathlib.Path:
    name = host.name.lower()
    if name == 'pythonw.exe':
        return host
    if name == 'python.exe':
        sibling = host.parent / 'pythonw.exe'
        return sibling if sibling.is_file() else host
    return host


def resolve_python_exe(*, windowed: bool = False) -> str:
    """
    서브프로세스·pip용 Python.

    **현재 tray_app이 돌아가는 인터프리터와 동일 설치본을 우선**한다.
    (개발 PC에서 system python + 설치 폴더 bundled python이 공존할 때
    server.py만 번들로 띄워 import 실패(code 1) 나는 문제 방지)
    """
    host = pathlib.Path(sys.executable).resolve()
    if host.suffix.lower() == '.exe' and host.name.lower() in ('python.exe', 'pythonw.exe'):
        if windowed:
            return str(_sibling_pythonw(host))
        return str(_sibling_python_exe(host))

    bundled = bundled_python_exe(windowed=windowed)
    if bundled:
        return str(bundled)
    return sys.executable


def using_bundled_python() -> bool:
    try:
        host = pathlib.Path(sys.executable).resolve()
        bundled = bundled_python_exe(windowed=False)
        if bundled and host == bundled.resolve():
            return True
        bundled_w = bundled_python_exe(windowed=True)
        return bool(bundled_w and host == bundled_w.resolve())
    except OSError:
        return bundled_python_exe(windowed=False) is not None
