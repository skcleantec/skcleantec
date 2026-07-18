"""숨고 로그인 — 이메일 자동 / 카카오(수동·QR) + 세션 재사용"""
from __future__ import annotations

import logging
import time

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException

from automation.selectors import URLS, LOGIN
from automation.navigation import ensure_chat_workspace, is_pro_session_url
from automation.overlay_modals import dismiss_blocking_overlays

logger = logging.getLogger(__name__)

KAKAO_MANUAL_WAIT_SEC = 180.0


def _find_first(driver, selectors_str: str, wait=None):
    for selector in selectors_str.split(', '):
        try:
            if wait:
                elem = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
            else:
                elem = driver.find_element(By.CSS_SELECTOR, selector)
            if elem:
                return elem
        except Exception:
            continue
    return None


def _click_element_containing_text(driver, tag_names: tuple[str, ...], needle: str) -> bool:
    needle_l = needle.lower()
    for tag in tag_names:
        try:
            elems = driver.find_elements(By.CSS_SELECTOR, tag)
        except Exception:
            continue
        for el in elems:
            try:
                text = (el.text or el.get_attribute('aria-label') or '').strip()
                if needle_l in text.lower() and el.is_displayed() and el.is_enabled():
                    el.click()
                    return True
            except Exception:
                continue
    return False


def _bring_window_forward(driver) -> None:
    try:
        driver.switch_to.window(driver.current_window_handle)
        driver.execute_script('window.focus();')
    except Exception:
        pass


def wait_for_manual_login(driver, *, timeout_sec: float = KAKAO_MANUAL_WAIT_SEC) -> bool:
    """상담사 수동 카카오/QR 로그인·점검 모달 닫기 대기."""
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        dismiss_blocking_overlays(driver, 0.35, max_rounds=3)
        if is_logged_in(driver):
            goto_chat_list(driver)
            return True
        time.sleep(1.0)
    return is_logged_in(driver)


def _try_open_kakao_qr(driver, delay: float) -> None:
    """카카오 계정 화면이면 QR 로그인을 우선 연다."""
    try:
        url = (driver.current_url or '').lower()
    except Exception:
        url = ''
    if 'kakao' not in url and 'accounts.kakao' not in url:
        # 리다이렉트 대기
        for _ in range(8):
            time.sleep(0.4)
            try:
                url = (driver.current_url or '').lower()
            except Exception:
                url = ''
            if 'kakao' in url:
                break
    if 'kakao' not in url:
        return
    time.sleep(delay * 0.4)
    if _click_element_containing_text(driver, ('button', 'a', 'label', 'div[role="button"]'), LOGIN['KAKAO_QR_BUTTON_TEXT']):
        logger.info('kakao QR login control clicked')
        time.sleep(delay * 0.5)


def _click_soomgo_kakao_button(driver, delay: float) -> bool:
    btn = _find_first(driver, LOGIN['KAKAO_BUTTON'])
    if btn:
        try:
            btn.click()
            time.sleep(delay)
            return True
        except Exception as e:
            logger.warning('kakao css button click failed: %s', e)
    if _click_element_containing_text(driver, ('button', 'a'), LOGIN['KAKAO_BUTTON_TEXT']):
        time.sleep(delay)
        return True
    return False


def login_via_kakao(driver, delay: float = 1.0, wait_manual_sec: float = KAKAO_MANUAL_WAIT_SEC) -> bool:
    """숨고 → 카카오 시작 → (가능 시) QR → 수동 완료 대기."""
    try:
        if is_logged_in(driver):
            goto_chat_list(driver)
            return True

        driver.get(URLS['LOGIN'])
        time.sleep(delay)
        dismiss_blocking_overlays(driver, delay * 0.6)
        _bring_window_forward(driver)

        if is_logged_in(driver):
            goto_chat_list(driver)
            return True

        clicked = _click_soomgo_kakao_button(driver, delay)
        if not clicked:
            logger.warning('kakao start button not found — waiting for manual login on soomgo page')
        else:
            _try_open_kakao_qr(driver, delay)

        _bring_window_forward(driver)
        ok = wait_for_manual_login(driver, timeout_sec=wait_manual_sec)
        if ok:
            ensure_chat_workspace(driver, delay=delay)
            dismiss_blocking_overlays(driver, delay * 0.5)
        return ok
    except Exception as e:
        logger.error('kakao login error: %s', e)
        return is_pro_session_url(driver.current_url) if driver else False


def login_to_soomgo(driver, email: str, password: str, delay: float = 1.0) -> bool:
    try:
        for attempt in range(2):
            driver.get(URLS['LOGIN'])
            time.sleep(delay)
            dismiss_blocking_overlays(driver, delay * 0.6)

            wait = WebDriverWait(driver, 15)
            email_input = _find_first(driver, LOGIN['EMAIL_INPUT'], wait)
            if not email_input:
                logger.error('email input not found')
                if attempt == 0:
                    dismiss_blocking_overlays(driver, delay)
                    continue
                return False

            dismiss_blocking_overlays(driver, delay * 0.4)
            email_input.clear()
            email_input.send_keys(email)
            time.sleep(delay * 0.5)

            password_input = _find_first(driver, LOGIN['PASSWORD_INPUT'])
            if not password_input:
                logger.error('password input not found')
                return False

            dismiss_blocking_overlays(driver, delay * 0.4)
            password_input.clear()
            password_input.send_keys(password)
            time.sleep(delay * 0.5)

            login_button = _find_first(driver, LOGIN['LOGIN_BUTTON'])
            if not login_button:
                logger.error('login button not found')
                return False

            login_button.click()
            time.sleep(delay * 1.5)
            dismiss_blocking_overlays(driver, delay * 0.6)
            time.sleep(delay)

            ensure_chat_workspace(driver, delay=delay)
            dismiss_blocking_overlays(driver, delay * 0.5)

            if is_pro_session_url(driver.current_url):
                return True

            current_url = driver.current_url.lower()
            if 'login' not in current_url and '/sign' not in current_url and is_pro_session_url(driver.current_url):
                return True

            logger.warning('login attempt %s still on login page, retrying after overlay dismiss', attempt + 1)
            dismiss_blocking_overlays(driver, delay)

        return is_pro_session_url(driver.current_url)
    except TimeoutException:
        return is_pro_session_url(driver.current_url)
    except Exception as e:
        logger.error('login error: %s', e)
        return False


def is_logged_in(driver) -> bool:
    try:
        return is_pro_session_url(driver.current_url)
    except Exception:
        return False


def goto_chat_list(driver, delay: float = 1.0, force_list: bool = False) -> bool:
    return ensure_chat_workspace(driver, delay=delay, force_list=force_list)
