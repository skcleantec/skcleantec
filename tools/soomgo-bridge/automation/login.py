"""숨고 로그인"""
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
