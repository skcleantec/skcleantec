"""설치 파일 내려받기·실행. 숨고 연동과 캐시 폴더를 공유하지 않는다."""
from __future__ import annotations

import hashlib
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import requests

from desktop.config import UPDATE_CACHE_DIR, ensure_app_data

logger = logging.getLogger(__name__)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def artifact_path(manifest: dict[str, Any]) -> Path:
    version = str(manifest.get('latestVersion') or 'latest')
    ensure_app_data()
    UPDATE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return UPDATE_CACHE_DIR / f'MisoBridge-Setup-{version}.exe'


def download_update_artifact(manifest: dict[str, Any]) -> tuple[bool, str]:
    url = str(manifest.get('downloadUrl') or '').strip()
    if not url:
        return False, '설치 파일 주소가 없습니다.'
    dest = artifact_path(manifest)
    try:
        with requests.get(url, stream=True, timeout=180) as res:
            res.raise_for_status()
            with dest.open('wb') as handle:
                for chunk in res.iter_content(chunk_size=1024 * 64):
                    if chunk:
                        handle.write(chunk)
    except Exception as exc:
        return False, f'설치 파일을 받지 못했습니다. ({exc})'
    expect = str(manifest.get('sha256') or '').strip().lower()
    if expect and _sha256_file(dest).lower() != expect:
        dest.unlink(missing_ok=True)
        return False, '설치 파일 확인에 실패했습니다. 다시 받아 주세요.'
    return True, str(dest)


def run_installer(exe_path: Path) -> bool:
    if not exe_path.is_file():
        return False
    try:
        subprocess.Popen(
            [str(exe_path), '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'],
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except OSError as exc:
        logger.error('installer failed: %s', exc)
        return False
    return True


def perform_update(manifest: dict[str, Any]) -> tuple[bool, str]:
    ok, detail = download_update_artifact(manifest)
    if not ok:
        return False, detail
    if not run_installer(Path(detail)):
        return False, '설치 파일을 실행하지 못했습니다.'
    return True, '새 버전 설치를 시작했습니다. 끝나면 프로그램이 다시 켜집니다.'


def restart_self() -> None:
    from desktop.single_instance import release_single_instance

    helper = Path(__file__).resolve().parent / 'post_update_restart.py'
    if helper.is_file():
        subprocess.Popen(
            [sys.executable, str(helper)],
            cwd=str(Path(__file__).resolve().parents[1]),
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    release_single_instance()
    os._exit(0)
