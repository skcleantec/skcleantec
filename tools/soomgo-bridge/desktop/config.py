"""숨고 브릿지 데스크톱 앱 — 경로·설정"""
from __future__ import annotations

import json
import os
import pathlib
import shutil

from version_info import APP_VERSION, BRIDGE_API_VERSION

BRIDGE_DIR = pathlib.Path(__file__).resolve().parent.parent

# 상담사 PC 경로 — Cbiseo (구 SKCleantec 폴더는 마이그레이션만)
_APP_BRAND_DIR = 'Cbiseo'
_APP_MODULE_DIR = 'SoomgoBridge'
_LEGACY_BRAND_DIR = 'SKCleantec'


def _local_appdata() -> pathlib.Path:
    return pathlib.Path(os.environ.get('LOCALAPPDATA', ''))


APP_DATA_DIR = _local_appdata() / _APP_BRAND_DIR / _APP_MODULE_DIR
LEGACY_APP_DATA_DIR = _local_appdata() / _LEGACY_BRAND_DIR / _APP_MODULE_DIR
CONFIG_PATH = APP_DATA_DIR / 'config.json'
UPDATE_FLAG_PATH = APP_DATA_DIR / 'update.request'
UPDATE_MANIFEST_PATH = APP_DATA_DIR / 'update.manifest.json'
RESTART_FLAG_PATH = APP_DATA_DIR / 'restart.request'
UPDATE_STATE_PATH = APP_DATA_DIR / 'update.state.json'
UPDATE_CACHE_DIR = APP_DATA_DIR / 'update-cache'
BRIDGE_STATUS_URL = 'http://127.0.0.1:17890/status'
BRIDGE_REQUEST_UPDATE_URL = 'http://127.0.0.1:17890/request-update'
BRIDGE_RESTART_URL = 'http://127.0.0.1:17890/restart-bridge'

# Inno Setup DefaultDirName 과 동일
INSTALL_DIR_NAME = rf'{{autopf}}\{_APP_BRAND_DIR}\{_APP_MODULE_DIR}'

# 운영·스테이징·로컬 — 상담사는 URL 입력 없이 자동 시도
MANIFEST_URL_CANDIDATES: tuple[str, ...] = (
    'https://www.cbiseo.com/api/public/soomgo-bridge/manifest',
    'https://cbiseo.com/api/public/soomgo-bridge/manifest',
    'https://clean-solution-staging.up.railway.app/api/public/soomgo-bridge/manifest',
    'http://127.0.0.1:3000/api/public/soomgo-bridge/manifest',
)


def _migrate_legacy_app_data() -> None:
    """구 SKCleantec\\SoomgoBridge 설정을 Cbiseo로 한 번 이전."""
    if CONFIG_PATH.exists() or not LEGACY_APP_DATA_DIR.is_dir():
        return
    ensure_app_data()
    legacy_config = LEGACY_APP_DATA_DIR / 'config.json'
    if legacy_config.is_file():
        try:
            shutil.copy2(legacy_config, CONFIG_PATH)
        except OSError:
            pass
    legacy_flag = LEGACY_APP_DATA_DIR / 'update.request'
    if legacy_flag.is_file() and not UPDATE_FLAG_PATH.exists():
        try:
            shutil.copy2(legacy_flag, UPDATE_FLAG_PATH)
        except OSError:
            pass


def ensure_app_data() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    _migrate_legacy_app_data()


def resolve_restart_flag_path() -> pathlib.Path:
    ensure_app_data()
    return RESTART_FLAG_PATH


def resolve_update_flag_path() -> pathlib.Path:
    ensure_app_data()
    if UPDATE_FLAG_PATH.exists():
        return UPDATE_FLAG_PATH
    legacy = LEGACY_APP_DATA_DIR / 'update.request'
    if legacy.is_file():
        return legacy
    return UPDATE_FLAG_PATH


def write_pending_update_manifest(data: dict) -> None:
    ensure_app_data()
    UPDATE_MANIFEST_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def clear_pending_update_manifest() -> None:
    ensure_app_data()
    try:
        UPDATE_MANIFEST_PATH.unlink(missing_ok=True)
    except OSError:
        pass


def peek_pending_update_manifest() -> dict | None:
    ensure_app_data()
    if not UPDATE_MANIFEST_PATH.is_file():
        return None
    try:
        raw = json.loads(UPDATE_MANIFEST_PATH.read_text(encoding='utf-8'))
        if not isinstance(raw, dict):
            return None
        latest = str(raw.get('latestVersion', '')).strip()
        url = str(raw.get('downloadUrl', '')).strip()
        if latest and url:
            return raw
    except (OSError, json.JSONDecodeError):
        pass
    return None


def take_pending_update_manifest() -> dict | None:
    manifest = peek_pending_update_manifest()
    clear_pending_update_manifest()
    return manifest


def load_config() -> dict:
    ensure_app_data()
    if not CONFIG_PATH.exists():
        return {'manifestMode': 'auto'}
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
        if isinstance(raw, dict):
            return raw
    except (OSError, json.JSONDecodeError):
        pass
    return {'manifestMode': 'auto'}


def save_config(data: dict) -> None:
    ensure_app_data()
    CONFIG_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def _is_auto_manifest(cfg: dict) -> bool:
    mode = str(cfg.get('manifestMode', '')).strip().lower()
    if mode == 'auto':
        return True
    explicit = str(cfg.get('manifestUrl', '')).strip()
    return not explicit


def save_resolved_manifest_url(url: str) -> None:
    cfg = load_config()
    cfg['resolvedManifestUrl'] = url.strip()
    cfg.setdefault('manifestMode', 'auto')
    save_config(cfg)


def iter_manifest_urls() -> list[str]:
    """조회 순서: 환경변수 → 수동 URL → 캐시 → 운영/스테이징/로컬 후보."""
    env = os.environ.get('SOOMGO_BRIDGE_MANIFEST_URL', '').strip()
    if env:
        return [env]

    cfg = load_config()
    ordered: list[str] = []

    if not _is_auto_manifest(cfg):
        explicit = str(cfg.get('manifestUrl', '')).strip()
        if explicit:
            return [explicit]

    cached = str(cfg.get('resolvedManifestUrl', '')).strip()
    if cached:
        ordered.append(cached)

    for url in MANIFEST_URL_CANDIDATES:
        if url not in ordered:
            ordered.append(url)

    return ordered


def manifest_url() -> str:
    urls = iter_manifest_urls()
    return urls[0] if urls else MANIFEST_URL_CANDIDATES[0]


def bridge_python_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    """embed Python 서브프로세스용 — 앱 루트(desktop·automation)를 PYTHONPATH에 포함."""
    env = os.environ.copy()
    root = str(BRIDGE_DIR)
    existing = env.get('PYTHONPATH', '').strip()
    env['PYTHONPATH'] = root if not existing else f'{root}{os.pathsep}{existing}'
    env.setdefault('PYTHONUNBUFFERED', '1')
    if extra:
        env.update(extra)
    return env
