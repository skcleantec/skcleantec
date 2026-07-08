"""원격 매니페스트 조회"""
from __future__ import annotations

import logging
from typing import Any

import requests

from desktop.config import iter_manifest_urls, save_resolved_manifest_url
from version_info import APP_VERSION, BRIDGE_API_VERSION

logger = logging.getLogger(__name__)


def fetch_manifest() -> dict[str, Any] | None:
    for url in iter_manifest_urls():
        try:
            res = requests.get(url, timeout=12)
            res.raise_for_status()
            data = res.json()
            if isinstance(data, dict) and data.get('latestVersion'):
                save_resolved_manifest_url(url)
                logger.info('manifest ok: %s', url)
                return data
        except Exception as e:
            logger.warning('manifest fetch failed (%s): %s', url, e)
    return None


def parse_version_tuple(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for piece in version.strip().split('.'):
        try:
            parts.append(int(piece))
        except ValueError:
            break
    return tuple(parts) if parts else (0,)


def is_update_required(manifest: dict[str, Any] | None, bridge_api_version: int = BRIDGE_API_VERSION) -> bool:
    if not manifest:
        return False
    required = manifest.get('requiredVersion')
    try:
        required_n = int(required)
    except (TypeError, ValueError):
        required_n = bridge_api_version
    return bridge_api_version < required_n


def is_update_available(manifest: dict[str, Any] | None, app_version: str = APP_VERSION) -> bool:
    if not manifest:
        return False
    latest = str(manifest.get('latestVersion', '')).strip()
    if not latest:
        return False
    return parse_version_tuple(latest) > parse_version_tuple(app_version)


def manifest_summary(manifest: dict[str, Any] | None) -> str:
    if not manifest:
        return '업데이트 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'
    latest = manifest.get('latestVersion', '?')
    required = manifest.get('requiredVersion', '?')
    notes = str(manifest.get('releaseNotes', '')).strip()
    lines = [f'최신 버전: {latest}', f'필수 API 버전: {required}', f'현재 앱: {APP_VERSION} (API {BRIDGE_API_VERSION})']
    if notes:
        lines.append(notes)
    return '\n'.join(lines)
