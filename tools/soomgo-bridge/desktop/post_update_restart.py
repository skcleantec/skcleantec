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


def main() -> None:
    bridge_dir = Path(__file__).resolve().parent.parent
    installer_pid = 0
    if len(sys.argv) > 1:
        try:
            installer_pid = int(sys.argv[1].strip())
        except ValueError:
            installer_pid = 0

    _wait_for_installer(installer_pid)
    wait_until_single_instance_free(timeout_sec=MUTEX_WAIT_SEC)
    time.sleep(1.5)
    _launch_tray(bridge_dir)
    os._exit(0)


if __name__ == '__main__':
    main()
