"""Chrome WebDriver — 텔레CRM 숨고 브릿지"""
from __future__ import annotations

import logging
import pathlib
import subprocess
import sys
import threading
import time
from typing import Optional

from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.webdriver import WebDriver as ChromeWebDriver
from selenium.webdriver.support.ui import WebDriverWait

logger = logging.getLogger(__name__)

_CHROME_START_TIMEOUT = 90


def _chrome_profile_dir() -> pathlib.Path:
    try:
        from desktop.config import CHROME_PROFILE_DIR, ensure_app_data

        ensure_app_data()
        CHROME_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        return CHROME_PROFILE_DIR
    except Exception:
        import os

        fallback = (
            pathlib.Path(os.environ.get('LOCALAPPDATA', ''))
            / 'Cbiseo'
            / 'SoomgoBridge'
            / 'chrome-profile'
        )
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _format_start_error(error: Exception | None) -> str:
    if error is None:
        return 'Chrome을 시작할 수 없습니다.'
    msg = str(error).strip() or error.__class__.__name__
    lowered = msg.lower()
    if 'user data directory' in lowered or 'already in use' in lowered or 'profile' in lowered:
        return (
            'Chrome 프로필이 다른 창에 사용 중입니다. '
            '숨고 연동 트레이 → Chrome 종료 후 다시 시도해 주세요.'
        )
    if 'session not created' in lowered or 'chrome failed to start' in lowered:
        return f'Chrome을 시작할 수 없습니다. ({msg})'
    return f'Chrome을 시작할 수 없습니다. ({msg})'


def _remove_profile_lock_files(profile_dir: pathlib.Path) -> None:
    candidates = [
        profile_dir / 'lockfile',
        profile_dir / 'SingletonLock',
        profile_dir / 'Default' / 'lockfile',
        profile_dir / 'Default' / 'SingletonLock',
    ]
    for path in candidates:
        try:
            if path.exists():
                path.unlink(missing_ok=True)
                logger.info('removed chrome lock file: %s', path)
        except OSError as e:
            logger.warning('could not remove lock file %s: %s', path, e)


def _kill_stale_profile_processes(profile_dir: pathlib.Path) -> int:
    """고정 프로필을 붙잡은 Chrome/chromedriver 정리 — Windows 전용."""
    if sys.platform != 'win32':
        return 0

    profile_key = str(profile_dir.resolve())
    profile_tail = f'{profile_dir.parent.name}{pathlib.Path.sep}{profile_dir.name}'
    needles = [profile_key, profile_tail.replace('/', '\\'), profile_tail.replace('\\', '/')]

    ps = r"""
$needles = @({needles})
$killed = 0
foreach ($name in @('chrome.exe','chromedriver.exe')) {{
  Get-CimInstance Win32_Process -Filter "name='$name'" | ForEach-Object {{
    $cmd = [string]$_.CommandLine
    if (-not $cmd) {{ return }}
    $hit = $false
    foreach ($needle in $needles) {{
      if ($cmd -like "*$needle*") {{ $hit = $true; break }}
    }}
    if ($name -eq 'chromedriver.exe' -and -not $hit) {{
      # 브릿지가 driver 참조를 잃은 뒤 남은 chromedriver
      $hit = $true
    }}
    if ($hit) {{
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      $killed++
    }}
  }}
}}
Write-Output $killed
""".format(needles=','.join(f"'{n.replace(chr(39), chr(39)+chr(39))}'" for n in needles if n))

    try:
        proc = subprocess.run(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            capture_output=True,
            text=True,
            timeout=20,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        if proc.returncode != 0:
            logger.warning('profile cleanup ps failed: %s', (proc.stderr or proc.stdout).strip())
            return 0
        raw = (proc.stdout or '').strip().splitlines()
        killed = int(raw[-1]) if raw and raw[-1].isdigit() else 0
        if killed:
            logger.info('killed stale chrome/chromedriver processes: %s', killed)
            time.sleep(1.0)
        return killed
    except Exception as e:
        logger.warning('profile cleanup failed: %s', e)
        return 0


def _prepare_profile_for_start(profile_dir: pathlib.Path) -> None:
    _kill_stale_profile_processes(profile_dir)
    _remove_profile_lock_files(profile_dir)


class BrowserManager:
    def __init__(self, headless: bool = False):
        self.driver: Optional[ChromeWebDriver] = None
        self.headless = headless
        self.wait: Optional[WebDriverWait] = None
        self.last_start_error: str | None = None

    def _build_options(self, profile_dir: pathlib.Path) -> Options:
        options = Options()
        if self.headless:
            options.add_argument('--headless=new')
        options.add_argument(f'--user-data-dir={profile_dir}')
        options.add_argument('--profile-directory=Default')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1400,900')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option('excludeSwitches', ['enable-automation'])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_argument('--disable-notifications')
        options.add_argument('--lang=ko-KR')
        return options

    def _launch_driver(self, options: Options) -> ChromeWebDriver | None:
        holder: dict = {'driver': None, 'error': None}

        def worker():
            try:
                holder['driver'] = ChromeWebDriver(options=options)
            except Exception as e:
                holder['error'] = e

        t = threading.Thread(target=worker, daemon=True)
        t.start()
        t.join(timeout=_CHROME_START_TIMEOUT)

        if t.is_alive():
            logger.error('chrome start timed out after %ss', _CHROME_START_TIMEOUT)
            self.last_start_error = (
                f'Chrome 시작 시간이 {_CHROME_START_TIMEOUT}초를 초과했습니다.'
            )
            return None
        if holder['error'] or not holder['driver']:
            self.last_start_error = _format_start_error(holder.get('error'))
            logger.error('chrome start failed: %s', holder.get('error'))
            return None
        return holder['driver']

    def start(self) -> bool:
        self.last_start_error = None
        profile_dir = _chrome_profile_dir()
        logger.info('chrome profile: %s', profile_dir)

        for attempt in range(2):
            if attempt == 1:
                logger.info('retrying chrome start after profile cleanup')
                _prepare_profile_for_start(profile_dir)
            elif not self.driver:
                # 첫 시도 전에도 driver 없는데 프로필 점유 흔적이 있으면 정리
                _prepare_profile_for_start(profile_dir)

            try:
                if self.driver:
                    try:
                        _ = self.driver.current_url
                        self.wait = self.wait or WebDriverWait(self.driver, 10)
                        return True
                    except Exception:
                        self.stop()

                options = self._build_options(profile_dir)
                driver = self._launch_driver(options)
                if not driver:
                    continue

                self.driver = driver
                self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                    'source': "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
                })
                self.wait = WebDriverWait(self.driver, 10)
                return True
            except Exception as e:
                self.last_start_error = _format_start_error(e)
                logger.error('browser start: %s', e)

        return False

    def arrange_right_half(self, bounds: dict | None = None) -> bool:
        if not self.driver:
            return False
        from automation.window_layout import arrange_soomgo_right_half
        return arrange_soomgo_right_half(self.driver, bounds)

    def stop(self):
        if not self.driver:
            return
        try:
            self.driver.quit()
        except Exception:
            pass
        finally:
            self.driver = None
            self.wait = None

    def force_cleanup(self) -> None:
        """Chrome·driver 강제 종료 + 프로필 lock 정리."""
        self.stop()
        _prepare_profile_for_start(_chrome_profile_dir())

    def is_running(self) -> bool:
        if not self.driver:
            return False
        try:
            _ = self.driver.current_url
            return True
        except Exception:
            self.driver = None
            self.wait = None
            return False
