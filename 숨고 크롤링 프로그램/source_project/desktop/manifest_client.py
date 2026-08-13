"""원격 업데이트 매니페스트 조회"""
from __future__ import annotations

import logging
from typing import Any

import requests

from desktop.config import MANIFEST_URL_CANDIDATES
from version_info import APP_VERSION

logger = logging.getLogger(__name__)


def fetch_manifest() -> dict[str, Any] | None:
    for url in MANIFEST_URL_CANDIDATES:
        try:
            res = requests.get(url, timeout=12, headers={'Cache-Control': 'no-cache'})
            res.raise_for_status()
            data = res.json()
            if isinstance(data, dict) and data.get('latestVersion'):
                logger.info('manifest ok: %s (v%s)', url, data.get('latestVersion'))
                return data
        except Exception as e:
            logger.warning('manifest fetch failed (%s): %s', url, e)
    return None


def parse_version_tuple(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for piece in version.strip().replace('v', '').split('.'):
        try:
            parts.append(int(piece))
        except ValueError:
            break
    return tuple(parts) if parts else (0,)


def is_update_available(manifest: dict[str, Any] | None, app_version: str = APP_VERSION) -> bool:
    if not manifest:
        return False
    latest = str(manifest.get('latestVersion', '')).strip()
    if not latest:
        return False
    return parse_version_tuple(latest) > parse_version_tuple(app_version)


def is_update_required(manifest: dict[str, Any] | None, app_version: str = APP_VERSION) -> bool:
    if not manifest:
        return False
    minimum = str(manifest.get('minAppVersion', '')).strip()
    if not minimum:
        return False
    return parse_version_tuple(app_version) < parse_version_tuple(minimum)


def manifest_summary(manifest: dict[str, Any] | None) -> str:
    if not manifest:
        return '업데이트 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'
    latest = manifest.get('latestVersion', '?')
    notes = str(manifest.get('releaseNotes', '')).strip()
    lines = [f'최신 버전: {latest}', f'현재 버전: {APP_VERSION}']
    if notes:
        lines.append(notes)
    return '\n'.join(lines)
