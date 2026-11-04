"""로그온 시와 5분마다, 사용자 권한으로 연동 프로그램이 살아 있는지 확인한다."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from desktop.config import APP_DATA_DIR, append_launch_log, ensure_app_data
from desktop.console_quiet import no_window_flags

_TASK_NAME = 'CbiseoMisoWatch'


def _xml(vbs: Path) -> str:
    argument = f'//B &quot;{vbs}&quot;'
    return f'''<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
    <TimeTrigger>
      <Repetition>
        <Interval>PT5M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>2026-01-01T00:00:00</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT1M</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>wscript.exe</Command>
      <Arguments>{argument}</Arguments>
    </Exec>
  </Actions>
</Task>
'''


def register_watch_task() -> None:
    if sys.platform != 'win32':
        return
    ensure_app_data()
    vbs = Path(__file__).resolve().parents[1] / 'watch-tray.vbs'
    if not vbs.is_file():
        append_launch_log('실행 확인 예약을 만들지 못했습니다. 확인 스크립트가 없습니다.')
        return
    xml_path = APP_DATA_DIR / 'watch-task.xml'
    xml_path.write_text(_xml(vbs), encoding='utf-16')
    try:
        result = subprocess.run(
            ['schtasks', '/Create', '/TN', _TASK_NAME, '/XML', str(xml_path), '/F'],
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
    append_launch_log('실행 확인 예약을 맞췄습니다. 로그온 시와 5분마다 확인합니다.')
