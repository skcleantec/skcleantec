"""청소비서 숨고 브릿지 — 트레이·상태창·자동 업데이트"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading
import time
from typing import Any

import pystray
import requests
from PIL import Image, ImageDraw
from pystray import MenuItem as item

from desktop.config import (
    BRIDGE_DIR,
    BRIDGE_REQUEST_UPDATE_URL,
    BRIDGE_STATUS_URL,
    ensure_app_data,
    resolve_update_flag_path,
)
from desktop.manifest_client import (
    fetch_manifest,
    is_update_available,
    is_update_required,
    manifest_summary,
)
from desktop.status_window import StatusWindow
from desktop.update_manager import perform_update, restart_self
from version_info import APP_DISPLAY_NAME, APP_VERSION, BRIDGE_API_VERSION

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('soomgo-bridge-desktop')


class TrayApp:
    def __init__(self) -> None:
        self._bridge_proc: subprocess.Popen | None = None
        self._stop = threading.Event()
        self._icon: pystray.Icon | None = None
        self._status: dict[str, Any] | None = None
        self._manifest: dict[str, Any] | None = None
        self._update_busy = False
        self._window = StatusWindow()
        self._tk_thread = threading.Thread(target=self._window.run_tk_loop, daemon=True)
        self._tk_thread.start()
        if not self._window.wait_ready():
            logger.warning('status window did not initialize in time')

    def _make_icon(self, color: str) -> Image.Image:
        size = 64
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse((8, 8, size - 8, size - 8), fill=color)
        draw.rectangle((28, 18, 36, 30), fill='white')
        draw.polygon([(22, 30), (42, 30), (32, 44)], fill='white')
        return img

    def _icon_image(self) -> Image.Image:
        if not self._bridge_proc or self._bridge_proc.poll() is not None:
            return self._make_icon('#94a3b8')
        if self._status and self._status.get('inChatRoom'):
            return self._make_icon('#22c55e')
        if self._status and self._status.get('loggedIn'):
            return self._make_icon('#0ea5e9')
        return self._make_icon('#f59e0b')

    def _fetch_status(self) -> dict[str, Any] | None:
        try:
            res = requests.get(BRIDGE_STATUS_URL, timeout=3)
            if res.ok:
                data = res.json()
                if isinstance(data, dict):
                    return data
        except Exception:
            return None
        return None

    def _start_bridge(self) -> None:
        if self._bridge_proc and self._bridge_proc.poll() is None:
            return
        env = os.environ.copy()
        env['SOOMGO_DESKTOP_RUNNING'] = '1'
        env['SOOMGO_APP_VERSION'] = APP_VERSION
        server_py = BRIDGE_DIR / 'server.py'
        self._bridge_proc = subprocess.Popen(
            [sys.executable, str(server_py)],
            cwd=str(BRIDGE_DIR),
            env=env,
        )
        logger.info('bridge server started pid=%s', self._bridge_proc.pid)

    def _stop_bridge(self) -> None:
        if self._bridge_proc and self._bridge_proc.poll() is None:
            self._bridge_proc.terminate()
            try:
                self._bridge_proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self._bridge_proc.kill()
        self._bridge_proc = None

    def _refresh_icon(self) -> None:
        if self._icon:
            self._icon.icon = self._icon_image()
            title = '숨고 연동 · 실행 중'
            if self._status and self._status.get('inChatRoom'):
                title = f"숨고 연동 · {self._status.get('nickname') or '채팅방'}"
            self._icon.title = title

    def _poll_loop(self) -> None:
        while not self._stop.is_set():
            self._status = self._fetch_status()
            hint = None
            if self._manifest and (is_update_required(self._manifest) or is_update_available(self._manifest)):
                hint = '새 버전이 있습니다. 트레이 → 업데이트 확인'
            self._window.update_bridge_status_async(self._status, update_hint=hint)
            self._refresh_icon()
            flag_path = resolve_update_flag_path()
            if flag_path.exists():
                try:
                    flag_path.unlink(missing_ok=True)
                except OSError:
                    pass
                threading.Thread(target=lambda: self._check_update_prompt(force=True), daemon=True).start()
            time.sleep(3)

    def _check_update_prompt(self, *, force: bool = False) -> None:
        def ui() -> None:
            import tkinter.messagebox as mb

            if self._update_busy:
                return
            manifest = fetch_manifest()
            self._manifest = manifest
            if not manifest:
                if force:
                    mb.showinfo('업데이트 확인', '서버에서 버전 정보를 가져오지 못했습니다.')
                return
            required = is_update_required(manifest)
            available = is_update_available(manifest)
            if not force and not required and not available:
                if force:
                    mb.showinfo('업데이트', f'현재 최신 버전입니다.\n\n{manifest_summary(manifest)}')
                return
            title = '업데이트 필요' if required else '업데이트 안내'
            body = manifest_summary(manifest) + '\n\n지금 업데이트하시겠습니까?'
            if mb.askyesno(title, body):
                threading.Thread(target=lambda: self._run_update(manifest), daemon=True).start()

        self._window.run_on_ui(ui)

    def _run_update(self, manifest: dict[str, Any]) -> None:
        self._update_busy = True
        ok, msg = perform_update(manifest)
        self._update_busy = False

        def done() -> None:
            import tkinter.messagebox as mb

            mb.showinfo('업데이트' if ok else '업데이트 실패', msg)

        self._window.run_on_ui(done)
        if ok and str(manifest.get('downloadUrl', '')).lower().endswith('.zip'):
            self._stop_bridge()
            restart_self()

    def _show_message(self, title: str, message: str) -> None:
        def ui() -> None:
            import tkinter.messagebox as mb

            mb.showinfo(title, message)

        self._window.run_on_ui(ui)

    def _request_update_from_crm(self) -> None:
        try:
            requests.post(BRIDGE_REQUEST_UPDATE_URL, json={}, timeout=3)
        except Exception:
            pass
        self._check_update_prompt(force=True)

    def _build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            item('상태 보기', lambda: self._window.show()),
            item('업데이트 확인', lambda: self._check_update_prompt(force=True)),
            item('브릿지 재시작', self._restart_bridge),
            pystray.Menu.SEPARATOR,
            item('종료', self._quit),
        )

    def _restart_bridge(self, *_args) -> None:
        self._stop_bridge()
        time.sleep(0.5)
        self._start_bridge()

    def _quit(self, *_args) -> None:
        self._stop.set()
        self._stop_bridge()
        if self._icon:
            self._icon.stop()
        self._window.run_on_ui(self._window.destroy)
        os._exit(0)

    def run(self) -> None:
        ensure_app_data()
        self._start_bridge()
        self._manifest = fetch_manifest()
        if self._manifest and is_update_required(self._manifest):
            threading.Thread(target=lambda: self._check_update_prompt(force=True), daemon=True).start()
        poll = threading.Thread(target=self._poll_loop, daemon=True)
        poll.start()
        self._icon = pystray.Icon(
            'soomgo-bridge',
            self._icon_image(),
            APP_DISPLAY_NAME,
            menu=self._build_menu(),
        )
        self._window.show()
        self._icon.run()


def main() -> None:
    TrayApp().run()


if __name__ == '__main__':
    main()
