"""5분마다 사용자 권한으로 연동 프로그램이 살아 있는지 확인한다.

로그온 트리거는 이 PC 권한에서 거부되므로, 시작 프로그램 바로 가기로 로그온 실행을 맞춘다.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from desktop.config import append_launch_log
from desktop.console_quiet import no_window_flags

_TASK_NAME = 'CbiseoMisoWatch'


def _root() -> Path:
    return Path(__file__).resolve().parents[1]


def _ensure_logon_shortcut() -> None:
    if sys.platform != 'win32':
        return
    startup = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
    startup.mkdir(parents=True, exist_ok=True)
    link = startup / '청소비서 미소 연동.lnk'
    target = _root() / 'launch-desktop.vbs'
    if not target.is_file():
        return
    if link.is_file():
        return
    command = (
        "$ws = New-Object -ComObject WScript.Shell; "
        f"$s = $ws.CreateShortcut('{link}'); "
        f"$s.TargetPath = 'wscript.exe'; "
        f"$s.Arguments = '//B \"{target}\"'; "
        f"$s.WorkingDirectory = '{_root()}'; "
        '$s.Save()'
    )
    subprocess.run(
        ['powershell', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', command],
        capture_output=True,
        timeout=20,
        creationflags=no_window_flags(),
    )


def register_watch_task() -> None:
    if sys.platform != 'win32':
        return
    _ensure_logon_shortcut()
    vbs = _root() / 'watch-tray.vbs'
    if not vbs.is_file():
        append_launch_log('실행 확인 예약을 만들지 못했습니다. 확인 스크립트가 없습니다.')
        return
    command = f'wscript.exe //B "{vbs}"'
    try:
        result = subprocess.run(
            [
                'schtasks',
                '/Create',
                '/TN',
                _TASK_NAME,
                '/SC',
                'MINUTE',
                '/MO',
                '5',
                '/TR',
                command,
                '/F',
                '/RL',
                'LIMITED',
            ],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=20,
            creationflags=no_window_flags(),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        append_launch_log(f'실행 확인 예약을 만들지 못했습니다. ({exc})')
        return
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or '').strip()
        append_launch_log(f'실행 확인 예약을 만들지 못했습니다. ({detail})')
        return
    append_launch_log('실행 확인 예약을 맞췄습니다. 로그온 시 바로 가기와 5분마다 확인합니다.')
