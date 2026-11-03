"""Setup.exe 무인 업데이트 완료 후 트레이 앱 재실행."""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

from desktop.single_instance import wait_until_single_instance_free

FALLBACK_WAIT_SEC = 8
INSTALLER_POLL_SEC = 1.0
MUTEX_WAIT_SEC = 120.0


def _installer_running(pid: int) -> bool:
    if pid <= 0 or sys.platform != 'win32':
        return False
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    try:
        result = subprocess.run(
            ['tasklist', '/FI', f'PID eq {pid}', '/NH'],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=flags,
            timeout=10,
        )
        return str(pid) in (result.stdout or '')
    except (OSError, subprocess.TimeoutExpired):
        return False


def _wait_for_installer(pid: int) -> None:
    if pid <= 0:
        time.sleep(FALLBACK_WAIT_SEC)
        return
    while _installer_running(pid):
        time.sleep(INSTALLER_POLL_SEC)


def _launch_tray(bridge_dir: Path) -> None:
    vbs = bridge_dir / 'launch-desktop.vbs'
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    if sys.platform == 'win32' and vbs.is_file():
        subprocess.Popen(
            ['wscript.exe', str(vbs)],
            cwd=str(bridge_dir),
            creationflags=flags,
            close_fds=True,
        )
        return
    from desktop.config import bridge_python_env

    subprocess.Popen(
        [sys.executable, '-m', 'desktop.tray_app'],
        cwd=str(bridge_dir),
        env=bridge_python_env(),
        creationflags=flags,
        close_fds=True,
    )


def _event(message: str) -> None:
    try:
        from desktop.config import append_tray_event

        append_tray_event(message)
    except Exception as exc:
        try:
            sys.stderr.write(f'post_update_restart log failed: {exc} | {message}\n')
            sys.stderr.flush()
        except Exception:
            pass


def main() -> None:
    bridge_dir = Path(__file__).resolve().parent.parent
    installer_pid = 0
    if len(sys.argv) > 1:
        try:
            installer_pid = int(sys.argv[1].strip())
        except ValueError:
            installer_pid = 0
    _event(f'post_update_restart start installer_pid={installer_pid}')

    try:
        _wait_for_installer(installer_pid)
    except Exception as exc:
        _event(f'post_update_restart installer wait failed: {exc}')

    try:
        from desktop.bridge_pack_integrity import ensure_bridge_pack_integrity
        from desktop.manifest_client import fetch_manifest_for_update
        from desktop.update_manager import clear_stale_update_phase_if_current, write_update_state

        manifest = fetch_manifest_for_update()
        if manifest:
            from desktop.bridge_pack_integrity import apply_zip_overlay_for_manifest, ensure_bridge_pack_integrity

            apply_zip_overlay_for_manifest(manifest)
            ensure_bridge_pack_integrity(manifest)
            clear_stale_update_phase_if_current(manifest)
        write_update_state(phase='idle', message=None, latest_version=None, artifact=None)
    except Exception as exc:
        _event(f'post_update_restart cleanup failed: {exc}')

    try:
        free = wait_until_single_instance_free(timeout_sec=MUTEX_WAIT_SEC)
        _event(f'post_update_restart mutex free={free}')
    except Exception as exc:
        _event(f'post_update_restart mutex wait failed: {exc}')

    time.sleep(1.5)
    try:
        _launch_tray(bridge_dir)
        _event('post_update_restart launched launch-desktop.vbs')
    except Exception as exc:
        _event(f'post_update_restart launch failed: {exc}')
    os._exit(0)


if __name__ == '__main__':
    main()
