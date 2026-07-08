"""숨고 브릿지 데스크톱 앱 — 경로·설정"""
from __future__ import annotations

import json
import os
import pathlib

from version_info import APP_VERSION, BRIDGE_API_VERSION

BRIDGE_DIR = pathlib.Path(__file__).resolve().parent.parent
APP_DATA_DIR = pathlib.Path(os.environ.get('LOCALAPPDATA', '')) / 'SKCleantec' / 'SoomgoBridge'
CONFIG_PATH = APP_DATA_DIR / 'config.json'
UPDATE_FLAG_PATH = APP_DATA_DIR / 'update.request'
BRIDGE_STATUS_URL = 'http://127.0.0.1:17890/status'
BRIDGE_REQUEST_UPDATE_URL = 'http://127.0.0.1:17890/request-update'

# 운영·스테이징·로컬 — 상담사는 URL 입력 없이 자동 시도
MANIFEST_URL_CANDIDATES: tuple[str, ...] = (
    'https://www.cbiseo.com/api/public/soomgo-bridge/manifest',
    'https://cbiseo.com/api/public/soomgo-bridge/manifest',
    'https://clean-solution-staging.up.railway.app/api/public/soomgo-bridge/manifest',
    'http://127.0.0.1:3000/api/public/soomgo-bridge/manifest',
)


def ensure_app_data() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)


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
    # 구버전: manifestUrl 없음 → 자동
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
    """레거시 단일 URL (첫 후보). 실제 조회는 manifest_client.fetch_manifest 사용."""
    urls = iter_manifest_urls()
    return urls[0] if urls else MANIFEST_URL_CANDIDATES[0]
