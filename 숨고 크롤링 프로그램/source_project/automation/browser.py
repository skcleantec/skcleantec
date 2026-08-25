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
_CHROME_VERSION_RE = re.compile(r'(\d+\.\d+\.\d+\.\d+)')
_chrome_version_cache: tuple[int, str] | None | bool = False
_resolved_driver_path_cache: str | None = None
_resolved_driver_path_cache_key: tuple[int | None, bool] | None = None


def _get_app_base_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


def _selenium_cache_dir() -> Path:
    """chromedriver 캐시 — 한글 경로 EXE 옆 대신 ASCII AppData 사용 (Windows cp949/subprocess 이슈 회피)"""
    env = os.environ.get('SE_CACHE_PATH', '').strip()
    if env:
        return Path(env)
    if getattr(sys, 'frozen', False):
        try:
            from desktop.config import APP_DATA_DIR, ensure_app_data

            ensure_app_data()
            cache_dir = APP_DATA_DIR / 'selenium_cache'
            cache_dir.mkdir(parents=True, exist_ok=True)
            return cache_dir
        except Exception:
            pass
    return Path.home() / '.cache' / 'selenium'


def _configure_selenium_env() -> None:
    """EXE 실행 시 selenium-manager와 캐시 경로를 AppData(ASCII)로 고정"""
    if not getattr(sys, 'frozen', False):
        return

    base = _get_app_base_dir()
    manager = (
        base / '_internal' / 'selenium' / 'webdriver' / 'common' / 'windows' / 'selenium-manager.exe'
    )
    if manager.is_file():
        os.environ['SE_MANAGER_PATH'] = str(manager)

    cache_dir = _selenium_cache_dir()
    os.environ['SE_CACHE_PATH'] = str(cache_dir)


def _run_hidden(cmd: list[str], *, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
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


def _parse_chrome_version_text(text: str) -> tuple[int, str] | None:
    match = _CHROME_VERSION_RE.search(text or '')
    if not match:
        return None
    version = match.group(1)
    return int(version.split('.', 1)[0]), version


def _read_chrome_version_from_registry() -> tuple[int, str] | None:
    if sys.platform != 'win32':
        return None
    try:
        import winreg

        for hive, subkey in (
            (winreg.HKEY_CURRENT_USER, r'Software\Google\Chrome\BLBeacon'),
            (winreg.HKEY_LOCAL_MACHINE, r'Software\Google\Chrome\BLBeacon'),
        ):
            try:
                with winreg.OpenKey(hive, subkey) as key:
                    version, _ = winreg.QueryValueEx(key, 'version')
                    parsed = _parse_chrome_version_text(str(version))
                    if parsed:
                        return parsed
            except OSError:
                continue
    except Exception as e:
        logger.warning('Chrome registry version read failed: %s', e)
    return None


def _read_chrome_version_from_install_dir() -> tuple[int, str] | None:
    binary = _find_chrome_binary()
    if not binary:
        return None
    best: tuple[int, str] | None = None
    try:
        for child in binary.parent.iterdir():
            if not child.is_dir():
                continue
            parsed = _parse_chrome_version_text(child.name)
            if parsed and (best is None or parsed[1] > best[1]):
                best = parsed
    except Exception as e:
        logger.warning('Chrome install dir version read failed: %s', e)
    return best


def _read_chrome_version_from_pe() -> tuple[int, str] | None:
    """chrome.exe ProductVersion — 프로세스 실행 없이 PE 메타데이터만 읽음"""
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
        return _parse_chrome_version_text((proc.stdout or '').strip())
    except Exception as e:
        logger.warning('Chrome ProductVersion 확인 실패: %s', e)
    return None


def _read_chrome_version() -> tuple[int, str] | None:
    """Chrome 버전 — chrome.exe 실행 금지 (Windows에서 일반 프로필 창이 뜨는 원인)"""
    global _chrome_version_cache
    if _chrome_version_cache is not False:
        return _chrome_version_cache

    for reader in (
        _read_chrome_version_from_registry,
        _read_chrome_version_from_install_dir,
        _read_chrome_version_from_pe,
    ):
        parsed = reader()
        if parsed:
            _chrome_version_cache = parsed
            logger.info('installed chrome: %s', parsed[1])
            return parsed

    _chrome_version_cache = None
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
        logger.warning(
            'chromedriver major 확인 불가 — selenium-manager 결과 신뢰 (%s)',
            driver_path,
        )
        return True
    return driver_major == chrome_major


def _chrome_user_data_dir() -> Path:
    """자동화 전용 Chrome 프로필 — 기본 프로필 세션 복원으로 창이 여러 개 뜨는 것 방지"""
    try:
        from desktop.config import APP_DATA_DIR, ensure_app_data

        ensure_app_data()
        profile = APP_DATA_DIR / 'chrome_profile'
    except Exception:
        profile = Path.home() / '.cache' / 'cbiseo_soomgo' / 'chrome_profile'
    profile.mkdir(parents=True, exist_ok=True)
    return profile


def _kill_process_tree(pid: int | None) -> None:
    if pid is None or pid <= 0:
        return
    if sys.platform != 'win32':
        return
    try:
        _run_hidden(['taskkill', '/F', '/T', '/PID', str(pid)], timeout=15)
    except Exception as e:
        logger.warning('process tree kill failed (pid=%s): %s', pid, e)


def _force_cleanup_chrome_launch(service: Service | None, driver: ChromeWebDriver | None = None) -> None:
    if driver is not None:
        try:
            driver.quit()
        except Exception as e:
            logger.warning('driver.quit during cleanup failed: %s', e)
    _safe_stop_service(service)
    if service is not None and getattr(service, 'process', None) is not None:
        _kill_process_tree(service.process.pid)


def _close_extra_browser_windows(driver: ChromeWebDriver) -> None:
    try:
        handles = list(driver.window_handles)
        if len(handles) <= 1:
            return
        primary = handles[0]
        for handle in handles[1:]:
            driver.switch_to.window(handle)
            driver.close()
        driver.switch_to.window(primary)
        logger.info('여분 Chrome 창 %s개 닫음', len(handles) - 1)
    except Exception as e:
        logger.warning('여분 Chrome 창 정리 실패: %s', e)


def _safe_stop_service(service: Service | None) -> None:
    if service is None:
        return
    try:
        service.stop()
    except Exception as e:
        logger.warning('chromedriver service stop failed: %s', e)


def _selenium_cache_roots() -> list[Path]:
    roots: list[Path] = []
    seen: set[str] = set()
    for candidate in (
        _selenium_cache_dir(),
        Path.home() / '.cache' / 'selenium',
        _get_app_base_dir() / 'selenium_cache',
    ):
        key = str(candidate.resolve()) if candidate.exists() else str(candidate)
        if key in seen:
            continue
        seen.add(key)
        roots.append(candidate)
    return roots


def _purge_selenium_driver_cache() -> None:
    """chromedriver 캐시·메타데이터(se-metadata.json) 전체 삭제"""
    global _resolved_driver_path_cache, _resolved_driver_path_cache_key
    _resolved_driver_path_cache = None
    _resolved_driver_path_cache_key = None

    for root in _selenium_cache_roots():
        if not root.exists():
            continue
        try:
            shutil.rmtree(root, ignore_errors=True)
            logger.info('selenium cache removed: %s', root)
        except Exception as e:
            logger.warning('selenium cache purge failed (%s): %s', root, e)

    manager = _selenium_manager_path()
    if manager:
        for root in _selenium_cache_roots():
            try:
                root.mkdir(parents=True, exist_ok=True)
                _run_hidden(
                    [
                        str(manager),
                        '--browser',
                        'chrome',
                        '--clear-cache',
                        '--cache-path',
                        str(root),
                    ],
                    timeout=60,
                )
            except Exception as e:
                logger.warning('selenium-manager --clear-cache failed (%s): %s', root, e)


def _cached_driver_major_mismatch(chrome_major: int) -> bool:
    for root in _selenium_cache_roots():
        metadata = root / 'se-metadata.json'
        if not metadata.is_file():
            continue
        try:
            payload = json.loads(metadata.read_text(encoding='utf-8'))
        except Exception:
            continue
        for entry in payload.get('drivers') or []:
            cached_major = str(entry.get('major_browser_version') or '').strip()
            if cached_major.isdigit() and int(cached_major) != chrome_major:
                logger.info(
                    'cached chromedriver major=%s, installed Chrome major=%s',
                    cached_major,
                    chrome_major,
                )
                return True
    return False


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


_last_selenium_manager_error: str | None = None


def _invoke_selenium_manager(
    *,
    refresh_cache: bool = False,
    chrome_binary: Path | None = None,
    chrome_major: int | None = None,
    chrome_version: str | None = None,
) -> Optional[str]:
    global _last_selenium_manager_error
    _last_selenium_manager_error = None

    manager = _selenium_manager_path()
    if not manager:
        logger.error('selenium-manager.exe를 찾을 수 없습니다.')
        return None

    cache_dir = _selenium_cache_dir()
    cache_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        str(manager),
        '--browser',
        'chrome',
        '--language-binding',
        'python',
        '--output',
        'json',
        '--cache-path',
        str(cache_dir),
    ]
    if chrome_version:
        cmd.extend(['--browser-version', str(chrome_major if chrome_major is not None else chrome_version.split('.', 1)[0])])
    elif chrome_major is not None:
        cmd.extend(['--browser-version', str(chrome_major)])
    elif chrome_binary and chrome_binary.is_file():
        cmd.extend(['--browser-path', str(chrome_binary)])
    if refresh_cache:
        cmd.append('--clear-cache')

    try:
        result = _run_hidden(cmd, timeout=120)
        if result.returncode != 0:
            stderr = (result.stderr or result.stdout or '').strip()
            _last_selenium_manager_error = stderr or f'exit code {result.returncode}'
            logger.error('selenium-manager 실패 (code=%s): %s', result.returncode, stderr)
            return None

        stdout = (result.stdout or '').strip()
        if not stdout:
            _last_selenium_manager_error = 'selenium-manager 출력 없음'
            logger.error('selenium-manager 출력이 비어 있습니다.')
            return None

        payload = json.loads(stdout)
        result_code = payload.get('result', {}).get('code')
        result_msg = payload.get('result', {}).get('message', '')
        if result_code not in (None, 0):
            _last_selenium_manager_error = result_msg or f'selenium-manager code {result_code}'
            logger.error('selenium-manager result error: %s', _last_selenium_manager_error)
            return None

        driver_path = payload.get('result', {}).get('driver_path')
        if driver_path and Path(driver_path).is_file():
            return driver_path

        _last_selenium_manager_error = result_msg or 'chromedriver 경로 없음'
        logger.error('selenium-manager가 chromedriver 경로를 반환하지 않았습니다: %s', driver_path)
    except subprocess.TimeoutExpired:
        _last_selenium_manager_error = 'selenium-manager 시간 초과'
        logger.error('selenium-manager 실행 시간 초과 (120초)')
    except Exception as e:
        _last_selenium_manager_error = str(e)
        logger.error('chromedriver 경로 확인 실패: %s', e)

    return None


def _resolve_chromedriver_path(*, refresh_cache: bool = False) -> Optional[str]:
    """chromedriver.exe 경로 확인 (EXE 옆 → selenium-manager 순)"""
    global _resolved_driver_path_cache, _resolved_driver_path_cache_key

    chrome_binary = _find_chrome_binary()
    chrome_info = _read_chrome_version()
    chrome_major = chrome_info[0] if chrome_info else None
    chrome_version = chrome_info[1] if chrome_info else None

    cache_key = (chrome_major, refresh_cache)
    if (
        not refresh_cache
        and _resolved_driver_path_cache
        and _resolved_driver_path_cache_key == cache_key
        and Path(_resolved_driver_path_cache).is_file()
        and _driver_matches_chrome(_resolved_driver_path_cache, chrome_major)
    ):
        return _resolved_driver_path_cache

    if refresh_cache:
        _purge_selenium_driver_cache()
    elif chrome_major is not None and _cached_driver_major_mismatch(chrome_major):
        logger.info('Chrome 업데이트 감지 — chromedriver 캐시 자동 정리')
        _purge_selenium_driver_cache()
        refresh_cache = True

    base = _get_app_base_dir()
    if not getattr(sys, 'frozen', False):
        for candidate in (base / 'chromedriver.exe', base / 'chromedriver' / 'chromedriver.exe'):
            if not candidate.is_file():
                continue
            path = str(candidate)
            if _driver_matches_chrome(path, chrome_major):
                _resolved_driver_path_cache = path
                _resolved_driver_path_cache_key = cache_key
                return path
            logger.warning(
                'chromedriver.exe 버전 불일치 — selenium-manager 사용 (Chrome major=%s)',
                chrome_major,
            )

    driver_path = _invoke_selenium_manager(
        refresh_cache=refresh_cache,
        chrome_binary=chrome_binary,
        chrome_major=chrome_major,
        chrome_version=chrome_version,
    )
    if (
        driver_path
        and chrome_major is not None
        and not _driver_matches_chrome(driver_path, chrome_major)
    ):
        logger.warning('selenium-manager chromedriver major 불일치 — 캐시 재정리 후 재시도')
        _purge_selenium_driver_cache()
        driver_path = _invoke_selenium_manager(
            refresh_cache=True,
            chrome_binary=chrome_binary,
            chrome_major=chrome_major,
            chrome_version=chrome_version,
        )

    if driver_path:
        _resolved_driver_path_cache = driver_path
        _resolved_driver_path_cache_key = (chrome_major, refresh_cache)
    return driver_path


def _is_chromedriver_version_mismatch(error: Exception) -> bool:
    msg = str(error).lower()
    return (
        'session not created' in msg
        and (
            'only supports chrome version' in msg
            or 'this version of chromedriver' in msg
            or 'chrome version' in msg
        )
    )


def _launch_chrome_driver(
    options: Options,
    driver_path: str,
    *,
    launch_state: dict | None = None,
) -> ChromeWebDriver:
    service = Service(driver_path)
    if launch_state is not None:
        launch_state['service'] = service
        launch_state['driver'] = None

    driver: ChromeWebDriver | None = None
    try:
        logger.info('chromedriver 사용: %s', driver_path)
        driver = ChromeWebDriver(service=service, options=options)
        if launch_state is not None:
            launch_state['driver'] = driver
        _close_extra_browser_windows(driver)
        return driver
    except Exception:
        _force_cleanup_chrome_launch(service, driver)
        raise


def _create_chrome_driver(options: Options, *, launch_state: dict | None = None) -> ChromeWebDriver:
    chrome_binary = _find_chrome_binary()
    if chrome_binary:
        options.binary_location = str(chrome_binary)

    driver_path = _resolve_chromedriver_path(refresh_cache=False)
    if not driver_path:
        detail = _last_selenium_manager_error or ''
        raise RuntimeError(
            'chromedriver를 다운로드하지 못했습니다. '
            '인터넷 연결과 Chrome 설치를 확인하세요.'
            + (f'\n({detail})' if detail else '')
        )

    try:
        return _launch_chrome_driver(options, driver_path, launch_state=launch_state)
    except Exception as first_error:
        logger.error('chromedriver launch failed: %s', first_error)
        if not _is_chromedriver_version_mismatch(first_error):
            raise

        logger.info('chromedriver/Chrome 버전 불일치 — 캐시 삭제 후 1회 재시도')
        _purge_selenium_driver_cache()
        driver_path = _resolve_chromedriver_path(refresh_cache=True)
        if not driver_path:
            raise first_error
        return _launch_chrome_driver(options, driver_path, launch_state=launch_state)


_configure_selenium_env()


def format_browser_start_error(error: Exception | None, chrome_info: tuple[int, str] | None = None) -> str:
    if error is None:
        return 'Chrome 브라우저를 시작할 수 없습니다.'
    msg = str(error).strip() or error.__class__.__name__
    lowered = msg.lower()
    chrome_hint = f' (설치된 Chrome: {chrome_info[1]})' if chrome_info else ''
    cache_hint = _selenium_cache_dir()

    if 'session not created' in lowered or 'only supports chrome version' in lowered or 'this version of chromedriver' in lowered:
        return (
            'Chrome과 chromedriver 버전이 맞지 않습니다.'
            f'{chrome_hint}\n\n'
            '다른 PC에서 복사한 selenium_cache가 남아 있으면 이런 오류가 납니다.\n'
            f'1. 프로그램을 종료한 뒤 폴더 "{cache_hint}" 를 삭제\n'
            '2. EXE 옆 chromedriver.exe 가 있으면 삭제\n'
            '3. Chrome을 한 번 완전히 종료한 뒤 프로그램을 다시 실행\n'
            '(v1.0.27부터는 자동으로 캐시를 정리합니다.)'
        )
    if 'chromedriver를 다운로드하지 못했습니다' in msg:
        return (
            'chromedriver를 받지 못했습니다.'
            f'{chrome_hint}\n\n'
            f'캐시 경로: {cache_hint}\n'
            '프로그램 폴더 이름에 한글이 있으면 chromedriver 다운로드가 실패할 수 있습니다.\n'
            'v1.0.28부터는 캐시를 AppData(Cbiseo\\SoomgoAutomation)에 저장합니다.\n'
            '그래도 안 되면 Chrome을 완전히 종료한 뒤 다시 실행하세요.'
            + (f'\n\n상세: {msg.split(chr(10), 1)[-1]}' if '\n' in msg else '')
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
            options.add_argument('--no-first-run')
            options.add_argument('--no-default-browser-check')
            options.add_argument('--disable-background-networking')
            profile_dir = _chrome_user_data_dir()
            options.add_argument(f'--user-data-dir={profile_dir}')
            options.add_argument('--profile-directory=Default')
            options.add_argument('--disable-restore-session-state')
            options.add_argument('--disable-session-crashed-bubble')
            options.add_argument('--hide-crash-restore-bubble')
            options.page_load_strategy = 'eager'

            driver_path = _resolve_chromedriver_path(refresh_cache=False)
            if not driver_path:
                detail = _last_selenium_manager_error or ''
                self.last_start_error = format_browser_start_error(
                    RuntimeError(
                        'chromedriver를 다운로드하지 못했습니다. '
                        '인터넷 연결과 Chrome 설치를 확인하세요.'
                        + (f'\n({detail})' if detail else '')
                    ),
                    chrome_info,
                )
                logger.error('chromedriver 경로 확인 실패')
                return False

            driver_holder: dict = {'driver': None, 'error': None, 'service': None}

            def _start_worker():
                try:
                    driver_holder['driver'] = _launch_chrome_driver(
                        options,
                        driver_path,
                        launch_state=driver_holder,
                    )
                except Exception as e:
                    driver_holder['error'] = e

            worker = threading.Thread(target=_start_worker, daemon=True)
            worker.start()
            worker.join(timeout=_CHROME_START_TIMEOUT)

            if worker.is_alive():
                _force_cleanup_chrome_launch(
                    driver_holder.get('service'),
                    driver_holder.get('driver'),
                )
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

            _close_extra_browser_windows(self.driver)
            try:
                self.driver.set_page_load_timeout(45)
                self.driver.set_script_timeout(30)
            except Exception as e:
                logger.warning('driver timeout 설정 실패: %s', e)
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
