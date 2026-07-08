"""숨고 로그인"""
import logging
import time

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException

from automation.selectors import URLS, LOGIN

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
        driver.get(URLS['LOGIN'])
        time.sleep(delay)
        wait = WebDriverWait(driver, 15)

        email_input = _find_first(driver, LOGIN['EMAIL_INPUT'], wait)
        if not email_input:
            logger.error('email input not found')
            return False

        email_input.clear()
        email_input.send_keys(email)
        time.sleep(delay * 0.5)

        password_input = _find_first(driver, LOGIN['PASSWORD_INPUT'])
        if not password_input:
            logger.error('password input not found')
            return False

        password_input.clear()
        password_input.send_keys(password)
        time.sleep(delay * 0.5)

        login_button = _find_first(driver, LOGIN['LOGIN_BUTTON'])
        if not login_button:
            logger.error('login button not found')
            return False

        login_button.click()
        time.sleep(delay * 2)

        driver.get(URLS['CHAT_LIST'])
        time.sleep(delay * 2)

        current_url = driver.current_url.lower()
        if 'login' in current_url or '/sign' in current_url:
            return False
        return '/pro/chats' in current_url
    except TimeoutException:
        return False
    except Exception as e:
        logger.error('login error: %s', e)
        return False


def is_logged_in(driver) -> bool:
    try:
        current_url = driver.current_url.lower()
        if 'login' in current_url or '/sign' in current_url:
            return False
        return '/pro/chats' in current_url
    except Exception:
        return False


def goto_chat_list(driver, delay: float = 1.0) -> bool:
    try:
        driver.get(URLS['CHAT_LIST'])
        time.sleep(delay * 2)
        return True
    except Exception:
        return False
