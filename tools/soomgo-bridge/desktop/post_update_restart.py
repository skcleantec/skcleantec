"""Setup.exe 무인 업데이트 완료 후 트레이 앱 재실행."""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

WAIT_SEC = 14


def main() -> None:
    bridge_dir = Path(__file__).resolve().parent.parent
    vbs = bridge_dir / 'launch-desktop.vbs'
    time.sleep(WAIT_SEC)
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    if sys.platform == 'win32' and vbs.is_file():
        subprocess.Popen(
            ['wscript.exe', str(vbs)],
            cwd=str(bridge_dir),
            creationflags=flags,
            close_fds=True,
        )
    else:
        from desktop.config import bridge_python_env

        subprocess.Popen(
            [sys.executable, '-m', 'desktop.tray_app'],
            cwd=str(bridge_dir),
            env=bridge_python_env(),
            creationflags=flags,
            close_fds=True,
        )
    os._exit(0)


if __name__ == '__main__':
    main()
