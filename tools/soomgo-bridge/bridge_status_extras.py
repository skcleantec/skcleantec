"""브릿지 /status — manifest·업데이트 상태 보강"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

_manifest_cache: dict[str, Any] | None = None
_manifest_fetched_at = 0.0
_MANIFEST_TTL_SEC = 300.0


def _app_version() -> str:
    return os.environ.get('SOOMGO_APP_VERSION', '').strip() or _fallback_app_version()


def _fallback_app_version() -> str:
    try:
        from version_info import APP_VERSION

        return APP_VERSION
    except Exception:
        return ''


def _bridge_api_version() -> int:
    try:
        from version_info import BRIDGE_API_VERSION

        return BRIDGE_API_VERSION
    except Exception:
        return 2


def get_manifest_cached(*, force: bool = False) -> dict[str, Any] | None:
    global _manifest_cache, _manifest_fetched_at
    now = time.time()
    if not force and _manifest_cache and now - _manifest_fetched_at < _MANIFEST_TTL_SEC:
        return _manifest_cache
    try:
        from desktop.manifest_client import fetch_manifest

        data = fetch_manifest()
        if data:
            _manifest_cache = data
            _manifest_fetched_at = now
            return data
    except Exception as e:
        logger.debug('manifest cache fetch failed: %s', e)
    return _manifest_cache


def read_update_state() -> dict[str, Any]:
    try:
        from desktop.config import UPDATE_STATE_PATH

        if not UPDATE_STATE_PATH.exists():
            return {}
        raw = json.loads(UPDATE_STATE_PATH.read_text(encoding='utf-8'))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def build_update_status_fields() -> dict[str, Any]:
    manifest = get_manifest_cached()
    app_version = _app_version()
    latest = str(manifest.get('latestVersion', '')).strip() if manifest else ''
    update_state = read_update_state()
    phase = str(update_state.get('phase', 'idle')).strip() or 'idle'
    message = str(update_state.get('message', '')).strip() or None

    update_available = False
    update_required = False
    if manifest and app_version and latest:
        try:
            from desktop.manifest_client import is_update_available, is_update_required

            update_available = is_update_available(manifest, app_version)
            update_required = is_update_required(manifest)
        except Exception:
            pass

    return {
        'latestVersion': latest or None,
        'updateAvailable': update_available,
        'updateRequired': update_required,
        'updatePhase': phase if phase in ('idle', 'downloading', 'ready', 'installing') else 'idle',
        'updateMessage': message,
    }
