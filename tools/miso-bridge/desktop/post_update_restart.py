"""설치 프로그램이 끝난 뒤에만 다시 실행한다.

설치 중에는 설치 폴더의 python.exe가 바뀌므로, 대기는 설치 폴더 밖 wscript가 한다.
이 모듈의 대기·판정 함수를 그 스크립트가 같은 순서로 따른다.
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

INSTALLER_POLL_SEC = 1.0
FALLBACK_WAIT_SEC = 8


def installer_log_path() -> Path:
    from desktop.config import APP_DATA_DIR

    return APP_DATA_DIR / 'installer.log'


def _process_running(pid: int) -> bool:
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
    except (OSError, subprocess.TimeoutExpired):
        return False
    return str(pid) in (result.stdout or '')


def wait_for_installer(pid: int) -> None:
    if pid <= 0:
        time.sleep(FALLBACK_WAIT_SEC)
        return
    while _process_running(pid):
        time.sleep(INSTALLER_POLL_SEC)


def installer_failure_reason(log_text: str) -> str | None:
    text = log_text or ''
    if 'Installation process succeeded' in text:
        return None
    for line in text.splitlines():
        lowered = line.lower()
        if 'setup was not completed' in lowered or lowered.strip().startswith('error'):
            cleaned = line.strip()
            return cleaned[:400] or '설치 프로그램이 끝나지 못했습니다.'
    if text.strip():
        return '설치 프로그램이 끝나지 못했습니다.'
    return '설치 로그가 없습니다.'


def finish_after_install(installer_pid: int, *, bridge_dir: Path | None = None) -> bool:
    """설치 프로세스가 끝난 뒤 로그를 확인하고, 성공했을 때만 다시 실행한다."""
    from desktop.config import append_launch_log, append_tray_event

    wait_for_installer(installer_pid)
    log_path = installer_log_path()
    try:
        log_text = log_path.read_text(encoding='utf-8', errors='replace') if log_path.is_file() else ''
    except OSError as exc:
        log_text = ''
        append_tray_event(f'업데이트 설치 실패: 설치 로그를 읽지 못했습니다. ({exc})')
        append_launch_log('실행 판단: 업데이트 설치 로그를 읽지 못함')
        return False
    reason = installer_failure_reason(log_text)
    if reason:
        append_tray_event(f'업데이트 설치 실패: {reason}')
        append_launch_log(f'실행 판단: 업데이트 설치 실패 ({reason})')
        return False
    append_tray_event('업데이트 설치가 끝났습니다. 프로그램을 다시 켭니다.')
    append_launch_log('실행 판단: 업데이트 설치 완료 후 다시 실행')
    root = bridge_dir or Path(__file__).resolve().parents[1]
    launch = root / 'launch-desktop.vbs'
    if not launch.is_file():
        append_tray_event('업데이트 설치 실패: 실행 파일을 찾지 못했습니다.')
        append_launch_log('실행 판단: 업데이트 후 실행 파일 없음')
        return False
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    subprocess.Popen(
        ['wscript.exe', str(launch)],
        cwd=str(root),
        creationflags=flags,
        close_fds=True,
    )
    return True


def _waiter_script(installer_pid: int, bridge_dir: Path, log_path: Path) -> str:
    """설치 폴더 밖에서 설치 종료를 기다린 뒤, 바뀐 python으로 이 모듈을 실행한다."""
    bridge = str(bridge_dir).replace('"', '')
    module = str((bridge_dir / 'desktop' / 'post_update_restart.py')).replace('"', '')
    python = str((bridge_dir / 'python' / 'python.exe')).replace('"', '')
    tray_log = str(log_path.parent / 'tray-events.log').replace('"', '')
    return f'''Option Explicit
Dim sh, fso, pid
pid = {int(installer_pid)}
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Do While PidRunning(pid)
  WScript.Sleep 1000
Loop
AppendLine "{tray_log}", "설치 프로그램이 끝났습니다. 다시 실행을 확인합니다."
If fso.FileExists("{python}") Then
  sh.CurrentDirectory = "{bridge}"
  sh.Run """{python}"" ""{module}"" --finish {int(installer_pid)}", 0, False
Else
  AppendLine "{tray_log}", "업데이트 설치 실패: 설치 폴더의 실행 파일을 찾지 못했습니다."
End If

Sub AppendLine(path, text)
  Dim f
  On Error Resume Next
  Set f = fso.OpenTextFile(path, 8, True)
  f.WriteLine Now & " " & text
  f.Close
End Sub

Function PidRunning(target)
  Dim svc, procs
  On Error Resume Next
  If target <= 0 Then
    PidRunning = False
    Exit Function
  End If
  Set svc = GetObject("winmgmts:\\\\.\\root\\cimv2")
  Set procs = svc.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE ProcessId=" & target)
  PidRunning = (procs.Count > 0)
  On Error GoTo 0
End Function
'''


def spawn_waiter(installer_pid: int) -> bool:
    from desktop.config import APP_DATA_DIR, append_launch_log, append_tray_event, ensure_app_data

    ensure_app_data()
    bridge_dir = Path(__file__).resolve().parents[1]
    script_path = APP_DATA_DIR / 'post-update-restart.vbs'
    try:
        script_path.write_text(
            _waiter_script(installer_pid, bridge_dir, installer_log_path()),
            encoding='utf-8',
        )
        subprocess.Popen(
            ['wscript.exe', '//B', str(script_path)],
            cwd=str(APP_DATA_DIR),
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
            close_fds=True,
        )
    except OSError as exc:
        append_tray_event(f'업데이트 설치 실패: 설치 완료 대기를 시작하지 못했습니다. ({exc})')
        append_launch_log(f'실행 판단: 업데이트 대기 시작 실패 ({exc})')
        return False
    append_tray_event(f'설치 프로그램 종료를 기다립니다. pid={installer_pid}')
    append_launch_log(f'실행 판단: 설치 프로그램 실행 후 종료 대기 pid={installer_pid} log={installer_log_path()}')
    return True


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == '--finish':
        try:
            pid = int(sys.argv[2])
        except ValueError:
            pid = 0
        # 대기 스크립트가 이미 프로세스가 끝난 뒤에 호출한다. pid가 남아 있으면 한 번 더 기다린다.
        finish_after_install(pid)
        return
    if len(sys.argv) >= 2:
        try:
            finish_after_install(int(sys.argv[1]))
        except ValueError:
            finish_after_install(0)


if __name__ == '__main__':
    main()
