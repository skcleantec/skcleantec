"""다운로드·설치·재시작"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Any

import requests

from desktop.config import BRIDGE_DIR, UPDATE_CACHE_DIR, UPDATE_STATE_PATH, ensure_app_data
from version_info import APP_VERSION

logger = logging.getLogger(__name__)


def write_update_state(
    *,
    phase: str,
    message: str | None = None,
    latest_version: str | None = None,
    artifact: str | None = None,
) -> None:
    ensure_app_data()
    payload: dict[str, Any] = {
        'phase': phase,
        'message': message,
        'latestVersion': latest_version,
        'artifact': artifact,
        'updatedAt': int(time.time() * 1000),
    }
    try:
        UPDATE_STATE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    except OSError as e:
        logger.warning('update state write failed: %s', e)


def read_update_state() -> dict[str, Any]:
    ensure_app_data()
    if not UPDATE_STATE_PATH.exists():
        return {}
    try:
        raw = json.loads(UPDATE_STATE_PATH.read_text(encoding='utf-8'))
        return raw if isinstance(raw, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _artifact_path(manifest: dict[str, Any]) -> Path | None:
    url = str(manifest.get('downloadUrl', '')).strip()
    if not url:
        return None
    filename = url.split('?')[0].rstrip('/').split('/')[-1] or 'update.bin'
    latest = str(manifest.get('latestVersion', '')).strip()
    if latest:
        return UPDATE_CACHE_DIR / f'{latest}-{filename}'
    return UPDATE_CACHE_DIR / filename


def download_update_artifact(manifest: dict[str, Any], *, force: bool = False) -> tuple[bool, str]:
    """백그라운드 다운로드 — 성공 시 phase=ready."""
    url = str(manifest.get('downloadUrl', '')).strip()
    if not url:
        return False, '다운로드 URL이 설정되지 않았습니다.'

    dest = _artifact_path(manifest)
    if not dest:
        return False, '업데이트 경로를 만들 수 없습니다.'

    latest = str(manifest.get('latestVersion', '')).strip()
    state = read_update_state()
    if (
        not force
        and state.get('phase') == 'ready'
        and str(state.get('latestVersion', '')).strip() == latest
        and dest.is_file()
    ):
        return True, '이미 다운로드되어 있습니다.'

    ensure_app_data()
    UPDATE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    write_update_state(phase='downloading', message='업데이트 다운로드 중…', latest_version=latest or None)

    try:
        download_file(url, dest)
    except Exception as e:
        write_update_state(phase='idle', message=f'다운로드 실패: {e}', latest_version=latest or None)
        return False, f'다운로드 실패: {e}'

    expected = str(manifest.get('sha256', '')).strip().lower()
    if expected:
        actual = _sha256_file(dest).lower()
        if actual != expected:
            try:
                dest.unlink(missing_ok=True)
            except OSError:
                pass
            write_update_state(phase='idle', message='파일 검증(sha256) 실패', latest_version=latest or None)
            return False, '파일 검증(sha256)에 실패했습니다.'

    write_update_state(
        phase='ready',
        message=f'v{latest} 설치 준비 완료',
        latest_version=latest or None,
        artifact=str(dest),
    )
    return True, f'v{latest} 다운로드 완료'


def install_cached_artifact(manifest: dict[str, Any]) -> tuple[bool, str]:
    state = read_update_state()
    artifact_raw = str(state.get('artifact', '')).strip()
    dest = Path(artifact_raw) if artifact_raw else _artifact_path(manifest)
    if not dest or not dest.is_file():
        return perform_update(manifest)

    latest = str(manifest.get('latestVersion', '')).strip()
    write_update_state(phase='installing', message='업데이트 설치 중…', latest_version=latest or None, artifact=str(dest))

    lower = dest.name.lower()
    if lower.endswith('.exe'):
        if run_installer(dest):
            return True, '업데이트 설치 중입니다. 잠시 후 프로그램이 자동으로 다시 시작됩니다.'
        write_update_state(phase='ready', message='설치 프로그램 실행 실패', latest_version=latest or None, artifact=str(dest))
        return False, '설치 프로그램 실행에 실패했습니다.'

    if lower.endswith('.zip'):
        if apply_zip_update(dest):
            write_update_state(phase='idle', message='ZIP 업데이트 적용 완료', latest_version=latest or None)
            return True, f'ZIP 업데이트를 적용했습니다. (현재 {APP_VERSION} → 재시작 필요)'
        write_update_state(phase='ready', message='ZIP 업데이트 적용 실패', latest_version=latest or None, artifact=str(dest))
        return False, 'ZIP 업데이트 적용에 실패했습니다.'

    write_update_state(phase='idle', message='지원하지 않는 배포 형식', latest_version=latest or None)
    return False, '지원하지 않는 배포 형식입니다 (.exe 또는 .zip).'


def is_bridge_idle_for_auto_install(status: dict[str, Any] | None) -> bool:
    """숨고 자동화가 없을 때만 무인 설치."""
    if not status:
        return True
    if status.get('callWatchActive'):
        return False
    if status.get('callModalOpen'):
        return False
    page = str(status.get('pageMode', '')).strip()
    if page == 'chat_room':
        return False
    return True


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
    state = read_update_state()
    if state.get('phase') == 'ready' and state.get('artifact'):
        return install_cached_artifact(manifest)

    ok, msg = download_update_artifact(manifest, force=True)
    if not ok:
        return False, msg
    return install_cached_artifact(manifest)


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
        from desktop.config import bridge_python_env

        subprocess.Popen(
            [sys.executable, '-m', 'desktop.tray_app'],
            cwd=str(BRIDGE_DIR),
            env=bridge_python_env(),
            creationflags=flags,
            close_fds=True,
        )
    os._exit(0)
