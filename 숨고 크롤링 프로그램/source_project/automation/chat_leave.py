"""채팅방 나가기 UI 조작 공통 모듈"""



import logging

import time

from typing import Callable, Optional



from selenium.webdriver.common.by import By



logger = logging.getLogger(__name__)



_JS_CLICK_CONFIRM_LEAVE = """

return (function() {

  function visible(el) {

    if (!el || !el.getBoundingClientRect) return false;

    var rect = el.getBoundingClientRect();

    if (rect.width < 2 || rect.height < 2) return false;

    var st = window.getComputedStyle(el);

    return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') >= 0.05;

  }

  function isCancel(text) {

    if (!text) return true;

    return text.indexOf('취소') >= 0 || text.indexOf('닫기') >= 0;

  }

  function isConfirmLeave(text) {

    if (!text || isCancel(text)) return false;

    if (text === '나가기' || text === '채팅방 나가기') return true;

    return text.indexOf('나가기') >= 0 && text.indexOf('채팅방') >= 0;

  }

  function scoreButton(btn, rootHasPrompt) {

    var text = (btn.textContent || '').replace(/\\s+/g, ' ').trim();

    if (!isConfirmLeave(text)) return -1;

    var score = 10;

    if (text === '나가기') score += 20;

    if (rootHasPrompt) score += 30;

    var cls = (btn.className || '') + ' ' + (btn.getAttribute('class') || '');

    if (/primary|danger|confirm|submit/i.test(cls)) score += 15;

    return score;

  }

  function tryClickInRoot(root) {

    if (!root) return false;

    var rootText = (root.textContent || '');

    var hasPrompt = rootText.indexOf('나갈') >= 0 || rootText.indexOf('나가시') >= 0;

    var buttons = root.querySelectorAll('button, a.btn, [role="button"]');

    var best = null;

    var bestScore = -1;

    for (var i = 0; i < buttons.length; i++) {

      var btn = buttons[i];

      if (!visible(btn)) continue;

      if (btn.closest('.dropdown-menu')) continue;

      var score = scoreButton(btn, hasPrompt);

      if (score > bestScore) {

        bestScore = score;

        best = btn;

      }

    }

    if (best && bestScore >= 0) {

      best.click();

      return true;

    }

    return false;

  }

  var dialogSelectors = [

    '[role="dialog"]',

    '.modal.show',

    '.modal-dialog',

    '[class*="Modal"]',

    '[class*="modal"]'

  ];

  for (var s = 0; s < dialogSelectors.length; s++) {

    var nodes = document.querySelectorAll(dialogSelectors[s]);

    for (var n = 0; n < nodes.length; n++) {

      if (tryClickInRoot(nodes[n])) return true;

    }

  }

  return tryClickInRoot(document.body);

})();

"""





class ChatLeaveHelper:

    """채팅방 ⋮ 메뉴 → 채팅방 나가기 → 확인 공통 처리"""



    CONFIRM_POLL_INTERVAL = 0.05

    CONFIRM_TIMEOUT = 4.0



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

                    'button[aria-label*="더보기"]',

                    'button[aria-label*="메뉴"]',

                    'button.dropdown-toggle',

                    'button[aria-haspopup="true"]',

                    'button[aria-haspopup="menu"]',

                    'header button',

                    '[class*="chat"] button'

                ];

                function visible(el) {

                    if (!el) return false;

                    var rect = el.getBoundingClientRect();

                    return rect.width >= 5 && rect.height >= 5;

                }

                function tryClick(btn) {

                    if (!visible(btn)) return false;

                    btn.click();

                    return true;

                }

                for (var s = 0; s < selectors.length; s++) {

                    var buttons = document.querySelectorAll(selectors[s]);

                    for (var i = 0; i < buttons.length; i++) {

                        var btn = buttons[i];

                        var rect = btn.getBoundingClientRect();

                        if (rect.width < 5 || rect.height < 5) continue;

                        if (rect.top < 140 && rect.right > window.innerWidth * 0.5) {

                            if (tryClick(btn)) return true;

                        }

                    }

                }

                var allButtons = document.querySelectorAll('header button, button');

                for (var j = 0; j < allButtons.length; j++) {

                    var b = allButtons[j];

                    var r = b.getBoundingClientRect();

                    if (r.top < 100 && r.right > window.innerWidth * 0.65 && r.width < 72) {

                        if (tryClick(b)) return true;

                    }

                }

                return false;

            """)

            if clicked:

                self._log('더보기 메뉴 버튼 클릭 완료')

                return True



            for selector in (

                'button[aria-label*="더보기"]',

                'button[aria-label*="메뉴"]',

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

            time.sleep(min(0.12, self.delay * 0.08))

            clicked = self.driver.execute_script("""

                var menuItems = document.querySelectorAll(

                    '.dropdown-menu.show a, .dropdown-menu.show button, ' +

                    'a.dropdown-item, button.dropdown-item, [role="menuitem"]'

                );

                for (var i = menuItems.length - 1; i >= 0; i--) {

                    var el = menuItems[i];

                    var rect = el.getBoundingClientRect();

                    if (rect.width < 2 || rect.height < 2) continue;

                    var text = (el.textContent || '').trim();

                    if (text.indexOf('채팅방 나가기') >= 0 || text === '나가기') {

                        el.click();

                        return true;

                    }

                }

                return false;

            """)

            if clicked:

                self._log("'채팅방 나가기' 메뉴 클릭 완료")

                return True



            for item in self.driver.find_elements(

                By.CSS_SELECTOR,

                '.dropdown-menu.show a, .dropdown-menu.show button, a.dropdown-item, button.dropdown-item',

            ):

                label = (item.text or '').strip()

                if '채팅방 나가기' in label or label == '나가기':

                    item.click()

                    self._log("'채팅방 나가기' 메뉴 클릭 완료 (CSS)")

                    return True

            return False

        except Exception as e:

            logger.error('나가기 메뉴 클릭 오류: %s', e)

            return False



    def confirm_leave(self, *, timeout: Optional[float] = None) -> bool:

        """확인 팝업이 뜨는 즉시 '나가기' 버튼 클릭 (50ms 폴링)."""

        wait_sec = self.CONFIRM_TIMEOUT if timeout is None else timeout

        deadline = time.time() + wait_sec

        poll = self.CONFIRM_POLL_INTERVAL

        last_error: Optional[Exception] = None



        while time.time() < deadline:

            try:

                clicked = self.driver.execute_script(_JS_CLICK_CONFIRM_LEAVE)

                if clicked:

                    self._log('나가기 확인 버튼 클릭 완료')

                    return True

            except Exception as e:

                last_error = e



            try:

                for btn in self.driver.find_elements(

                    By.CSS_SELECTOR,

                    '[role="dialog"] button, .modal.show button, .modal-dialog button',

                ):

                    if not btn.is_displayed():

                        continue

                    label = (btn.text or '').strip()

                    if '취소' in label or '닫기' in label:

                        continue

                    if label == '나가기' or '채팅방 나가기' in label:

                        btn.click()

                        self._log('나가기 확인 버튼 클릭 완료 (Selenium)')

                        return True

            except Exception as e:

                last_error = e



            time.sleep(poll)



        if last_error:

            logger.debug('confirm_leave 마지막 오류: %s', last_error)

        return False



    def leave_chat_room(self) -> bool:

        try:

            if not self.click_more_menu():

                self._log('더보기 메뉴 버튼을 찾을 수 없습니다.')

                return False

            time.sleep(min(0.2, self.delay * 0.12))

            if not self.click_leave_menu():

                self._log("'채팅방 나가기' 메뉴를 찾을 수 없습니다.")

                return False

            if not self.confirm_leave():

                self._log('나가기 확인 버튼을 찾을 수 없습니다.')

                return False

            time.sleep(min(0.35, self.delay * 0.2))

            return True

        except Exception as e:

            logger.error('채팅방 나가기 오류: %s', e)

            return False


