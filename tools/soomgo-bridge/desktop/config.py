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

DEFAULT_MANIFEST_URL = 'https://www.cbiseo.com/api/public/soomgo-bridge/manifest'


def ensure_app_data() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    ensure_app_data()
    if not CONFIG_PATH.exists():
        return {'manifestUrl': DEFAULT_MANIFEST_URL}
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
        if isinstance(raw, dict):
            return raw
    except (OSError, json.JSONDecodeError):
        pass
    return {'manifestUrl': DEFAULT_MANIFEST_URL}


def save_config(data: dict) -> None:
    ensure_app_data()
    CONFIG_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def manifest_url() -> str:
    env = os.environ.get('SOOMGO_BRIDGE_MANIFEST_URL', '').strip()
    if env:
        return env
    cfg = load_config()
    url = str(cfg.get('manifestUrl', '')).strip()
    return url or DEFAULT_MANIFEST_URL
