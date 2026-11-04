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

from desktop.config import UPDATE_CACHE_DIR, append_launch_log, append_tray_event, ensure_app_data
from desktop.post_update_restart import installer_log_path, spawn_waiter

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
        append_tray_event('업데이트 설치 실패: 설치 파일 주소가 없습니다.')
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
        append_tray_event(f'업데이트 설치 실패: 설치 파일을 받지 못했습니다. ({exc})')
        return False, f'설치 파일을 받지 못했습니다. ({exc})'
    expect = str(manifest.get('sha256') or '').strip().lower()
    actual = _sha256_file(dest).lower()
    if expect and actual != expect:
        dest.unlink(missing_ok=True)
        append_tray_event('업데이트 설치 실패: 설치 파일 확인에 실패했습니다.')
        return False, '설치 파일 확인에 실패했습니다. 다시 받아 주세요.'
    return True, str(dest)


def run_installer(exe_path: Path) -> subprocess.Popen[Any] | None:
    if not exe_path.is_file():
        append_tray_event(f'업데이트 설치 실패: 설치 파일이 없습니다. ({exe_path})')
        return None
    log_path = installer_log_path()
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        proc = subprocess.Popen(
            [
                str(exe_path),
                '/VERYSILENT',
                '/SUPPRESSMSGBOXES',
                '/NORESTART',
                f'/LOG={log_path}',
            ],
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except OSError as exc:
        logger.error('installer failed: %s', exc)
        append_tray_event(f'업데이트 설치 실패: 설치 파일을 실행하지 못했습니다. ({exc})')
        append_launch_log(f'실행 판단: 설치 파일 실행 실패 ({exc})')
        return None
    append_tray_event(f'설치 프로그램을 실행했습니다. pid={proc.pid} log={log_path}')
    append_launch_log(f'실행 판단: 설치 프로그램 실행 pid={proc.pid}')
    return proc


def perform_update(manifest: dict[str, Any]) -> tuple[bool, str, int]:
    ok, detail = download_update_artifact(manifest)
    if not ok:
        return False, detail, 0
    proc = run_installer(Path(detail))
    if proc is None:
        return False, '설치 파일을 실행하지 못했습니다.', 0
    return True, '새 버전 설치를 시작했습니다. 끝나면 프로그램이 다시 켜집니다.', int(proc.pid)


def restart_self(installer_pid: int = 0) -> None:
    """설치를 이미 시작한 뒤 이 프로세스를 끝내고, 설치가 끝나면 다시 켜지게 한다."""
    from desktop.single_instance import release_single_instance

    if not spawn_waiter(installer_pid):
        append_tray_event('업데이트 설치 실패: 설치 완료 후 다시 실행을 예약하지 못했습니다.')
    release_single_instance()
    os._exit(0)
