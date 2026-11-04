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
import requests
from PIL import Image, ImageDraw

from automation.emulator_launcher import open_miso_install_screen, start_emulator_detached
from desktop.config import (
    APP_DATA_DIR,
    BRIDGE_DIR,
    BRIDGE_STATUS_URL,
    append_tray_event,
    bridge_python_env,
    ensure_app_data,
    setup_finished,
)
from desktop.manifest_client import fetch_manifest, is_update_available
from desktop.python_runtime import resolve_python_exe
from desktop.setup_wizard import run_setup_wizard
from desktop.single_instance import (
    consume_show_window_request,
    release_single_instance,
    request_show_existing_window,
    try_acquire_single_instance,
)
from desktop.status_window import StatusWindow
from desktop.update_manager import perform_update, restart_self
from version_info import APP_DISPLAY_NAME

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('miso-desktop')
_PORT = 17891


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
        self._status: dict | None = None

    def _log(self, message: str) -> None:
        logger.info(message)
        append_tray_event(message)

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
        python = resolve_python_exe(windowed=False)
        self._proc = subprocess.Popen(
            [python, '-u', 'server.py'],
            cwd=str(BRIDGE_DIR),
            env=bridge_python_env(),
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
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
            for name in ('tray-events.log', 'launch-cmd.log'):
                path = APP_DATA_DIR / name
                if path.is_file():
                    archive.write(path, name)
        subprocess.Popen(['explorer.exe', '/select,', str(dest)])
        self._log('로그 파일을 만들었습니다. 열린 폴더의 압축 파일을 관리자에게 보내 주세요.')

    def _refresh_status(self) -> None:
        phone, miso, login, crm = '꺼짐', '확인 안 됨', '확인 안 됨', '연결 안 됨'
        try:
            res = requests.get(BRIDGE_STATUS_URL, timeout=4)
            data = res.json()
            self._status = data if isinstance(data, dict) else None
            stage = str((self._status or {}).get('setupStage') or '')
            phone = '켜짐' if stage in ('no_miso', 'miso_logged_out', 'ready') else ('켜지는 중' if stage == 'booting' else '꺼짐')
            if stage == 'no_miso':
                miso = '설치 안 됨'
            elif stage in ('miso_logged_out', 'ready'):
                miso = '설치됨'
            login = '로그인됨' if stage == 'ready' else ('로그인 필요' if stage == 'miso_logged_out' else '확인 안 됨')
            crm = '준비됨' if res.ok else '연결 안 됨'
        except Exception:
            self._status = None
        self._window.update_status(
            phone=f'가상폰: {phone}',
            miso=f'미소: {miso}',
            login=f'로그인: {login}',
            crm=f'CRM 연결: {crm}',
        )

    def _maybe_update(self) -> None:
        manifest = fetch_manifest()
        if not manifest or not is_update_available(manifest):
            return
        if self._status and self._status.get('automationActive'):
            return
        ok, message = perform_update(manifest)
        self._log(message)
        if ok:
            restart_self()

    def _loop(self) -> None:
        while not self._stop.wait(8):
            if self._proc and self._proc.poll() is not None:
                self._start_server()
            self._refresh_status()
            if consume_show_window_request():
                self._window.show()

    def _quit(self, icon: pystray.Icon) -> None:
        self._stop.set()
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
        icon.stop()
        release_single_instance()

    def run(self) -> None:
        ensure_app_data()
        if not try_acquire_single_instance():
            request_show_existing_window()
            return
        if not setup_finished():
            run_setup_wizard()
        self._start_server()
        if setup_finished():
            self._restart_phone()
        self._window.show()
        threading.Thread(target=self._loop, daemon=True).start()
        threading.Thread(target=self._maybe_update, daemon=True).start()
        menu = pystray.Menu(
            pystray.MenuItem('상태 창', lambda icon, item: self._window.show()),
            pystray.MenuItem('끝내기', self._quit),
        )
        self._icon = pystray.Icon('miso-bridge', self._icon_image(), APP_DISPLAY_NAME, menu)
        threading.Thread(target=self._icon.run, daemon=True).start()
        while not self._stop.is_set():
            self._window.pump()
            time.sleep(0.05)


def main() -> None:
    TrayApp().run()


if __name__ == '__main__':
    main()
