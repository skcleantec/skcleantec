"""브릿지 설치 무결성 — Setup 업그레이드가 신규 파일을 누락할 때 ZIP으로 보수."""
from __future__ import annotations

import logging
import re
from pathlib import Path

from desktop.config import BRIDGE_DIR, UPDATE_CACHE_DIR, ensure_app_data
from desktop.update_manager import apply_zip_update, download_file

logger = logging.getLogger(__name__)

REQUIRED_PACK_FILES: tuple[str, ...] = (
    'automation/selectors.py',
    'automation/soomgo_display_name.py',
    'automation/customer_request.py',
    'server.py',
)


def missing_pack_files(bridge_dir: Path | None = None) -> list[str]:
    root = bridge_dir or BRIDGE_DIR
    return [rel for rel in REQUIRED_PACK_FILES if not (root / rel).is_file()]


def setup_download_url_to_zip_url(url: str) -> str | None:
    trimmed = url.strip()
    if not trimmed:
        return None
    match = re.search(r'SoomgoBridge-Setup-(\d+\.\d+\.\d+)\.exe', trimmed, re.I)
    if not match:
        return None
    version = match.group(1)
    return re.sub(
        r'SoomgoBridge-Setup-\d+\.\d+\.\d+\.exe',
        f'SoomgoBridge-{version}.zip',
        trimmed,
        flags=re.I,
    )


def _zip_cache_path(zip_url: str, version: str | None = None) -> Path:
    filename = zip_url.split('?')[0].rstrip('/').split('/')[-1] or 'SoomgoBridge.zip'
    if version:
        return UPDATE_CACHE_DIR / f'{version}-{filename}'
    return UPDATE_CACHE_DIR / filename


def repair_bridge_pack_from_zip_url(
    zip_url: str,
    *,
    bridge_dir: Path | None = None,
    version: str | None = None,
) -> bool:
    """Release ZIP 전체를 설치 폴더에 덮어써 누락 파일을 복구."""
    root = bridge_dir or BRIDGE_DIR
    missing = missing_pack_files(root)
    if not missing:
        return True

    ensure_app_data()
    UPDATE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    dest = _zip_cache_path(zip_url, version)

    try:
        if not dest.is_file():
            logger.info('bridge pack repair: downloading %s', zip_url)
            download_file(zip_url, dest)
        if not apply_zip_update(dest):
            logger.error('bridge pack repair: zip apply failed')
            return False
        still_missing = missing_pack_files(root)
        if still_missing:
            logger.error('bridge pack repair: still missing %s', still_missing)
            return False
        logger.info('bridge pack repair: restored %s', missing)
        return True
    except Exception as e:
        logger.error('bridge pack repair failed: %s', e)
        return False


def ensure_bridge_pack_integrity(
    manifest: dict | None = None,
    *,
    bridge_dir: Path | None = None,
) -> bool:
    """누락 파일이 있으면 manifest/downloadUrl 기준 ZIP으로 자동 보수."""
    root = bridge_dir or BRIDGE_DIR
    missing = missing_pack_files(root)
    if not missing:
        return True

    zip_url = ''
    version = ''
    if manifest:
        version = str(manifest.get('latestVersion', '')).strip()
        zip_url = setup_download_url_to_zip_url(str(manifest.get('downloadUrl', '')).strip()) or ''

    if not zip_url and version:
        zip_url = (
            f'https://github.com/skcleantec/skcleantec/releases/download/'
            f'soomgo-bridge-v{version}/SoomgoBridge-{version}.zip'
        )

    if not zip_url:
        logger.warning('bridge pack incomplete (%s) — zip url unavailable', missing)
        return False

    return repair_bridge_pack_from_zip_url(zip_url, bridge_dir=root, version=version or None)
