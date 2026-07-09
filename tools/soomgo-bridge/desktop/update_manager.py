"""다운로드·설치·재시작"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any

import requests

from desktop.config import BRIDGE_DIR
from version_info import APP_VERSION

logger = logging.getLogger(__name__)


def _sha256_file(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def download_file(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=120) as res:
        res.raise_for_status()
        with dest.open('wb') as f:
            for chunk in res.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)


def apply_zip_update(zip_path: Path) -> bool:
    """개발·스테이징용 ZIP 덮어쓰기 (브릿지 폴더 기준)."""
    extract_dir = Path(tempfile.mkdtemp(prefix='soomgo-bridge-update-'))
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_dir)
        root = extract_dir
        children = [p for p in extract_dir.iterdir() if p.is_dir()]
        if len(children) == 1 and not (extract_dir / 'server.py').exists():
            root = children[0]
        for item in root.rglob('*'):
            if item.is_dir():
                continue
            rel = item.relative_to(root)
            target = BRIDGE_DIR / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)
        return True
    except Exception as e:
        logger.error('zip update failed: %s', e)
        return False
    finally:
        shutil.rmtree(extract_dir, ignore_errors=True)


def run_installer(exe_path: Path) -> bool:
    if not exe_path.exists():
        return False
    try:
        subprocess.Popen(
            [str(exe_path), '/SILENT', '/CLOSEAPPLICATIONS', '/RESTARTAPPLICATIONS'],
            close_fds=True,
        )
        return True
    except OSError as e:
        logger.error('installer run failed: %s', e)
        return False


def perform_update(manifest: dict[str, Any]) -> tuple[bool, str]:
    url = str(manifest.get('downloadUrl', '')).strip()
    if not url:
        return False, '다운로드 URL이 설정되지 않았습니다. 관리자에게 문의하세요.'

    tmp = Path(tempfile.gettempdir()) / 'soomgo-bridge-update'
    tmp.mkdir(parents=True, exist_ok=True)
    filename = url.split('?')[0].rstrip('/').split('/')[-1] or 'update.bin'
    dest = tmp / filename

    try:
        download_file(url, dest)
    except Exception as e:
        return False, f'다운로드 실패: {e}'

    expected = str(manifest.get('sha256', '')).strip().lower()
    if expected:
        actual = _sha256_file(dest).lower()
        if actual != expected:
            return False, '파일 검증(sha256)에 실패했습니다.'

    lower = filename.lower()
    if lower.endswith('.exe'):
        if run_installer(dest):
            return True, '업데이트 설치 중입니다. 잠시 후 프로그램이 자동으로 다시 시작됩니다.'
        return False, '설치 프로그램 실행에 실패했습니다.'

    if lower.endswith('.zip'):
        if apply_zip_update(dest):
            return True, f'ZIP 업데이트를 적용했습니다. (현재 {APP_VERSION} → 재시작 필요)'
        return False, 'ZIP 업데이트 적용에 실패했습니다.'

    return False, '지원하지 않는 배포 형식입니다 (.exe 또는 .zip).'


def schedule_post_setup_restart(wait_sec: float = 14.0) -> bool:
    """Setup.exe 무인 설치 후 트레이 앱을 다시 띄웁니다."""
    helper = BRIDGE_DIR / 'desktop' / 'post_update_restart.py'
    if not helper.is_file():
        return False
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    try:
        subprocess.Popen(
            [sys.executable, str(helper)],
            cwd=str(BRIDGE_DIR),
            creationflags=flags,
            close_fds=True,
        )
        return True
    except OSError as e:
        logger.error('post-update restart schedule failed: %s', e)
        return False


def restart_self() -> None:
    """트레이 앱 재시작 (콘솔 없음)."""
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    vbs = BRIDGE_DIR / 'launch-desktop.vbs'
    if sys.platform == 'win32' and vbs.exists():
        subprocess.Popen(
            ['wscript.exe', str(vbs)],
            cwd=str(BRIDGE_DIR),
            creationflags=flags,
            close_fds=True,
        )
    else:
        subprocess.Popen(
            [sys.executable, '-m', 'desktop.tray_app'],
            cwd=str(BRIDGE_DIR),
            creationflags=flags,
            close_fds=True,
        )
    os._exit(0)
