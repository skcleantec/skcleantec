"""
Selenium 브라우저 관리 모듈
- Chrome WebDriver 자동 버전 관리 (Selenium 4.6+ 내장)
- PyInstaller EXE 환경에서 chromedriver 경로를 명시적으로 설정
- Chrome 자동 업데이트 후 구버전 chromedriver 캐시/EXE 옆 driver 불일치 자동 정리
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from typing import Optional

from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.webdriver import WebDriver as ChromeWebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from automation.window_layout import apply_mobile_viewport, arrange_soomgo_window, ensure_soomgo_mobile_layout

logger = logging.getLogger(__name__)

_CHROME_START_TIMEOUT = 90
_CHROMEDRIVER_MAJOR_RE = re.compile(r'ChromeDriver\s+(\d+)', re.I)


def _get_app_base_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


def _selenium_cache_dir() -> Path:
    env = os.environ.get('SE_CACHE_PATH', '').strip()
    if env:
        return Path(env)
    return Path.home() / '.cache' / 'selenium'


def _configure_selenium_env() -> None:
    """EXE 실행 시 selenium-manager와 캐시 경로를 앱 폴더로 고정"""
    if not getattr(sys, 'frozen', False):
        return

    base = _get_app_base_dir()
    manager = (
        base / '_internal' / 'selenium' / 'webdriver' / 'common' / 'windows' / 'selenium-manager.exe'
    )
    if manager.is_file():
        os.environ['SE_MANAGER_PATH'] = str(manager)

    cache_dir = base / 'selenium_cache'
    cache_dir.mkdir(exist_ok=True)
    os.environ['SE_CACHE_PATH'] = str(cache_dir)


def _run_hidden(cmd: list[str], *, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        creationflags=creationflags,
    )


def _find_chrome_binary() -> Optional[Path]:
    candidates = [
        Path(os.environ.get('PROGRAMFILES', '')) / 'Google' / 'Chrome' / 'Application' / 'chrome.exe',
        Path(os.environ.get('PROGRAMFILES(X86)', '')) / 'Google' / 'Chrome' / 'Application' / 'chrome.exe',
        Path(os.environ.get('LOCALAPPDATA', '')) / 'Google' / 'Chrome' / 'Application' / 'chrome.exe',
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def _read_chrome_version() -> tuple[int, str] | None:
    binary = _find_chrome_binary()
    if not binary:
        return None
    try:
        proc = _run_hidden(
            [
                'powershell',
                '-NoProfile',
                '-Command',
                f'(Get-Item -LiteralPath "{binary}").VersionInfo.ProductVersion',
            ],
            timeout=15,
        )
        version = (proc.stdout or '').strip()
        if not version:
            return None
        major = int(version.split('.', 1)[0])
        return major, version
    except Exception as e:
        logger.warning('Chrome 버전 확인 실패: %s', e)
        return None


def _read_chromedriver_major(driver_path: str) -> int | None:
    try:
        proc = _run_hidden([driver_path, '--version'], timeout=15)
        output = f'{proc.stdout or ""}\n{proc.stderr or ""}'.strip()
        match = _CHROMEDRIVER_MAJOR_RE.search(output)
        if match:
            return int(match.group(1))
    except Exception as e:
        logger.warning('chromedriver 버전 확인 실패 (%s): %s', driver_path, e)
    return None


def _driver_matches_chrome(driver_path: str, chrome_major: int | None) -> bool:
    if chrome_major is None:
        return True
    driver_major = _read_chromedriver_major(driver_path)
    if driver_major is None:
        return True
    return driver_major == chrome_major


def _purge_selenium_driver_cache() -> None:
    cache_root = _selenium_cache_dir()
    targets = [
        cache_root,
        cache_root / 'chromedriver',
        _get_app_base_dir() / 'selenium_cache',
    ]
    seen: set[str] = set()
    for root in targets:
        key = str(root.resolve()) if root.exists() else str(root)
        if key in seen:
            continue
        seen.add(key)
        if not root.exists():
            continue
        try:
            if root.name == 'selenium_cache' or root.name == 'selenium':
                for child in root.iterdir():
                    if child.is_dir():
                        shutil.rmtree(child, ignore_errors=True)
                    elif child.is_file() and child.name.lower().startswith('chromedriver'):
                        child.unlink(missing_ok=True)
            elif root.name == 'chromedriver':
                shutil.rmtree(root, ignore_errors=True)
            logger.info('selenium chromedriver cache cleared: %s', root)
        except Exception as e:
            logger.warning('selenium cache purge failed (%s): %s', root, e)


def _selenium_manager_path() -> Optional[Path]:
    env = os.environ.get('SE_MANAGER_PATH', '').strip()
    if env and Path(env).is_file():
        return Path(env)

    try:
        import selenium

        bundled = (
            Path(selenium.__file__).resolve().parent
            / 'webdriver'
            / 'common'
            / 'windows'
            / 'selenium-manager.exe'
        )
        if bundled.is_file():
            return bundled
    except Exception:
        pass

    if getattr(sys, 'frozen', False):
        base = _get_app_base_dir()
        frozen = base / '_internal' / 'selenium' / 'webdriver' / 'common' / 'windows' / 'selenium-manager.exe'
        if frozen.is_file():
            return frozen
    return None


def _invoke_selenium_manager() -> Optional[str]:
    manager = _selenium_manager_path()
    if not manager:
        logger.error('selenium-manager.exe를 찾을 수 없습니다.')
        return None

    try:
        result = _run_hidden(
            [
                str(manager),
                '--browser',
                'chrome',
                '--language-binding',
                'python',
                '--output',
                'json',
            ],
            timeout=90,
        )
        if result.returncode != 0:
            stderr = (result.stderr or result.stdout or '').strip()
            logger.error('selenium-manager 실패 (code=%s): %s', result.returncode, stderr)
            return None

        stdout = (result.stdout or '').strip()
        if not stdout:
            logger.error('selenium-manager 출력이 비어 있습니다.')
            return None

        payload = json.loads(stdout)
        driver_path = payload.get('result', {}).get('driver_path')
        if driver_path and Path(driver_path).is_file():
            return driver_path

        logger.error('selenium-manager가 chromedriver 경로를 반환하지 않았습니다.')
    except subprocess.TimeoutExpired:
        logger.error('selenium-manager 실행 시간 초과 (90초)')
    except Exception as e:
        logger.error('chromedriver 경로 확인 실패: %s', e)

    return None


def _resolve_chromedriver_path(*, refresh_cache: bool = False) -> Optional[str]:
    """chromedriver.exe 경로 확인 (EXE 옆 → selenium-manager 순)"""
    if refresh_cache:
        _purge_selenium_driver_cache()

    chrome_info = _read_chrome_version()
    chrome_major = chrome_info[0] if chrome_info else None
    if chrome_info:
        logger.info('installed chrome: %s', chrome_info[1])

    base = _get_app_base_dir()
    for candidate in (base / 'chromedriver.exe', base / 'chromedriver' / 'chromedriver.exe'):
        if not candidate.is_file():
            continue
        path = str(candidate)
        if _driver_matches_chrome(path, chrome_major):
            return path
        logger.warning(
            'EXE 옆 chromedriver.exe 버전 불일치 — 무시하고 selenium-manager 사용 (Chrome major=%s)',
            chrome_major,
        )

    return _invoke_selenium_manager()


def _create_chrome_driver(options: Options) -> ChromeWebDriver:
    chrome_binary = _find_chrome_binary()
    if chrome_binary:
        options.binary_location = str(chrome_binary)

    last_error: Exception | None = None
    for attempt, refresh in ((1, False), (2, True)):
        driver_path = _resolve_chromedriver_path(refresh_cache=refresh)
        try:
            if driver_path:
                logger.info('chromedriver 사용 (attempt=%s): %s', attempt, driver_path)
                service = Service(driver_path)
                return ChromeWebDriver(service=service, options=options)
            if attempt == 1:
                logger.info('chromedriver 자동 탐지 모드 사용')
                return ChromeWebDriver(options=options)
        except Exception as e:
            last_error = e
            msg = str(e).lower()
            mismatch = (
                'session not created' in msg
                or 'only supports chrome version' in msg
                or 'version' in msg and 'chromedriver' in msg
            )
            logger.error('chromedriver launch failed (attempt=%s): %s', attempt, e)
            if mismatch and attempt == 1:
                logger.info('chromedriver/Chrome 버전 불일치 — 캐시 삭제 후 재시도')
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError('chromedriver를 시작할 수 없습니다.')


_configure_selenium_env()


def format_browser_start_error(error: Exception | None, chrome_info: tuple[int, str] | None = None) -> str:
    if error is None:
        return 'Chrome 브라우저를 시작할 수 없습니다.'
    msg = str(error).strip() or error.__class__.__name__
    lowered = msg.lower()
    chrome_hint = f' (설치된 Chrome: {chrome_info[1]})' if chrome_info else ''

    if 'session not created' in lowered or 'only supports chrome version' in lowered:
        return (
            'Chrome 업데이트 후 chromedriver 버전이 맞지 않습니다.'
            f'{chrome_hint}\n'
            'EXE 옆 chromedriver.exe가 있으면 삭제하거나 최신으로 교체하고, '
            '프로그램 폴더의 selenium_cache 폴더를 삭제한 뒤 다시 실행해 보세요.'
        )
    if 'cannot find chrome binary' in lowered or 'chrome binary' in lowered:
        return 'Google Chrome이 설치되어 있지 않거나 경로를 찾을 수 없습니다.'
    return f'Chrome 브라우저를 시작할 수 없습니다.{chrome_hint}\n{msg}'


class BrowserManager:
    """Chrome 브라우저 관리 클래스"""

    def __init__(self, headless: bool = False):
        self.driver = None
        self.headless = headless
        self.wait = None
        self.last_start_error: str | None = None

    def start(self) -> bool:
        """브라우저 시작"""
        self.last_start_error = None
        chrome_info = _read_chrome_version()
        try:
            options = Options()
            if self.headless:
                options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--window-size=480,920')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option('excludeSwitches', ['enable-automation'])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--disable-notifications')
            options.add_argument('--lang=ko-KR')

            driver_holder: dict = {'driver': None, 'error': None}

            def _start_worker():
                try:
                    driver_holder['driver'] = _create_chrome_driver(options)
                except Exception as e:
                    driver_holder['error'] = e

            worker = threading.Thread(target=_start_worker, daemon=True)
            worker.start()
            worker.join(timeout=_CHROME_START_TIMEOUT)

            if worker.is_alive():
                self.last_start_error = f'Chrome 시작 시간 초과 ({_CHROME_START_TIMEOUT}초).'
                logger.error('Chrome 시작 시간 초과 (%d초)', _CHROME_START_TIMEOUT)
                return False

            if driver_holder['error'] is not None:
                self.last_start_error = format_browser_start_error(driver_holder['error'], chrome_info)
                logger.error('브라우저 시작 실패: %s', driver_holder['error'])
                return False

            self.driver = driver_holder['driver']
            if self.driver is None:
                self.last_start_error = '브라우저 드라이버가 생성되지 않았습니다.'
                logger.error('브라우저 드라이버가 생성되지 않았습니다.')
                return False

            self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                'source': """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    })
                """
            })
            arrange_soomgo_window(self.driver)
            self.wait = WebDriverWait(self.driver, 10)
            logger.info('브라우저가 성공적으로 시작되었습니다. (모바일 viewport)')
            return True
        except Exception as e:
            self.last_start_error = format_browser_start_error(e, chrome_info)
            logger.error('브라우저 시작 실패: %s', e)
            return False

    def reapply_mobile_viewport(self) -> bool:
        """창 크기 변경·페이지 이동 후 모바일 UI 재적용."""
        if not self.driver:
            return False
        return apply_mobile_viewport(self.driver)

    def stop(self):
        """브라우저 종료"""
        if not self.driver:
            return
        try:
            self.driver.quit()
            logger.info('브라우저가 종료되었습니다.')
        except Exception as e:
            logger.error('브라우저 종료 중 오류: %s', e)
        finally:
            self.driver = None
            self.wait = None

    def is_running(self) -> bool:
        """브라우저 실행 중인지 확인"""
        if self.driver is None:
            return False
        try:
            _ = self.driver.current_url
            return True
        except Exception:
            return False

    def get(self, url: str) -> bool:
        """URL로 이동"""
        if not self.is_running():
            return False
        try:
            self.driver.get(url)
            ensure_soomgo_mobile_layout(self.driver)
            return True
        except Exception as e:
            logger.error('URL 이동 실패: %s', e)
            return False

    def wait_for_element(self, by, value, timeout: int = 10):
        """요소가 나타날 때까지 대기"""
        try:
            wait = WebDriverWait(self.driver, timeout)
            return wait.until(EC.presence_of_element_located((by, value)))
        except Exception:
            return None

    def wait_for_clickable(self, by, value, timeout: int = 10):
        """요소가 클릭 가능할 때까지 대기"""
        try:
            wait = WebDriverWait(self.driver, timeout)
            return wait.until(EC.element_to_be_clickable((by, value)))
        except Exception:
            return None
