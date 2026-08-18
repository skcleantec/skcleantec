"""
숨고 로그인 처리 모듈
"""
import logging
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from automation.selectors import URLS, LOGIN
from automation.window_layout import ensure_soomgo_mobile_layout
from automation.overlay_modals import dismiss_blocking_overlays

logger = logging.getLogger(__name__)


def _dismiss_login_popups(driver, delay: float) -> int:
    """로그인 페이지 시스템 점검·공지 팝업 닫기."""
    closed = dismiss_blocking_overlays(driver, delay * 0.5, max_rounds=4)
    if closed:
        logger.info('로그인 페이지 방해 팝업 %s개 닫음', closed)
    return closed


def _find_first(driver, selectors_str: str, wait=None):
    """쉼표로 구분된 CSS 셀렉터 중 첫 번째 매칭 요소 반환"""
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
    """숨고 로그인 수행"""
    try:
        driver.get(URLS['LOGIN'])
        ensure_soomgo_mobile_layout(driver)
        time.sleep(delay)
        _dismiss_login_popups(driver, delay)
        wait = WebDriverWait(driver, 15)

        email_input = _find_first(driver, LOGIN['EMAIL_INPUT'], wait)
        if not email_input:
            _dismiss_login_popups(driver, delay)
            email_input = _find_first(driver, LOGIN['EMAIL_INPUT'], wait)
        if not email_input:
            logger.error('이메일 입력 필드를 찾을 수 없습니다.')
            return False

        email_input.clear()
        email_input.send_keys(email)
        time.sleep(delay * 0.5)

        password_input = _find_first(driver, LOGIN['PASSWORD_INPUT'])
        if not password_input:
            logger.error('비밀번호 입력 필드를 찾을 수 없습니다.')
            return False

        password_input.clear()
        password_input.send_keys(password)
        time.sleep(delay * 0.5)

        login_button = _find_first(driver, LOGIN['LOGIN_BUTTON'])
        if not login_button:
            logger.error('로그인 버튼을 찾을 수 없습니다.')
            return False

        login_button.click()
        time.sleep(delay * 2)

        driver.get(URLS['CHAT_LIST'])
        ensure_soomgo_mobile_layout(driver)
        time.sleep(delay)
        _dismiss_login_popups(driver, delay)
        time.sleep(delay)

        current_url = driver.current_url.lower()
        if 'login' in current_url or '/sign' in current_url:
            logger.error('로그인 실패: 여전히 로그인 페이지에 있습니다.')
            return False

        if '/pro/chats' in current_url:
            logger.info('로그인 성공!')
            return True

        logger.warning(f'로그인 상태 불명확: {driver.current_url}')
        return False

    except TimeoutException:
        logger.error('로그인 시간 초과')
        return False
    except Exception as e:
        logger.error(f'로그인 중 오류 발생: {e}')
        return False


def is_logged_in(driver) -> bool:
    """로그인 상태 확인 (채팅 목록 접근 가능 여부)"""
    try:
        current_url = driver.current_url.lower()
        if 'login' in current_url or '/sign' in current_url:
            return False
        return '/pro/chats' in current_url
    except Exception:
        return False


def goto_chat_list(driver, delay: float = 1.0) -> bool:
    """채팅 목록 페이지로 이동"""
    try:
        driver.get(URLS['CHAT_LIST'])
        ensure_soomgo_mobile_layout(driver)
        time.sleep(delay)
        dismiss_blocking_overlays(driver, delay * 0.5, max_rounds=2)
        time.sleep(delay)
        return True
    except Exception as e:
        logger.error(f'채팅 목록 이동 실패: {e}')
        return False
