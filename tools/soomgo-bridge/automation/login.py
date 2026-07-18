"""숨고 로그인 — 이메일 자동 / 카카오(수동·자동·세션 재사용)"""
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


def _current_url(driver) -> str:
    try:
        return (driver.current_url or '').lower()
    except Exception:
        return ''


def _is_kakao_login_url(url: str) -> bool:
    return 'kakao.com' in url or 'accounts.kakao' in url


def _is_soomgo_login_url(url: str) -> bool:
    return 'soomgo.com' in url and ('login' in url or '/sign' in url)


def _scroll_and_click(driver, el) -> bool:
    try:
        driver.execute_script(
            'arguments[0].scrollIntoView({block:"center", inline:"center"}); arguments[0].click();',
            el,
        )
        return True
    except Exception:
        try:
            el.click()
            return True
        except Exception:
            return False


def _click_by_xpath_text(driver, *needles: str) -> bool:
    for needle in needles:
        xpath = (
            f"//button[contains(normalize-space(.), '{needle}')] | "
            f"//a[contains(normalize-space(.), '{needle}')] | "
            f"//*[@role='button' and contains(normalize-space(.), '{needle}')]"
        )
        try:
            elems = driver.find_elements(By.XPATH, xpath)
        except Exception:
            continue
        for el in elems:
            try:
                if el.is_displayed() and el.is_enabled() and _scroll_and_click(driver, el):
                    logger.info('clicked xpath text=%s', needle)
                    return True
            except Exception:
                continue
    return False


def _click_kakao_start_via_js(driver) -> bool:
    script = """
    const needles = ['카카오로 시작하기', '카카오로 시작', '카카오'];
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    for (const n of nodes) {
      const text = (n.innerText || n.textContent || n.getAttribute('aria-label') || '').trim();
      if (!text) continue;
      if (needles.some((k) => text.includes(k))) {
        n.scrollIntoView({ block: 'center', inline: 'center' });
        n.click();
        return true;
      }
    }
    return false;
    """
    try:
        return bool(driver.execute_script(script))
    except Exception:
        return False


def _bring_window_forward(driver) -> None:
    try:
        driver.switch_to.window(driver.current_window_handle)
        driver.execute_script('window.focus();')
    except Exception:
        pass


def wait_for_manual_login(driver, *, timeout_sec: float = KAKAO_MANUAL_WAIT_SEC) -> bool:
    """숨고·카카오 로그인 화면에서 상담사 수동 완료 대기 (카카오 버튼·입력은 자동하지 않음)."""
    deadline = time.time() + timeout_sec
    original_handle = None
    try:
        original_handle = driver.current_window_handle
    except Exception:
        pass

    def _check_all_windows() -> bool:
        handles = []
        try:
            handles = list(driver.window_handles)
        except Exception:
            handles = []
        if not handles:
            return is_logged_in(driver)
        for handle in handles:
            try:
                driver.switch_to.window(handle)
                dismiss_blocking_overlays(driver, 0.2, max_rounds=1)
                if is_logged_in(driver):
                    goto_chat_list(driver)
                    return True
            except Exception:
                continue
        if original_handle:
            try:
                driver.switch_to.window(original_handle)
            except Exception:
                pass
        return False

    while time.time() < deadline:
        if _check_all_windows():
            return True
        time.sleep(1.0)
    return _check_all_windows()


def _wait_for_kakao_redirect(driver, delay: float, timeout_sec: float = 12.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        if _is_kakao_login_url(_current_url(driver)):
            return True
        time.sleep(delay * 0.35)
    return _is_kakao_login_url(_current_url(driver))


def _click_soomgo_kakao_button(driver, delay: float) -> bool:
    dismiss_blocking_overlays(driver, delay * 0.4, max_rounds=3)

    btn = _find_first(driver, LOGIN['KAKAO_BUTTON'])
    if btn and _scroll_and_click(driver, btn):
        logger.info('kakao start button clicked (css)')
        time.sleep(delay * 0.8)
        return True

    if _click_by_xpath_text(driver, '카카오로 시작하기', '카카오로 시작', '카카오'):
        time.sleep(delay * 0.8)
        return True

    if _click_kakao_start_via_js(driver):
        logger.info('kakao start button clicked (js)')
        time.sleep(delay * 0.8)
        return True

    return False


def _try_kakao_account_login(driver, login_id: str, password: str, delay: float) -> bool:
    """accounts.kakao.com — 저장된 카카오/숨고 계정으로 자동 로그인 시도."""
    login_id = (login_id or '').strip()
    password = (password or '').strip()
    if not login_id or not password:
        return False
    if not _is_kakao_login_url(_current_url(driver)):
        return False

    dismiss_blocking_overlays(driver, delay * 0.3, max_rounds=2)
    wait = WebDriverWait(driver, 10)
    id_input = _find_first(driver, LOGIN['KAKAO_ID_INPUT'], wait)
    if not id_input:
        logger.warning('kakao loginId input not found')
        return False

    pw_input = _find_first(driver, LOGIN['KAKAO_PASSWORD_INPUT'])
    if not pw_input:
        logger.warning('kakao password input not found')
        return False

    try:
        id_input.clear()
        id_input.send_keys(login_id)
        time.sleep(delay * 0.3)
        pw_input.clear()
        pw_input.send_keys(password)
        time.sleep(delay * 0.3)
    except Exception as e:
        logger.warning('kakao credential fill failed: %s', e)
        return False

    submit = _find_first(driver, LOGIN['KAKAO_SUBMIT_BUTTON'])
    if submit and _scroll_and_click(driver, submit):
        logger.info('kakao submit clicked')
        time.sleep(delay * 1.2)
        return True

    if _click_by_xpath_text(driver, '로그인'):
        time.sleep(delay * 1.2)
        return True

    return False


def open_soomgo_login_and_wait(
    driver,
    *,
    delay: float = 1.0,
    wait_manual_sec: float = KAKAO_MANUAL_WAIT_SEC,
) -> bool:
    """숨고 로그인 페이지만 열고 수동 완료까지 대기."""
    if is_logged_in(driver):
        goto_chat_list(driver)
        return True
    driver.get(URLS['LOGIN'])
    time.sleep(delay)
    dismiss_blocking_overlays(driver, delay * 0.6)
    _bring_window_forward(driver)
    return wait_for_manual_login(driver, timeout_sec=wait_manual_sec)


def login_via_kakao(
    driver,
    delay: float = 1.0,
    wait_manual_sec: float = KAKAO_MANUAL_WAIT_SEC,
    *,
    kakao_id: str = '',
    kakao_password: str = '',
) -> bool:
    """숨고 로그인 화면만 열고 「카카오로 시작하기」·카카오 입력은 사용자가 직접 — 완료까지 대기."""
    _ = kakao_id, kakao_password  # 카카오 모드는 수동 로그인만 (자동 클릭·입력 없음)
    try:
        if is_logged_in(driver):
            goto_chat_list(driver)
            return True

        url = _current_url(driver)
        on_soomgo_login = _is_soomgo_login_url(url) or (
            'soomgo.com' in url and ('login' in url or '/sign' in url)
        )
        if not on_soomgo_login:
            driver.get(URLS['LOGIN'])
            time.sleep(delay)

        dismiss_blocking_overlays(driver, delay * 0.4, max_rounds=2)
        _bring_window_forward(driver)
        logger.info(
            'kakao login: 숨고 로그인 화면 대기 — 「카카오로 시작하기」는 사용자가 직접 눌러 주세요.'
        )

        ok = wait_for_manual_login(driver, timeout_sec=wait_manual_sec)
        if ok:
            ensure_chat_workspace(driver, delay=delay)
            dismiss_blocking_overlays(driver, delay * 0.5)
        return ok
    except Exception as e:
        logger.error('kakao login error: %s', e)
        return is_logged_in(driver)


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
