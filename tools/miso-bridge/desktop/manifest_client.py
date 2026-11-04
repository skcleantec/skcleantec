"""원격 매니페스트 조회."""
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
            res = requests.get(url, timeout=12, headers={'Cache-Control': 'no-cache'})
            res.raise_for_status()
            data = res.json()
            if isinstance(data, dict) and data.get('latestVersion'):
                save_resolved_manifest_url(url)
                return data
        except Exception as exc:
            logger.warning('manifest fetch failed (%s): %s', url, exc)
    return None


def parse_version_tuple(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for piece in version.strip().split('.'):
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


def is_update_required(manifest: dict[str, Any] | None) -> bool:
    if not manifest:
        return False
    try:
        required = int(manifest.get('requiredVersion'))
    except (TypeError, ValueError):
        required = BRIDGE_API_VERSION
    return BRIDGE_API_VERSION < required
