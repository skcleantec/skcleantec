"""다운로드·ZIP 적용·재시작"""
from __future__ import annotations

import hashlib
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Any, Callable

import requests

from desktop.config import UPDATE_CACHE_DIR, UPDATE_STATE_PATH, ensure_app_data, resolve_app_dir, resolve_update_helper_script
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
    payload = {
        'phase': phase,
        'message': message,
        'latestVersion': latest_version,
        'artifact': artifact,
        'updatedAt': int(time.time() * 1000),
    }
    try:
        UPDATE_STATE_PATH.write_text(
            __import__('json').dumps(payload, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
    except OSError as e:
        logger.warning('update state write failed: %s', e)


def read_update_state() -> dict[str, Any]:
    ensure_app_data()
    if not UPDATE_STATE_PATH.exists():
        return {}
    try:
        raw = __import__('json').loads(UPDATE_STATE_PATH.read_text(encoding='utf-8'))
        return raw if isinstance(raw, dict) else {}
    except (OSError, ValueError):
        return {}


def _artifact_path(manifest: dict[str, Any]) -> Path | None:
    url = str(manifest.get('downloadUrl', '')).strip()
    if not url:
        return None
    filename = url.split('?')[0].rstrip('/').split('/')[-1] or 'update.zip'
    latest = str(manifest.get('latestVersion', '')).strip()
    if latest:
        return UPDATE_CACHE_DIR / f'{latest}-{filename}'
    return UPDATE_CACHE_DIR / filename


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def download_file(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=180) as res:
        res.raise_for_status()
        with dest.open('wb') as f:
            for chunk in res.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)


def cached_artifact_is_valid(manifest: dict[str, Any], state: dict[str, Any] | None = None) -> bool:
    state = state if state is not None else read_update_state()
    if state.get('phase') != 'ready':
        return False
    latest = str(manifest.get('latestVersion', '')).strip()
    cached_ver = str(state.get('latestVersion', '')).strip()
    if latest and cached_ver and cached_ver != latest:
        return False
    artifact = str(state.get('artifact', '')).strip()
    dest = Path(artifact) if artifact else _artifact_path(manifest)
    if not dest or not dest.is_file():
        return False
    expected = str(manifest.get('sha256', '')).strip().lower()
    if expected and _sha256_file(dest).lower() != expected:
        return False
    return True


def download_update_artifact(manifest: dict[str, Any], *, force: bool = False) -> tuple[bool, str]:
    url = str(manifest.get('downloadUrl', '')).strip()
    if not url:
        return False, '다운로드 URL이 설정되지 않았습니다.'

    dest = _artifact_path(manifest)
    if not dest:
        return False, '업데이트 경로를 만들 수 없습니다.'

    latest = str(manifest.get('latestVersion', '')).strip()
    state = read_update_state()
    if not force and cached_artifact_is_valid(manifest, state):
        return True, '이미 다운로드되어 있습니다.'

    ensure_app_data()
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


def apply_zip_update_dev(zip_path: Path) -> bool:
    """개발·소스 실행 시 ZIP을 앱 폴더에 반영."""
    app_dir = resolve_app_dir()
    extract_dir = Path(tempfile.mkdtemp(prefix='soomgo-automation-update-'))
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_dir)
        root = extract_dir
        children = [p for p in extract_dir.iterdir() if p.is_dir()]
        if len(children) == 1 and not (extract_dir / 'SoomgoAutomation.exe').exists():
            root = children[0]
        for item in root.rglob('*'):
            if item.is_dir():
                continue
            rel = item.relative_to(root)
            target = app_dir / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)
        return True
    except Exception as e:
        logger.error('zip update failed: %s', e)
        return False
    finally:
        shutil.rmtree(extract_dir, ignore_errors=True)


def perform_automation_update(
    manifest: dict[str, Any],
    *,
    on_before_exit: Callable[[], None],
) -> tuple[bool, str]:
    """다운로드 → ZIP 적용 → 재시작 (업데이트 버튼)."""
    from desktop.manifest_client import is_update_available, is_update_required

    if not is_update_available(manifest, APP_VERSION) and not is_update_required(manifest):
        return False, '이미 최신 버전입니다.'

    ok, msg = download_update_artifact(manifest, force=True)
    if not ok:
        return False, msg

    state = read_update_state()
    if not cached_artifact_is_valid(manifest, state):
        return False, '설치 파일 검증에 실패했습니다.'

    artifact = str(state.get('artifact', '')).strip()
    zip_path = Path(artifact) if artifact else _artifact_path(manifest)
    if not zip_path or not zip_path.is_file():
        return False, '설치 파일을 찾을 수 없습니다.'

    latest = str(manifest.get('latestVersion', '')).strip()
    write_update_state(
        phase='installing',
        message='업데이트 적용 중…',
        latest_version=latest or None,
        artifact=str(zip_path),
    )

    on_before_exit()

    if getattr(sys, 'frozen', False):
        helper = resolve_update_helper_script()
        if not helper:
            write_update_state(phase='ready', message='업데이트 스크립트 없음', latest_version=latest or None)
            return False, 'apply_zip_update.ps1 를 찾을 수 없습니다. 프로그램을 다시 설치해 주세요.'

        app_dir = resolve_app_dir()
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        subprocess.Popen(
            [
                'powershell',
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                str(helper),
                '-ZipPath',
                str(zip_path),
                '-AppDir',
                str(app_dir),
                '-ExePath',
                str(Path(sys.executable).resolve()),
                '-WaitPid',
                str(os.getpid()),
            ],
            creationflags=flags,
            close_fds=True,
        )
        os._exit(0)

    if apply_zip_update_dev(zip_path):
        write_update_state(phase='idle', message='업데이트 완료 — 재시작 필요', latest_version=latest or None)
        return True, f'v{latest} 업데이트를 적용했습니다. 프로그램을 다시 실행해 주세요.'

    write_update_state(phase='ready', message='ZIP 적용 실패', latest_version=latest or None, artifact=str(zip_path))
    return False, 'ZIP 업데이트 적용에 실패했습니다.'
