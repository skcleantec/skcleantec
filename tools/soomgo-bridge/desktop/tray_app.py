"""청소비서 숨고 브릿지 — 트레이·상태창·자동 업데이트"""
from __future__ import annotations

import logging
import os
import re
import subprocess
import sys
import threading
import time
from typing import Any

import pystray
import requests
from PIL import Image, ImageDraw
from pystray import MenuItem as item

from desktop.python_runtime import resolve_python_exe
from desktop.config import (
    APP_DATA_DIR,
    BRIDGE_DIR,
    BRIDGE_REQUEST_UPDATE_URL,
    BRIDGE_STATUS_URL,
    bridge_python_env,
    ensure_app_data,
    resolve_restart_flag_path,
    resolve_update_flag_path,
)
from desktop.manifest_client import (
    fetch_manifest,
    is_update_available,
    is_update_required,
    manifest_summary,
)
from desktop.single_instance import (
    consume_show_window_request,
    release_single_instance,
    request_show_existing_window,
    try_acquire_single_instance,
)
from desktop.status_window import StatusWindow
from desktop.update_manager import (
    download_update_artifact,
    install_cached_artifact,
    is_bridge_idle_for_auto_install,
    perform_update,
    read_update_state,
    restart_self,
    schedule_post_setup_restart,
)
from version_info import APP_DISPLAY_NAME, APP_VERSION, BRIDGE_API_VERSION

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('soomgo-bridge-desktop')

_BRIDGE_PORT = 17890
_WIN_CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0x08000000)
_LAUNCH_LOG = APP_DATA_DIR / 'launch.log'


def _append_launch_log(message: str) -> None:
    try:
        ensure_app_data()
        stamp = time.strftime('%Y-%m-%d %H:%M:%S')
        with _LAUNCH_LOG.open('a', encoding='utf-8') as f:
            f.write(f'{stamp} {message}\n')
    except OSError:
        pass


def _python_exe() -> str:
    """pythonw로 실행될 때 서버·pip는 python.exe 사용."""
    return resolve_python_exe(windowed=False)


class _StatusWindowLogHandler(logging.Handler):
    def __init__(self, window: StatusWindow) -> None:
        super().__init__()
        self._window = window

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
            level = 'error' if record.levelno >= logging.ERROR else 'info'
            self._window.append_log_async(msg, level=level)
        except Exception:
            pass


class TrayApp:
    def __init__(self) -> None:
        self._bridge_proc: subprocess.Popen[str] | None = None
        self._bridge_log_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._icon: pystray.Icon | None = None
        self._status: dict[str, Any] | None = None
        self._manifest: dict[str, Any] | None = None
        self._update_busy = False
        self._idle_install_ticks = 0
        self._last_bg_download_at = 0.0
        self._bridge_failures = 0
        self._window = StatusWindow()
        self._icon_thread: threading.Thread | None = None

    def _subprocess_flags(self) -> int:
        return _WIN_CREATE_NO_WINDOW if sys.platform == 'win32' else 0

    def _log(self, message: str, *, level: str = 'info') -> None:
        if level == 'error':
            logger.error(message)
        else:
            logger.info(message)

    def _kill_stale_bridge_listeners(self) -> None:
        if sys.platform != 'win32':
            return
        try:
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                creationflags=self._subprocess_flags(),
                timeout=8,
            )
            pids: set[str] = set()
            needle = f':{_BRIDGE_PORT}'
            for line in result.stdout.splitlines():
                if needle not in line or 'LISTENING' not in line.upper():
                    continue
                parts = line.split()
                if parts:
                    pid = parts[-1]
                    if pid.isdigit():
                        pids.add(pid)
            current_pid = str(os.getpid())
            for pid in pids:
                if pid == current_pid:
                    continue
                subprocess.run(
                    ['taskkill', '/F', '/PID', pid],
                    capture_output=True,
                    creationflags=self._subprocess_flags(),
                    timeout=8,
                )
                self._log(f'이전 브릿지 프로세스 종료 (PID {pid})')
        except Exception as exc:
            self._log(f'포트 {_BRIDGE_PORT} 정리 실패: {exc}', level='error')

    def _ensure_dependencies(self) -> None:
        req = BRIDGE_DIR / 'requirements.txt'
        req_desktop = BRIDGE_DIR / 'requirements-desktop.txt'
        if not req.exists():
            return
        args = [resolve_python_exe(windowed=False), '-m', 'pip', 'install', '-r', str(req)]
        if req_desktop.exists():
            args.extend(['-r', str(req_desktop)])
        args.extend(['-q', '--disable-pip-version-check'])
        try:
            self._log('Python 패키지 확인 중…')
            result = subprocess.run(
                args,
                cwd=str(BRIDGE_DIR),
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                creationflags=self._subprocess_flags(),
                timeout=300,
            )
            if result.returncode != 0:
                tail = (result.stderr or result.stdout or '').strip().splitlines()
                hint = tail[-1] if tail else f'exit {result.returncode}'
                self._log(f'패키지 설치 확인 실패: {hint}', level='error')
                return
            self._log('Python 패키지 준비 완료')
        except Exception as exc:
            self._log(f'패키지 설치 확인 실패: {exc}', level='error')

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

    def _read_bridge_output(self) -> None:
        proc = self._bridge_proc
        if not proc or not proc.stdout:
            return
        try:
            for line in proc.stdout:
                if self._stop.is_set():
                    break
                text = line.rstrip()
                if text:
                    level = 'error' if re.search(r'error|exception|traceback', text, re.I) else 'info'
                    self._window.append_log_async(text, level=level)
        except Exception as exc:
            self._window.append_log_async(f'브릿지 로그 수신 종료: {exc}', level='error')

    def _verify_bridge_runtime(self) -> tuple[bool, str]:
        exe = _python_exe()
        probe = (
            'import sys; import selenium; from http.server import HTTPServer; '
            'print(sys.executable)'
        )
        try:
            result = subprocess.run(
                [exe, '-c', probe],
                cwd=str(BRIDGE_DIR),
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=90,
                creationflags=self._subprocess_flags(),
            )
            if result.returncode == 0:
                lines = [ln.strip() for ln in (result.stdout or '').splitlines() if ln.strip()]
                return True, lines[-1] if lines else exe
            detail = ((result.stderr or '') + '\n' + (result.stdout or '')).strip()
            return False, detail[-800:] if detail else f'exit {result.returncode}'
        except Exception as exc:
            return False, str(exc)

    def _start_bridge(self) -> None:
        if self._bridge_proc and self._bridge_proc.poll() is None:
            return
        py = _python_exe()
        env = bridge_python_env(
            {
                'SOOMGO_DESKTOP_RUNNING': '1',
                'SOOMGO_APP_VERSION': APP_VERSION,
            }
        )
        server_py = BRIDGE_DIR / 'server.py'
        self._log(f'브릿지 Python: {py}')
        _append_launch_log(f'start bridge python={py}')
        self._bridge_proc = subprocess.Popen(
            [py, '-u', str(server_py)],
            cwd=str(BRIDGE_DIR),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=self._subprocess_flags(),
        )
        self._log(f'브릿지 서버 시작 (PID {self._bridge_proc.pid})')
        self._bridge_log_thread = threading.Thread(target=self._read_bridge_output, daemon=True)
        self._bridge_log_thread.start()

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
            proc_dead = self._bridge_proc is not None and self._bridge_proc.poll() is not None
            if proc_dead:
                code = self._bridge_proc.poll() if self._bridge_proc else None
                self._log(f'브릿지 서버가 종료되었습니다 (코드 {code})', level='error')
                _append_launch_log(f'bridge exit code={code}')
                self._bridge_proc = None
                self._bridge_failures += 1
                if not self._stop.is_set() and self._bridge_failures <= 5 and code not in (0, None):
                    self._log('브릿지 자동 재시작…')
                    time.sleep(1.0)
                    self._kill_stale_bridge_listeners()
                    self._start_bridge()
            self._status = self._fetch_status()
            if self._status:
                self._bridge_failures = 0
            hint = None
            if self._manifest and (is_update_required(self._manifest) or is_update_available(self._manifest)):
                hint = '새 버전이 있습니다. 트레이 → 업데이트 확인'
            self._window.update_bridge_status_async(self._status, update_hint=hint)
            self._refresh_icon()
            if consume_show_window_request():
                self._window.show()
            flag_path = resolve_update_flag_path()
            if flag_path.exists():
                mode = 'prompt'
                try:
                    raw = flag_path.read_text(encoding='utf-8').strip().lower()
                    if raw in ('background', 'install', 'prompt'):
                        mode = raw
                except OSError:
                    pass
                try:
                    flag_path.unlink(missing_ok=True)
                except OSError:
                    pass
                if mode == 'background':
                    threading.Thread(target=self._run_background_download, daemon=True).start()
                elif mode == 'install':
                    threading.Thread(target=self._run_install_ready, daemon=True).start()
                else:
                    threading.Thread(target=lambda: self._check_update_prompt(force=True), daemon=True).start()
            restart_flag = resolve_restart_flag_path()
            if restart_flag.exists():
                mode = 'bridge'
                try:
                    mode = restart_flag.read_text(encoding='utf-8').strip() or 'bridge'
                    restart_flag.unlink(missing_ok=True)
                except OSError:
                    pass
                if mode == 'desktop':
                    self._log('데스크톱 앱 재시작…')
                    self._stop_bridge()
                    restart_self()
                else:
                    self._restart_bridge()
            self._maybe_background_download()
            self._maybe_idle_auto_install()
            time.sleep(3)

    def _show_window_watch_loop(self) -> None:
        """바탕화면 재실행 시 상태창 표시 요청을 빠르게 반영."""
        while not self._stop.is_set():
            if consume_show_window_request():
                self._window.show()
            time.sleep(0.25)

    def _maybe_background_download(self) -> None:
        if self._update_busy or not self._manifest:
            return
        if not is_update_available(self._manifest):
            return
        now = time.time()
        if now - self._last_bg_download_at < 600:
            return
        state = read_update_state()
        if state.get('phase') in ('downloading', 'ready', 'installing'):
            return
        self._last_bg_download_at = now
        threading.Thread(target=self._run_background_download, daemon=True).start()

    def _maybe_idle_auto_install(self) -> None:
        if self._update_busy or not self._manifest:
            return
        state = read_update_state()
        if state.get('phase') != 'ready':
            self._idle_install_ticks = 0
            return
        if not is_bridge_idle_for_auto_install(self._status):
            self._idle_install_ticks = 0
            return
        self._idle_install_ticks += 1
        if self._idle_install_ticks < 20:
            return
        self._idle_install_ticks = 0
        self._log('유휴 상태 — 예약된 업데이트를 자동 설치합니다.')
        threading.Thread(target=self._run_install_ready, daemon=True).start()

    def _run_background_download(self) -> None:
        if self._update_busy:
            return
        manifest = self._manifest or fetch_manifest()
        if not manifest or not is_update_available(manifest):
            return
        self._update_busy = True
        ok, msg = download_update_artifact(manifest)
        self._update_busy = False
        self._manifest = manifest
        if ok:
            self._log(msg)
        else:
            self._log(msg, level='error')

    def _run_install_ready(self) -> None:
        if self._update_busy:
            return
        manifest = self._manifest or fetch_manifest()
        if not manifest:
            return
        state = read_update_state()
        if state.get('phase') != 'ready':
            ok, msg = download_update_artifact(manifest, force=True)
            if not ok:
                self._log(msg, level='error')
                return
        threading.Thread(target=lambda: self._run_update(manifest), daemon=True).start()

    def _check_update_prompt(self, *, force: bool = False, auto_install: bool = False) -> None:
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
            if auto_install or required:
                threading.Thread(target=lambda: self._run_update(manifest), daemon=True).start()
                return
            if not force and not available:
                return
            title = '업데이트 안내'
            body = manifest_summary(manifest) + '\n\n지금 업데이트하시겠습니까?'
            if mb.askyesno(title, body):
                threading.Thread(target=lambda: self._run_update(manifest), daemon=True).start()

        self._window.run_on_ui(ui)

    def _run_update(self, manifest: dict[str, Any]) -> None:
        self._update_busy = True
        state = read_update_state()
        if state.get('phase') == 'ready':
            ok, msg = install_cached_artifact(manifest)
        else:
            ok, msg = perform_update(manifest)
        self._update_busy = False

        def done() -> None:
            import tkinter.messagebox as mb

            mb.showinfo('업데이트' if ok else '업데이트 실패', msg)

        self._window.run_on_ui(done)
        if not ok:
            return
        url_lower = str(manifest.get('downloadUrl', '')).lower()
        if url_lower.endswith('.zip'):
            self._stop_bridge()
            restart_self()
            return
        if url_lower.endswith('.exe'):
            self._log('설치 프로그램 실행 — 완료 후 자동 재시작 예약')
            schedule_post_setup_restart()
            self._stop_bridge()
            os._exit(0)

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
            item('상태 보기', lambda: self._window.show(), default=True),
            item('업데이트 확인', lambda: self._check_update_prompt(force=True)),
            item('브릿지 재시작', self._restart_bridge),
            pystray.Menu.SEPARATOR,
            item('종료', self._quit),
        )

    def _restart_bridge(self, *_args) -> None:
        self._log('브릿지 재시작…')
        self._stop_bridge()
        time.sleep(0.5)
        self._kill_stale_bridge_listeners()
        self._start_bridge()

    def _quit(self, *_args) -> None:
        """트레이 메뉴 종료 — Tk mainloop가 끝나면 run()에서 정리."""
        self._window.run_on_ui(self._window.destroy)

    def _shutdown(self) -> None:
        self._stop.set()
        self._stop_bridge()
        self._kill_stale_bridge_listeners()
        release_single_instance()
        if self._icon:
            try:
                self._icon.stop()
            except Exception:
                pass

    def run(self) -> None:
        if not try_acquire_single_instance():
            request_show_existing_window()
            _append_launch_log('duplicate launch — requested show existing window')
            logger.info('이미 실행 중 — 상태창 표시만 요청하고 종료합니다.')
            return

        _append_launch_log(f'start v{APP_VERSION}')
        ensure_app_data()
        self._kill_stale_bridge_listeners()
        self._ensure_dependencies()
        ok, detail = self._verify_bridge_runtime()
        _append_launch_log(f'bridge runtime ok={ok} detail={detail[:240]}')
        if not ok:
            self._log(f'브릿지 Python 환경 오류:\n{detail}', level='error')
        else:
            self._log(f'브릿지 Python 확인: {detail}')
        self._start_bridge()
        self._manifest = fetch_manifest()
        if self._manifest and is_update_required(self._manifest):
            threading.Thread(target=lambda: self._check_update_prompt(force=True), daemon=True).start()
        poll = threading.Thread(target=self._poll_loop, daemon=True)
        poll.start()
        show_watch = threading.Thread(target=self._show_window_watch_loop, daemon=True, name='show-window-watch')
        show_watch.start()
        self._icon = pystray.Icon(
            'soomgo-bridge',
            self._icon_image(),
            APP_DISPLAY_NAME,
            menu=self._build_menu(),
        )

        def _run_tray() -> None:
            try:
                assert self._icon is not None
                self._icon.run()
            except Exception as exc:
                logger.error('트레이 종료: %s', exc)

        self._icon_thread = threading.Thread(target=_run_tray, daemon=True, name='pystray')
        self._icon_thread.start()

        def _on_window_ready() -> None:
            logging.getLogger().addHandler(_StatusWindowLogHandler(self._window))
            self._window.show()

        try:
            self._window.run_tk_loop(on_ready=_on_window_ready)
        finally:
            _append_launch_log('shutdown')
            self._shutdown()


def main() -> None:
    try:
        TrayApp().run()
    except Exception as exc:
        _append_launch_log(f'fatal: {exc}')
        logger.exception('프로그램 시작 실패')
        try:
            import tkinter.messagebox as mb

            mb.showerror(
                APP_DISPLAY_NAME,
                f'프로그램을 시작하지 못했습니다.\n\n{exc}\n\n'
                f'로그: %LOCALAPPDATA%\\Cbiseo\\SoomgoBridge\\launch.log',
            )
        except Exception:
            pass
        raise


if __name__ == '__main__':
    main()
