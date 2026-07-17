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
from typing import Any, Callable, Literal

import requests

from desktop.config import BRIDGE_DIR, UPDATE_CACHE_DIR, UPDATE_STATE_PATH, ensure_app_data
from version_info import APP_VERSION

logger = logging.getLogger(__name__)

TrayHandoffAction = Literal['exit_tray', 'restart_tray']


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


def _resolve_cached_dest(manifest: dict[str, Any], state: dict[str, Any]) -> Path | None:
    artifact_raw = str(state.get('artifact', '')).strip()
    if artifact_raw:
        return Path(artifact_raw)
    return _artifact_path(manifest)


def cached_artifact_is_valid(manifest: dict[str, Any], state: dict[str, Any] | None = None) -> bool:
    """다운로드 캐시가 현재 manifest 버전·sha256과 일치하는지."""
    state = state if state is not None else read_update_state()
    if state.get('phase') != 'ready':
        return False
    latest = str(manifest.get('latestVersion', '')).strip()
    cached_ver = str(state.get('latestVersion', '')).strip()
    if latest and cached_ver and cached_ver != latest:
        return False
    dest = _resolve_cached_dest(manifest, state)
    if not dest or not dest.is_file():
        return False
    expected = str(manifest.get('sha256', '')).strip().lower()
    if expected:
        try:
            if _sha256_file(dest).lower() != expected:
                return False
        except OSError:
            return False
    return True


def clear_stale_update_cache(manifest: dict[str, Any]) -> None:
    """manifest와 다른 버전 캐시·상태를 비웁니다."""
    clear_stale_update_phase_if_current(manifest)
    state = read_update_state()
    if cached_artifact_is_valid(manifest, state):
        return
    dest = _resolve_cached_dest(manifest, state)
    if dest and dest.is_file():
        try:
            dest.unlink(missing_ok=True)
        except OSError:
            pass
    write_update_state(phase='idle', message=None, latest_version=None, artifact=None)


def clear_stale_update_phase_if_current(manifest: dict[str, Any] | None) -> None:
    """업데이트 완료 후 남은 installing/ready/downloading 플래그 정리."""
    if not manifest:
        return
    state = read_update_state()
    phase = str(state.get('phase', 'idle')).strip()
    if phase not in ('installing', 'ready', 'downloading'):
        return
    try:
        from desktop.manifest_client import is_update_available, is_update_required, parse_version_tuple
    except ImportError:
        return
    latest = str(manifest.get('latestVersion', '')).strip()
    if not latest:
        return
    if parse_version_tuple(latest) > parse_version_tuple(APP_VERSION):
        return
    if is_update_available(manifest, APP_VERSION) or is_update_required(manifest):
        return
    write_update_state(phase='idle', message=None, latest_version=latest or None, artifact=None)


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
    if not force and cached_artifact_is_valid(manifest, state):
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


def ensure_update_artifact_ready(manifest: dict[str, Any]) -> tuple[bool, str, Path | None]:
    """다운로드까지 완료된 캐시 경로를 반환."""
    clear_stale_update_cache(manifest)
    state = read_update_state()
    if cached_artifact_is_valid(manifest, state):
        dest = _resolve_cached_dest(manifest, state)
        if dest and dest.is_file():
            return True, '설치 파일 준비됨', dest

    ok, msg = download_update_artifact(manifest, force=True)
    if not ok:
        return False, msg, None

    state = read_update_state()
    dest = _resolve_cached_dest(manifest, state)
    if dest and dest.is_file():
        return True, msg, dest
    return False, '설치 파일 경로를 찾을 수 없습니다.', None


def perform_tray_handoff_update(
    manifest: dict[str, Any],
    *,
    on_before_install: Callable[[], None],
) -> tuple[bool, str, TrayHandoffAction | None]:
    """
    트레이·브릿지를 먼저 내린 뒤 설치.
    exe 성공 시 호출 측에서 os._exit(0), zip 성공 시 restart_self().
    """
    ok, msg, dest = ensure_update_artifact_ready(manifest)
    if not ok or not dest:
        return False, msg, None

    from desktop.manifest_client import is_update_available, is_update_required

    if not is_update_available(manifest, APP_VERSION) and not is_update_required(manifest):
        clear_stale_update_phase_if_current(manifest)
        return False, '이미 최신 버전입니다.', None

    latest = str(manifest.get('latestVersion', '')).strip()
    lower = dest.name.lower()

    if lower.endswith('.zip'):
        write_update_state(
            phase='installing',
            message='ZIP 업데이트 적용 중…',
            latest_version=latest or None,
            artifact=str(dest),
        )
        on_before_install()
        if apply_zip_update(dest):
            from desktop.config import clear_pending_update_manifest

            clear_pending_update_manifest()
            write_update_state(phase='idle', message='ZIP 업데이트 적용 완료', latest_version=latest or None)
            return True, f'ZIP 업데이트를 적용했습니다. (v{latest or APP_VERSION})', 'restart_tray'
        write_update_state(
            phase='ready',
            message='ZIP 업데이트 적용 실패',
            latest_version=latest or None,
            artifact=str(dest),
        )
        return False, 'ZIP 업데이트 적용에 실패했습니다.', None

    if lower.endswith('.exe'):
        write_update_state(
            phase='installing',
            message='업데이트 설치 중…',
            latest_version=latest or None,
            artifact=str(dest),
        )
        on_before_install()
        proc = run_installer_process(dest)
        if not proc:
            write_update_state(
                phase='ready',
                message='설치 프로그램 실행 실패',
                latest_version=latest or None,
                artifact=str(dest),
            )
            return False, '설치 프로그램 실행에 실패했습니다.', None

        from desktop.config import clear_pending_update_manifest

        clear_pending_update_manifest()
        schedule_post_setup_restart(installer_pid=proc.pid)
        return (
            True,
            '업데이트 설치 중입니다. 잠시 후 프로그램이 자동으로 다시 시작됩니다.',
            'exit_tray',
        )

    write_update_state(phase='idle', message='지원하지 않는 배포 형식', latest_version=latest or None)
    return False, '지원하지 않는 배포 형식입니다 (.exe 또는 .zip).', None


def install_cached_artifact(manifest: dict[str, Any]) -> tuple[bool, str]:
    state = read_update_state()
    if not cached_artifact_is_valid(manifest, state):
        return perform_update(manifest)

    dest = _resolve_cached_dest(manifest, state)
    if not dest or not dest.is_file():
        return perform_update(manifest)

    latest = str(manifest.get('latestVersion', '')).strip()
    write_update_state(phase='installing', message='업데이트 설치 중…', latest_version=latest or None, artifact=str(dest))

    lower = dest.name.lower()
    if lower.endswith('.exe'):
        proc = run_installer_process(dest)
        if proc:
            from desktop.config import clear_pending_update_manifest

            clear_pending_update_manifest()
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


def run_installer_process(exe_path: Path) -> subprocess.Popen[Any] | None:
    """Inno Setup 무인 설치 — 재시작은 post_update_restart가 담당."""
    if not exe_path.exists():
        return None
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    try:
        return subprocess.Popen(
            [
                str(exe_path),
                '/VERYSILENT',
                '/SUPPRESSMSGBOXES',
                '/FORCECLOSEAPPLICATIONS',
                '/NORESTART',
            ],
            close_fds=True,
            creationflags=flags,
        )
    except OSError as e:
        logger.error('installer run failed: %s', e)
        return None


def run_installer(exe_path: Path) -> bool:
    return run_installer_process(exe_path) is not None


def perform_update(manifest: dict[str, Any]) -> tuple[bool, str]:
    clear_stale_update_cache(manifest)
    if cached_artifact_is_valid(manifest):
        return install_cached_artifact(manifest)

    ok, msg = download_update_artifact(manifest, force=True)
    if not ok:
        return False, msg
    return install_cached_artifact(manifest)


def schedule_post_setup_restart(*, installer_pid: int = 0) -> bool:
    """Setup.exe 완료·뮤텍스 해제 후 트레이 앱을 다시 띄웁니다."""
    helper = BRIDGE_DIR / 'desktop' / 'post_update_restart.py'
    if not helper.is_file():
        return False
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    try:
        subprocess.Popen(
            [sys.executable, str(helper), str(max(0, installer_pid))],
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
    from desktop.single_instance import release_single_instance

    release_single_instance()
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
