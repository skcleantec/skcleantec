"""숨고 로그인 — 이메일 자동 / 카카오(수동·자동·세션 재사용)"""
from __future__ import annotations

import logging
import time

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException

from automation.selectors import URLS, LOGIN
from automation.navigation import ensure_chat_workspace, is_logged_in, is_pro_session_url
from automation.overlay_modals import dismiss_blocking_overlays
from automation.window_layout import apply_mobile_viewport

logger = logging.getLogger(__name__)

KAKAO_MANUAL_WAIT_SEC = 180.0

_SOCIAL_LOGIN_NEEDLES = (
    '네이버',
    '카카오',
    '구글',
    '애플',
    '페이스북',
    'naver',
    'kakao',
    'google',
    'apple',
    'facebook',
)

_FILL_INPUT_JS = """
const el = arguments[0];
const value = String(arguments[1] ?? '');
const proto = el.tagName === 'TEXTAREA'
  ? window.HTMLTextAreaElement.prototype
  : window.HTMLInputElement.prototype;
const desc = Object.getOwnPropertyDescriptor(proto, 'value');
if (desc && desc.set) desc.set.call(el, value);
else el.value = value;
el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
el.dispatchEvent(new Event('change', { bubbles: true }));
return (el.value || '').trim();
"""


def _split_selectors(selectors_str: str) -> list[str]:
    return [part.strip() for part in selectors_str.split(',') if part.strip()]


def _element_label(el) -> str:
    try:
        parts = [
            el.get_attribute('aria-label') or '',
            el.get_attribute('title') or '',
            el.text or '',
            el.get_attribute('value') or '',
        ]
        return ' '.join(parts).strip()
    except Exception:
        return ''


def _is_social_login_control(el) -> bool:
    label = _element_label(el).lower()
    if not label:
        return False
    return any(needle in label for needle in _SOCIAL_LOGIN_NEEDLES)


def _is_interactable(el) -> bool:
    try:
        return bool(el.is_displayed() and el.is_enabled())
    except Exception:
        return False


def _find_first(driver, selectors_str: str, wait=None, *, require_visible: bool = False):
    for selector in _split_selectors(selectors_str):
        try:
            if wait:
                elems = wait.until(
                    EC.presence_of_all_elements_located((By.CSS_SELECTOR, selector))
                )
            else:
                elems = driver.find_elements(By.CSS_SELECTOR, selector)
            for elem in elems or []:
                if require_visible and not _is_interactable(elem):
                    continue
                if _is_social_login_control(elem):
                    continue
                return elem
        except Exception:
            continue
    return None


def _read_input_value(el) -> str:
    try:
        return (el.get_attribute('value') or '').strip()
    except Exception:
        return ''


def _fill_input(driver, el, value: str) -> bool:
    value = (value or '').strip()
    if not value:
        return False
    try:
        driver.execute_script(
            'arguments[0].scrollIntoView({block:"center", inline:"center"}); arguments[0].focus();',
            el,
        )
    except Exception:
        pass
    try:
        el.clear()
    except Exception:
        pass
    try:
        el.send_keys(value)
    except Exception:
        pass
    if _read_input_value(el) == value:
        return True
    try:
        actual = driver.execute_script(_FILL_INPUT_JS, el, value)
        return str(actual or '').strip() == value
    except Exception as e:
        logger.warning('fill input via js failed: %s', e)
        return False


def _find_email_login_button(driver, *, timeout: float = 12.0):
    deadline = time.time() + timeout
    preferred_text = LOGIN.get('EMAIL_LOGIN_BUTTON_TEXT', '이메일 로그인')
    while time.time() < deadline:
        for xpath in (
            f"//button[contains(normalize-space(.), '{preferred_text}')]",
            "//form//button[@type='submit']",
            "//button[@type='submit']",
        ):
            try:
                for el in driver.find_elements(By.XPATH, xpath):
                    if not _is_interactable(el):
                        continue
                    if _is_social_login_control(el):
                        continue
                    label = _element_label(el)
                    if '이메일' in label or preferred_text in label:
                        return el
                    if xpath.startswith('//form'):
                        return el
            except Exception:
                continue

        for el in driver.find_elements(By.CSS_SELECTOR, LOGIN.get('EMAIL_LOGIN_BUTTON', LOGIN['LOGIN_BUTTON'])):
            if not _is_interactable(el):
                continue
            if _is_social_login_control(el):
                continue
            label = _element_label(el)
            if preferred_text in label or '이메일' in label:
                return el

        time.sleep(0.25)
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


def _click_by_xpath_text(driver, *needles: str, exclude_social: bool = True) -> bool:
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
                if exclude_social and _is_social_login_control(el):
                    continue
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
    email = (email or '').strip()
    password = (password or '').strip()
    if not email or not password:
        logger.error('email/password empty — abort before clicking login controls')
        return False

    try:
        apply_mobile_viewport(driver)
        for attempt in range(2):
            driver.get(URLS['LOGIN'])
            time.sleep(delay)
            apply_mobile_viewport(driver)
            dismiss_blocking_overlays(driver, delay * 0.6)

            wait = WebDriverWait(driver, 15)
            email_input = _find_first(driver, LOGIN['EMAIL_INPUT'], wait, require_visible=True)
            if not email_input:
                logger.error('email input not found (attempt %s)', attempt + 1)
                if attempt == 0:
                    dismiss_blocking_overlays(driver, delay)
                    continue
                return False

            dismiss_blocking_overlays(driver, delay * 0.4)
            if not _fill_input(driver, email_input, email):
                logger.error('email input fill failed — value not applied (attempt %s)', attempt + 1)
                if attempt == 0:
                    dismiss_blocking_overlays(driver, delay)
                    continue
                return False
            time.sleep(delay * 0.35)

            password_input = _find_first(driver, LOGIN['PASSWORD_INPUT'], require_visible=True)
            if not password_input:
                logger.error('password input not found (attempt %s)', attempt + 1)
                return False

            dismiss_blocking_overlays(driver, delay * 0.4)
            if not _fill_input(driver, password_input, password):
                logger.error('password input fill failed — value not applied (attempt %s)', attempt + 1)
                if attempt == 0:
                    dismiss_blocking_overlays(driver, delay)
                    continue
                return False
            time.sleep(delay * 0.35)

            login_button = _find_email_login_button(driver, timeout=12.0)
            if not login_button:
                logger.error('email login button not found (attempt %s)', attempt + 1)
                return False

            btn_label = _element_label(login_button) or LOGIN.get('EMAIL_LOGIN_BUTTON_TEXT', '이메일 로그인')
            if _is_social_login_control(login_button):
                logger.error('refusing to click social login control: %s', btn_label)
                return False

            logger.info('clicking email login button: %s', btn_label)
            if not _scroll_and_click(driver, login_button):
                logger.error('email login button click failed')
                return False
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

            if _is_kakao_login_url(current_url) or 'nid.naver.com' in current_url:
                logger.error(
                    'unexpected social oauth redirect after email login click (url=%s) — '
                    'wrong button or empty form',
                    driver.current_url,
                )
                return False

            logger.warning('login attempt %s still on login page, retrying after overlay dismiss', attempt + 1)
            dismiss_blocking_overlays(driver, delay)

        return is_pro_session_url(driver.current_url)
    except TimeoutException:
        return is_pro_session_url(driver.current_url)
    except Exception as e:
        logger.error('login error: %s', e)
        return False


def goto_chat_list(driver, delay: float = 1.0, force_list: bool = False) -> bool:
    return ensure_chat_workspace(driver, delay=delay, force_list=force_list)
