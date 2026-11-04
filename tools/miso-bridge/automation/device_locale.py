"""가상폰 표시 언어. system_locales 만으로는 한국어로 보지 않는다."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path

from automation.adb_client import shell


def app_data_dir() -> Path:
    return Path(os.environ.get('LOCALAPPDATA', '')) / 'Cbiseo' / 'MisoBridge'


def locale_ok_path() -> Path:
    return app_data_dir() / 'locale-ko.ok'


def locale_change_tried_path() -> Path:
    return app_data_dir() / 'locale-change.tried'


def locale_ui_boot_path() -> Path:
    return app_data_dir() / 'locale-ui.boot'


def keyboard_ui_boot_path() -> Path:
    return app_data_dir() / 'keyboard-ui.boot'


def meaningful_locale(value: str | None) -> str:
    text = (value or '').strip().strip('\r')
    if text.lower() in ('', 'null', 'none'):
        return ''
    return text


def is_korean_locale(value: str | None) -> bool:
    token = meaningful_locale(value).lower().replace('_', '-')
    return token == 'ko' or token.startswith('ko-')


@dataclass(frozen=True)
class DeviceLocale:
    persist: str
    product: str
    system_locales: str

    @property
    def actual(self) -> str:
        """화면 언어. persist → product. system_locales 만 있으면 빈 값으로 둔다."""
        for value in (self.persist, self.product):
            if meaningful_locale(value):
                return meaningful_locale(value)
        return ''

    @property
    def props_korean(self) -> bool:
        return is_korean_locale(self.persist) or is_korean_locale(self.product)

    @property
    def needs_change(self) -> bool:
        """persist·product 가 한국어가 아니면 바꿔야 한다. system_locales 단독은 성공이 아니다."""
        if self.props_korean:
            return False
        if meaningful_locale(self.persist) or meaningful_locale(self.product):
            return True
        return is_korean_locale(self.system_locales)


def _read_prop(serial: str, name: str) -> str:
    try:
        return meaningful_locale(shell(serial, f'getprop {name}', timeout=8))
    except (RuntimeError, OSError):
        return ''


def _read_system_locales(serial: str) -> str:
    try:
        return meaningful_locale(shell(serial, 'settings get system system_locales', timeout=8))
    except (RuntimeError, OSError):
        return ''


_locale_cache: dict[str, tuple[float, DeviceLocale]] = {}


def read_device_locale(serial: str, *, max_age: float = 8.0) -> DeviceLocale:
    now = time.time()
    cached = _locale_cache.get(serial)
    if cached and max_age > 0 and now - cached[0] < max_age:
        return cached[1]
    parts = DeviceLocale(
        persist=_read_prop(serial, 'persist.sys.locale'),
        product=_read_prop(serial, 'ro.product.locale'),
        system_locales=_read_system_locales(serial),
    )
    _locale_cache[serial] = (now, parts)
    return parts


def clear_locale_cache() -> None:
    _locale_cache.clear()


def locale_already_applied() -> bool:
    return locale_ok_path().is_file()


def change_locale_was_tried() -> bool:
    return locale_change_tried_path().is_file()


def mark_change_locale_tried() -> None:
    path = locale_change_tried_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('1', encoding='utf-8')


def clear_locale_ok_marker() -> None:
    try:
        locale_ok_path().unlink(missing_ok=True)
    except OSError:
        pass


def mark_locale_applied() -> None:
    path = locale_ok_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('ok', encoding='utf-8')
    for extra in (locale_change_tried_path(), locale_ui_boot_path()):
        try:
            extra.unlink(missing_ok=True)
        except OSError:
            pass


def change_locale_args() -> list[str]:
    """마커가 없을 때만 -change-locale ko-KR. 호출 시 시도 표시를 남긴다."""
    if locale_already_applied():
        return []
    mark_change_locale_tried()
    return ['-change-locale', 'ko-KR']
