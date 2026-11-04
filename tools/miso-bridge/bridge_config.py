"""Local bridge settings (override via env)."""
from __future__ import annotations

import os
from pathlib import Path

PORT = int(os.environ.get('MISO_BRIDGE_PORT', '17891'))
HOST = os.environ.get('MISO_BRIDGE_HOST', '127.0.0.1')

MISO_AVD = os.environ.get('MISO_AVD', 'CbiseoMiso')
MISO_LOCALE = os.environ.get('MISO_LOCALE', 'ko-KR')

MISO_PACKAGE = 'com.miso.cleaner'


def miso_sdk_root() -> Path:
    local = os.environ.get('LOCALAPPDATA', '')
    return Path(local) / 'Cbiseo' / 'MisoBridge' / 'sdk'


def resolve_adb() -> Path:
    env = os.environ.get('ANDROID_ADB') or os.environ.get('MISO_BRIDGE_ADB')
    if env:
        return Path(env)
    bundled = miso_sdk_root() / 'platform-tools' / 'adb.exe'
    if bundled.is_file():
        return bundled
    local = os.environ.get('LOCALAPPDATA', '')
    return Path(local) / 'Android' / 'Sdk' / 'platform-tools' / 'adb.exe'


def resolve_emulator() -> Path:
    env = os.environ.get('MISO_BRIDGE_EMULATOR')
    if env:
        return Path(env)
    bundled = miso_sdk_root() / 'emulator' / 'emulator.exe'
    if bundled.is_file():
        return bundled
    local = os.environ.get('LOCALAPPDATA', '')
    return Path(local) / 'Android' / 'Sdk' / 'emulator' / 'emulator.exe'
