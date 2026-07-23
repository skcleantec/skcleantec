"""Type text on Android emulator (Korean via clipboard paste)."""
from __future__ import annotations

import base64
import re

from automation.adb_client import shell


def _is_mostly_ascii(text: str) -> bool:
    return all(ord(ch) < 128 for ch in text)


def _adb_input_text(serial: str | None, text: str) -> None:
    escaped = text.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$')
    escaped = escaped.replace(' ', '%s')
    shell(serial, f'input text "{escaped}"')


def set_clipboard(serial: str | None, text: str) -> None:
    b64 = base64.b64encode(text.encode('utf-8')).decode('ascii')
    shell(serial, f'echo {b64} | base64 -d > /sdcard/miso_bridge_clip.txt')
    attempts = (
        'clip=$(cat /sdcard/miso_bridge_clip.txt); cmd clipboard set "$clip"',
        'clip=$(cat /sdcard/miso_bridge_clip.txt); cmd clipboard set-text "$clip"',
        'clip=$(cat /sdcard/miso_bridge_clip.txt); service call clipboard 2 i32 1 i32 0 s16 com.android.shell s16 "$clip"',
    )
    last_err = 'clipboard set failed'
    for cmd in attempts:
        try:
            shell(serial, cmd)
            return
        except RuntimeError as e:
            last_err = str(e)
    raise RuntimeError(last_err)


def paste_clipboard(serial: str | None) -> None:
    shell(serial, 'input keyevent 279')


def clear_focused_input(serial: str | None, max_backspace: int = 120) -> None:
    shell(serial, 'input keyevent 123')
    for _ in range(max_backspace):
        shell(serial, 'input keyevent 67')


def type_into_field(serial: str | None, text: str) -> None:
    if not text:
        raise ValueError('empty message')
    clear_focused_input(serial)
    if _is_mostly_ascii(text) and not re.search(r'[%&<>|]', text):
        try:
            _adb_input_text(serial, text)
            return
        except RuntimeError:
            pass
    set_clipboard(serial, text)
    paste_clipboard(serial)
