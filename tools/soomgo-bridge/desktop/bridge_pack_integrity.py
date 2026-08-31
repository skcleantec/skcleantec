"""브릿지 설치 무결성 — Setup 업그레이드 누락 시 ZIP으로 보수·import 검증."""
from __future__ import annotations

import logging
import re
import subprocess
import sys
from pathlib import Path

from desktop.config import BRIDGE_DIR, UPDATE_CACHE_DIR, ensure_app_data
from desktop.update_manager import apply_zip_update, download_file

logger = logging.getLogger(__name__)

REQUIRED_PACK_FILES: tuple[str, ...] = (
    'automation/selectors.py',
    'automation/soomgo_display_name.py',
    'automation/customer_request.py',
    'automation/chat_room.py',
    'automation/chat_list_enumerate.py',
    'automation/chat_room_leave.py',
    'automation/chat_room_opened_at.py',
    'automation/preferred_date_parser.py',
    'automation/stale_chat_cleanup.py',
    'automation/overlay_modals.py',
    'automation/soomgo_text_filters.py',
    'automation/chat_list_watcher.py',
    'desktop/bridge_pack_integrity.py',
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
        if trimmed.lower().endswith('.zip'):
            return trimmed
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


def verify_bridge_pack_imports(bridge_dir: Path | None = None) -> tuple[bool, str | None]:
    """subprocess로 설치 폴더 import 검증 — NameError 등 런타임 누락 탐지."""
    root = bridge_dir or BRIDGE_DIR
    script = root / 'scripts' / 'verify-bridge-pack.py'
    if not script.is_file():
        return len(missing_pack_files(root)) == 0, None
    bundled_py = root / 'python' / 'python.exe'
    python_exe = str(bundled_py) if bundled_py.is_file() else sys.executable
    try:
        result = subprocess.run(
            [python_exe, str(script), '--root', str(root)],
            cwd=str(root),
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=90,
        )
    except OSError as exc:
        return False, str(exc)
    if result.returncode == 0:
        return True, None
    detail = (result.stderr or result.stdout or '').strip()
    return False, detail[-500:] if detail else f'exit {result.returncode}'


def repair_bridge_pack_from_zip_url(
    zip_url: str,
    *,
    bridge_dir: Path | None = None,
    version: str | None = None,
    force: bool = False,
) -> bool:
    """Release ZIP을 설치 폴더에 덮어써 누락·구버전 파일을 복구."""
    root = bridge_dir or BRIDGE_DIR
    if not force:
        missing = missing_pack_files(root)
        ok, _err = verify_bridge_pack_imports(root)
        if not missing and ok:
            return True
    else:
        missing = missing_pack_files(root)

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
        ok, err = verify_bridge_pack_imports(root)
        if not ok:
            logger.error('bridge pack repair: import verify failed: %s', err)
            return False
        if missing:
            logger.info('bridge pack repair: restored missing %s', missing)
        return True
    except Exception as e:
        logger.error('bridge pack repair failed: %s', e)
        return False


def apply_zip_overlay_for_manifest(manifest: dict | None, *, bridge_dir: Path | None = None) -> bool:
    """Setup 직후·코드 업데이트 — 동일 버전 ZIP 전체 덮어쓰기."""
    if not manifest:
        return False
    version = str(manifest.get('latestVersion', '')).strip()
    zip_url = setup_download_url_to_zip_url(str(manifest.get('downloadUrl', '')).strip()) or ''
    if not zip_url and version:
        zip_url = (
            f'https://github.com/skcleantec/skcleantec/releases/download/'
            f'soomgo-bridge-v{version}/SoomgoBridge-{version}.zip'
        )
    if not zip_url:
        return False
    return repair_bridge_pack_from_zip_url(zip_url, bridge_dir=bridge_dir, version=version or None, force=True)


def ensure_bridge_pack_integrity(
    manifest: dict | None = None,
    *,
    bridge_dir: Path | None = None,
) -> bool:
    """누락·import 오류 시 manifest/downloadUrl 기준 ZIP으로 자동 보수."""
    root = bridge_dir or BRIDGE_DIR
    missing = missing_pack_files(root)
    ok, _err = verify_bridge_pack_imports(root)
    if not missing and ok:
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
        logger.warning('bridge pack incomplete (%s, import_ok=%s) — zip url unavailable', missing, ok)
        return False

    return repair_bridge_pack_from_zip_url(zip_url, bridge_dir=root, version=version or None, force=not ok)
