"""트레이. PC에 로그인하면 연동 프로그램과 가상폰을 켠다."""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading
import time
import zipfile
from pathlib import Path

import pystray
from PIL import Image, ImageDraw

from automation.emulator_launcher import open_miso_install_screen, start_emulator_detached
from desktop.config import (
    APP_DATA_DIR,
    append_tray_event,
    bridge_python_env,
    ensure_app_data,
    setup_finished,
)
from desktop.console_quiet import hide_miso_consoles, spawn_hidden
from desktop.emulator_window import minimize_emulator_window
from desktop.fault_log import install_fault_hooks, log_exception
from desktop.python_runtime import resolve_python_exe
from desktop.watch_task import register_watch_task
from desktop.manifest_client import fetch_manifest, is_update_available, update_should_install
from desktop.setup_wizard import run_setup_wizard
from desktop.single_instance import (
    consume_show_window_request,
    release_single_instance,
    resolve_single_instance,
    touch_heartbeat,
)
from desktop.status_window import StatusWindow
from desktop.update_manager import perform_update, restart_self
from version_info import APP_DISPLAY_NAME

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('miso-desktop')
_PORT = 17891
_UPDATE_CHECK_SEC = 30 * 60


class TrayApp:
    def __init__(self) -> None:
        self._proc: subprocess.Popen[str] | None = None
        self._stop = threading.Event()
        self._icon: pystray.Icon | None = None
        self._window = StatusWindow()
        self._window.bind_actions(
            on_restart_phone=self._restart_phone,
            on_install=self._open_install,
            on_logs=self._export_logs,
        )

    def _log(self, message: str) -> None:
        logger.info(message)
        append_tray_event(message)
        self._window.note(message)

    def _icon_image(self) -> Image.Image:
        img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse((8, 8, 56, 56), fill='#7c3aed')
        draw.rectangle((28, 18, 36, 34), fill='white')
        return img

    def _kill_port(self) -> None:
        if sys.platform != 'win32':
            return
        try:
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=8,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
            )
        except (OSError, subprocess.TimeoutExpired):
            return
        needle = f':{_PORT}'
        for line in result.stdout.splitlines():
            if needle not in line or 'LISTENING' not in line.upper():
                continue
            parts = line.split()
            pid = parts[-1] if parts else ''
            if pid.isdigit() and pid != str(os.getpid()):
                subprocess.run(
                    ['taskkill', '/F', '/PID', pid],
                    capture_output=True,
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                )

    def _start_server(self) -> None:
        if self._proc and self._proc.poll() is None:
            return
        self._kill_port()
        python = resolve_python_exe(windowed=True)
        from desktop.config import BRIDGE_DIR

        self._proc = spawn_hidden(
            [python, '-u', 'server.py'],
            cwd=str(BRIDGE_DIR),
            env=bridge_python_env(),
            log_path=APP_DATA_DIR / 'launch.log',
        )
        self._log('연동 프로그램을 켰습니다.')

    def _restart_phone(self) -> None:
        ok, message = start_emulator_detached()
        self._log(message if ok else f'가상폰 실패: {message}')

    def _open_install(self) -> None:
        ok, message = open_miso_install_screen()
        self._log(message if ok else f'설치 화면 실패: {message}')

    def _export_logs(self) -> None:
        ensure_app_data()
        dest = APP_DATA_DIR / 'miso-logs.zip'
        with zipfile.ZipFile(dest, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for name in ('tray-events.log', 'launch-cmd.log', 'launch.log', 'emulator.log', 'installer.log'):
                path = APP_DATA_DIR / name
                if path.is_file():
                    archive.write(path, name)
        subprocess.Popen(['explorer.exe', '/select,', str(dest)])
        self._log('로그 파일을 만들었습니다. 열린 폴더의 압축 파일을 관리자에게 보내 주세요.')

    def _maybe_update(self) -> None:
        while not self._stop.is_set():
            try:
                self._install_update_if_due()
            except Exception as exc:
                self._log(f'업데이트 확인에 실패했습니다. ({exc})')
            if self._stop.wait(_UPDATE_CHECK_SEC):
                return

    def _install_update_if_due(self) -> None:
        manifest = fetch_manifest()
        status = self._window.latest_status()
        automation_active = bool(status and status.get('automationActive'))
        if not manifest or not update_should_install(manifest, automation_active=automation_active):
            if manifest and is_update_available(manifest) and automation_active:
                self._log('작업 중이라 업데이트를 다음 확인까지 미룹니다.')
            return
        ok, message, installer_pid = perform_update(manifest)
        self._log(message)
        if ok:
            self._stop.set()
            if self._proc and self._proc.poll() is None:
                self._proc.terminate()
            restart_self(installer_pid)

    def _watch_server(self) -> None:
        while not self._stop.wait(2):
            try:
                if self._proc is not None and self._proc.poll() is not None:
                    self._log('연동 서버가 꺼져 다시 켭니다.')
                    self._start_server()
            except Exception:
                log_exception('서버 다시 켜기')

    def _quit(self, icon: pystray.Icon) -> None:
        self._stop.set()
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
        icon.stop()
        release_single_instance()

    def run(self) -> None:
        ensure_app_data()
        try:
            register_watch_task()
        except Exception:
            log_exception('실행 확인 예약')
        if resolve_single_instance() != 'acquired':
            return
        if not setup_finished():
            run_setup_wizard()
        self._start_server()
        if setup_finished():
            self._restart_phone()
        self._window.show()
        threading.Thread(target=self._watch_server, name='miso-server-watch', daemon=True).start()
        threading.Thread(target=self._maybe_update, name='miso-update', daemon=True).start()
        menu = pystray.Menu(
            pystray.MenuItem('상태 창', lambda icon, item: self._window.show()),
            pystray.MenuItem('끝내기', self._quit),
        )
        self._icon = pystray.Icon('miso-bridge', self._icon_image(), APP_DISPLAY_NAME, menu)
        threading.Thread(target=self._icon.run, daemon=True).start()
        last_beat = 0.0
        last_quiet = 0.0
        while not self._stop.is_set():
            try:
                now = time.monotonic()
                if now - last_beat >= 5:
                    touch_heartbeat()
                    last_beat = now
                if now - last_quiet >= 1:
                    hide_miso_consoles()
                    minimize_emulator_window()
                    last_quiet = now
                if consume_show_window_request():
                    self._window.show()
                self._window.pump()
            except Exception:
                log_exception('메인 루프')
            time.sleep(0.05)


def main() -> None:
    install_fault_hooks()
    try:
        TrayApp().run()
    except Exception:
        log_exception('실행')
        raise


if __name__ == '__main__':
    main()
