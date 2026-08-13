"""숨고 크롤링 자동화 — 경로·설정"""
from __future__ import annotations

import os
import pathlib

_APP_BRAND_DIR = 'Cbiseo'
_APP_MODULE_DIR = 'SoomgoAutomation'

SOURCE_DIR = pathlib.Path(__file__).resolve().parent.parent


def _local_appdata() -> pathlib.Path:
    return pathlib.Path(os.environ.get('LOCALAPPDATA', ''))


APP_DATA_DIR = _local_appdata() / _APP_BRAND_DIR / _APP_MODULE_DIR
UPDATE_STATE_PATH = APP_DATA_DIR / 'update.state.json'
UPDATE_CACHE_DIR = APP_DATA_DIR / 'update-cache'

MANIFEST_URL_CANDIDATES: tuple[str, ...] = (
    'https://www.cbiseo.com/api/public/soomgo-automation/manifest',
    'https://cbiseo.com/api/public/soomgo-automation/manifest',
    'https://clean-solution-staging.up.railway.app/api/public/soomgo-automation/manifest',
    'http://127.0.0.1:3000/api/public/soomgo-automation/manifest',
)


def ensure_app_data() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPDATE_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def resolve_app_dir() -> pathlib.Path:
    """실행 중인 EXE(또는 개발 시 상위 배포 폴더) 기준."""
    import sys

    if getattr(sys, 'frozen', False):
        return pathlib.Path(sys.executable).resolve().parent
    parent = SOURCE_DIR.parent
    if (parent / 'SoomgoAutomation.exe').is_file():
        return parent
    return SOURCE_DIR


def resolve_update_helper_script() -> pathlib.Path | None:
    app_dir = resolve_app_dir()
    for candidate in (
        app_dir / 'apply_zip_update.ps1',
        SOURCE_DIR / 'scripts' / 'apply_zip_update.ps1',
    ):
        if candidate.is_file():
            return candidate
    return None
