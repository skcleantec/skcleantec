"""
숨고 로그인 처리 모듈
"""
from __future__ import annotations

import logging
import time
from typing import Callable

from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from automation.selectors import LOGIN, URLS
from automation.window_layout import ensure_soomgo_mobile_layout
from automation.overlay_modals import dismiss_blocking_overlays

logger = logging.getLogger(__name__)

LogFn = Callable[[str], None] | None

_NAV_TIMEOUT = 45
_LOGIN_WAIT = 20


def _log_step(log: LogFn, message: str) -> None:
    logger.info(message)
    if log:
        log(message)


def _safe_get(driver, url: str, *, timeout: int = _NAV_TIMEOUT, log: LogFn = None) -> bool:
    _log_step(log, f'페이지 이동: {url}')
    try:
        driver.set_page_load_timeout(timeout)
        driver.get(url)
        return True
    except TimeoutException:
        logger.warning('페이지 로드 시간 초과 (%ss) — 진행 계속: %s', timeout, url)
        try:
            driver.execute_script('window.stop();')
        except WebDriverException:
            pass
        return True
    except WebDriverException as e:
        logger.error('페이지 이동 실패 (%s): %s', url, e)
        return False


def _url_lower(driver) -> str:
    try:
        return (driver.current_url or '').lower()
    except WebDriverException:
        return ''


def _is_login_url(url: str) -> bool:
    return 'login' in url or '/sign' in url


def _is_chat_list_url(url: str) -> bool:
    return '/pro/chats' in url


def _is_authenticated_landing(url: str) -> bool:
    if not url:
        return False
    if _is_chat_list_url(url):
        return True
    if _is_login_url(url):
        return False
    return any(
        token in url
        for token in (
            '/requests/received',
            '/pro/',
            '/dashboard',
            '/mypage',
        )
    )


def _dismiss_login_popups(driver, delay: float) -> int:
    closed = dismiss_blocking_overlays(driver, delay * 0.5, max_rounds=4)
    if closed:
        logger.info('로그인 페이지 방해 팝업 %s개 닫음', closed)
    return closed


def _find_first(driver, selectors_str: str, *, timeout: float = _LOGIN_WAIT):
    selectors = [part.strip() for part in selectors_str.split(',') if part.strip()]
    deadline = time.time() + timeout
    while time.time() < deadline:
        for selector in selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    return elements[0]
            except WebDriverException:
                continue
        time.sleep(0.25)
    return None


def _find_login_button(driver, *, timeout: float = _LOGIN_WAIT):
    button = _find_first(driver, LOGIN['LOGIN_BUTTON'], timeout=max(4.0, timeout * 0.5))
    if button:
        return button
    deadline = time.time() + timeout
    while time.time() < deadline:
        for xpath in (
            "//button[contains(normalize-space(.), '로그인')]",
            "//button[@type='submit']",
            "//form//button",
        ):
            try:
                elements = driver.find_elements(By.XPATH, xpath)
                for element in elements:
                    if element.is_displayed():
                        return element
            except WebDriverException:
                continue
        time.sleep(0.25)
    return None


def _ensure_chat_list(driver, delay: float, *, log: LogFn = None) -> bool:
    url = _url_lower(driver)
    if _is_chat_list_url(url):
        ensure_soomgo_mobile_layout(driver)
        time.sleep(delay * 0.5)
        _dismiss_login_popups(driver, delay)
        _log_step(log, '채팅 목록 확인 완료')
        return True

    if not _safe_get(driver, URLS['CHAT_LIST'], log=log):
        return False

    ensure_soomgo_mobile_layout(driver)
    time.sleep(delay)
    _dismiss_login_popups(driver, delay)

    url = _url_lower(driver)
    if _is_chat_list_url(url):
        _log_step(log, '채팅 목록 진입 완료')
        return True

    if _is_login_url(url):
        logger.error('채팅 목록 이동 실패 — 로그인 페이지로 돌아옴')
        return False

    logger.warning('채팅 목록 URL 불명확: %s', driver.current_url)
    return False


def login_to_soomgo(
    driver,
    email: str,
    password: str,
    delay: float = 1.0,
    *,
    log: LogFn = None,
) -> bool:
    """숨고 로그인 수행"""
    try:
        if not _safe_get(driver, URLS['LOGIN'], log=log):
            return False

        ensure_soomgo_mobile_layout(driver)
        time.sleep(delay)
        _dismiss_login_popups(driver, delay)

        current_url = _url_lower(driver)
        if _is_chat_list_url(current_url) or _is_authenticated_landing(current_url):
            _log_step(log, '이미 로그인된 세션 — 채팅 목록으로 이동')
            return _ensure_chat_list(driver, delay, log=log)

        _log_step(log, '로그인 정보 입력 중…')
        email_input = _find_first(driver, LOGIN['EMAIL_INPUT'], timeout=_LOGIN_WAIT)
        if not email_input:
            _dismiss_login_popups(driver, delay)
            email_input = _find_first(driver, LOGIN['EMAIL_INPUT'], timeout=8)
        if not email_input:
            logger.error('이메일 입력 필드를 찾을 수 없습니다. (현재 URL: %s)', driver.current_url)
            return False

        email_input.clear()
        email_input.send_keys(email)
        time.sleep(delay * 0.5)

        password_input = _find_first(driver, LOGIN['PASSWORD_INPUT'], timeout=8)
        if not password_input:
            logger.error('비밀번호 입력 필드를 찾을 수 없습니다.')
            return False

        password_input.clear()
        password_input.send_keys(password)
        time.sleep(delay * 0.5)

        login_button = _find_login_button(driver, timeout=_LOGIN_WAIT)
        if not login_button:
            logger.error('로그인 버튼을 찾을 수 없습니다.')
            return False

        _log_step(log, '로그인 요청 전송…')
        login_button.click()

        try:
            WebDriverWait(driver, 25).until(
                lambda d: _is_chat_list_url(_url_lower(d))
                or _is_authenticated_landing(_url_lower(d))
            )
        except TimeoutException:
            logger.warning('로그인 후 자동 이동 대기 시간 초과 — 채팅 목록 직접 이동')

        return _ensure_chat_list(driver, delay, log=log)

    except TimeoutException:
        logger.error('로그인 시간 초과')
        return False
    except Exception as e:
        logger.error('로그인 중 오류 발생: %s', e)
        return False


def is_logged_in(driver) -> bool:
    """로그인 상태 확인 (채팅 목록 접근 가능 여부)"""
    try:
        return _is_chat_list_url(_url_lower(driver))
    except Exception:
        return False


def goto_chat_list(driver, delay: float = 1.0) -> bool:
    """채팅 목록 페이지로 이동"""
    try:
        if not _safe_get(driver, URLS['CHAT_LIST']):
            return False
        ensure_soomgo_mobile_layout(driver)
        time.sleep(delay)
        dismiss_blocking_overlays(driver, delay * 0.5, max_rounds=2)
        time.sleep(delay)
        return True
    except Exception as e:
        logger.error('채팅 목록 이동 실패: %s', e)
        return False
