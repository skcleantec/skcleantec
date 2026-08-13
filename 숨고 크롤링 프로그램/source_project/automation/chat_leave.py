"""채팅방 나가기 UI 조작 공통 모듈"""

import logging
import time
from typing import Callable, Optional

from selenium.webdriver.common.by import By

logger = logging.getLogger(__name__)


class ChatLeaveHelper:
    """채팅방 ⋮ 메뉴 → 채팅방 나가기 → 확인 공통 처리"""

    def __init__(
        self,
        driver,
        delay: float = 1.5,
        log: Optional[Callable[[str], None]] = None,
    ):
        self.driver = driver
        self.delay = delay
        self._log = log or (lambda msg: logger.info(msg))

    def click_more_menu(self) -> bool:
        try:
            clicked = self.driver.execute_script("""
                var selectors = [
                    'button.dropdown-toggle',
                    'button[aria-haspopup="true"]',
                    'button[aria-haspopup="menu"]',
                    'header button',
                    '[class*="chat"] button'
                ];
                for (var s = 0; s < selectors.length; s++) {
                    var buttons = document.querySelectorAll(selectors[s]);
                    for (var i = 0; i < buttons.length; i++) {
                        var btn = buttons[i];
                        var rect = btn.getBoundingClientRect();
                        if (rect.width < 5 || rect.height < 5) continue;
                        if (rect.top < 120 && rect.right > window.innerWidth * 0.55) {
                            btn.click();
                            return true;
                        }
                    }
                }
                var allButtons = document.querySelectorAll('button');
                for (var j = 0; j < allButtons.length; j++) {
                    var b = allButtons[j];
                    var r = b.getBoundingClientRect();
                    if (r.top < 80 && r.right > window.innerWidth * 0.7 && r.width < 60) {
                        b.click();
                        return true;
                    }
                }
                return false;
            """)
            if clicked:
                self._log('더보기 메뉴 버튼 클릭 완료')
                return True

            for selector in (
                'button.dropdown-toggle',
                "button[aria-haspopup='true']",
                "button[aria-haspopup='menu']",
            ):
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed():
                        elem.click()
                        self._log(f'더보기 메뉴 버튼 클릭: {selector}')
                        return True
            return False
        except Exception as e:
            logger.error('더보기 메뉴 클릭 오류: %s', e)
            return False

    def click_leave_menu(self) -> bool:
        try:
            clicked = self.driver.execute_script("""
                var menuItems = document.querySelectorAll(
                    'a.dropdown-item, button.dropdown-item, [role="menuitem"], li button, li a'
                );
                for (var i = menuItems.length - 1; i >= 0; i--) {
                    var text = (menuItems[i].textContent || '').trim();
                    if (text.includes('채팅방 나가기')) {
                        menuItems[i].click();
                        return true;
                    }
                }
                return false;
            """)
            if clicked:
                self._log("'채팅방 나가기' 메뉴 클릭 완료")
                return True

            for item in self.driver.find_elements(
                By.CSS_SELECTOR, 'a.dropdown-item, button.dropdown-item'
            ):
                if '채팅방 나가기' in (item.text or ''):
                    item.click()
                    self._log("'채팅방 나가기' 메뉴 클릭 완료 (CSS)")
                    return True
            return False
        except Exception as e:
            logger.error('나가기 메뉴 클릭 오류: %s', e)
            return False

    def confirm_leave(self) -> bool:
        try:
            clicked = self.driver.execute_script("""
                var buttons = document.querySelectorAll(
                    'button, .modal button, [role="dialog"] button'
                );
                for (var i = 0; i < buttons.length; i++) {
                    var text = (buttons[i].textContent || '').trim();
                    if ((text === '채팅방 나가기' || text.includes('나가기')) && !text.includes('취소')) {
                        buttons[i].click();
                        return true;
                    }
                }
                return false;
            """)
            if clicked:
                self._log('나가기 확인 버튼 클릭 완료')
                return True

            for btn in self.driver.find_elements(By.CSS_SELECTOR, 'button'):
                if btn.is_displayed() and '채팅방 나가기' in (btn.text or ''):
                    btn.click()
                    self._log('나가기 확인 버튼 클릭 완료 (대기 후)')
                    return True
            return False
        except Exception as e:
            logger.error('확인 버튼 클릭 오류: %s', e)
            return False

    def leave_chat_room(self) -> bool:
        try:
            if not self.click_more_menu():
                self._log('더보기 메뉴 버튼을 찾을 수 없습니다.')
                return False
            time.sleep(self.delay * 0.5)
            if not self.click_leave_menu():
                self._log("'채팅방 나가기' 메뉴를 찾을 수 없습니다.")
                return False
            time.sleep(self.delay * 0.5)
            if not self.confirm_leave():
                self._log('나가기 확인 버튼을 찾을 수 없습니다.')
                return False
            time.sleep(self.delay)
            return True
        except Exception as e:
            logger.error('채팅방 나가기 오류: %s', e)
            return False
