"""청소비서 미소 연동 — 경로·설정. 숨고 연동과 폴더를 공유하지 않는다."""
from __future__ import annotations

import json
import os
import pathlib

from version_info import APP_VERSION, BRIDGE_API_VERSION

BRIDGE_DIR = pathlib.Path(__file__).resolve().parent.parent
APP_DATA_DIR = pathlib.Path(os.environ.get('LOCALAPPDATA', '')) / 'Cbiseo' / 'MisoBridge'
SDK_DIR = APP_DATA_DIR / 'sdk'
JRE_DIR = APP_DATA_DIR / 'jre'
CONFIG_PATH = APP_DATA_DIR / 'config.json'
SETUP_STATE_PATH = APP_DATA_DIR / 'setup-state.json'
UPDATE_FLAG_PATH = APP_DATA_DIR / 'update.request'
UPDATE_MANIFEST_PATH = APP_DATA_DIR / 'update.manifest.json'
UPDATE_CACHE_DIR = APP_DATA_DIR / 'update-cache'
BRIDGE_STATUS_URL = 'http://127.0.0.1:17891/status'

MANIFEST_URL_CANDIDATES: tuple[str, ...] = (
    'https://www.cbiseo.com/api/public/miso-bridge/manifest',
    'https://cbiseo.com/api/public/miso-bridge/manifest',
    'https://clean-solution-staging.up.railway.app/api/public/miso-bridge/manifest',
    'http://127.0.0.1:3000/api/public/miso-bridge/manifest',
)

CMDLINE_TOOLS_URL = (
    'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
)
SYSTEM_IMAGE = 'system-images;android-34;google_apis_playstore;x86_64'
AVD_NAME = 'CbiseoMiso'


def ensure_app_data() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)


def append_tray_event(message: str) -> None:
    import time

    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}\n"
    try:
        ensure_app_data()
        with (APP_DATA_DIR / 'tray-events.log').open('a', encoding='utf-8') as handle:
            handle.write(line)
    except OSError:
        pass


def load_config() -> dict:
    ensure_app_data()
    if not CONFIG_PATH.is_file():
        return {'manifestMode': 'auto'}
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_config(data: dict) -> None:
    ensure_app_data()
    CONFIG_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def load_setup_state() -> dict:
    if not SETUP_STATE_PATH.is_file():
        return {}
    try:
        data = json.loads(SETUP_STATE_PATH.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_setup_state(data: dict) -> None:
    ensure_app_data()
    SETUP_STATE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def setup_finished() -> bool:
    return bool(load_setup_state().get('boot'))


def iter_manifest_urls() -> list[str]:
    env = os.environ.get('MISO_BRIDGE_MANIFEST_URL', '').strip()
    urls: list[str] = []
    if env:
        urls.append(env)
    cfg = load_config()
    cached = str(cfg.get('resolvedManifestUrl', '')).strip()
    if cached:
        urls.append(cached)
    urls.extend(MANIFEST_URL_CANDIDATES)
    seen: set[str] = set()
    out: list[str] = []
    for url in urls:
        if url and url not in seen:
            seen.add(url)
            out.append(url)
    return out


def save_resolved_manifest_url(url: str) -> None:
    cfg = load_config()
    cfg['resolvedManifestUrl'] = url
    save_config(cfg)


def bridge_python_env() -> dict[str, str]:
    env = os.environ.copy()
    env['PYTHONPATH'] = str(BRIDGE_DIR)
    env['ANDROID_SDK_ROOT'] = str(SDK_DIR)
    env['ANDROID_HOME'] = str(SDK_DIR)
    return env


def app_version_label() -> str:
    return f'{APP_VERSION} (API {BRIDGE_API_VERSION})'
