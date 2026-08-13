"""
채팅방 내 동작 모듈
- 메시지 전송
- 이미지 업로드
- 즐겨찾기 추가
- 뒤로가기
"""
import logging
import os
import re
import time
from typing import List, Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

from automation.selectors import URLS

logger = logging.getLogger(__name__)

_INPUT_JS = """
const elem = arguments[0];
const message = arguments[1];
if (elem.tagName.toLowerCase() === 'textarea' || elem.tagName.toLowerCase() === 'input') {
    elem.value = message;
} else if (elem.hasAttribute('contenteditable')) {
    elem.textContent = message;
}
elem.dispatchEvent(new Event('input', { bubbles: true }));
elem.dispatchEvent(new Event('change', { bubbles: true }));
"""

_FAVORITE_JS = """
var container = document.querySelector('.quick-btn-container.right-align');
if (!container) return { status: 'error', message: 'container not found' };
var buttons = container.querySelectorAll('button');
for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    var svg = btn.querySelector('svg');
    if (!svg) continue;
    var path = svg.querySelector('path');
    if (!path) continue;
    var d = path.getAttribute('d') || '';
    if (d.includes('5.21522') || d.includes('8.72728') || d.includes('M9.52438')) {
        var svgClass = svg.className.baseVal || '';
        var isFavorited = svgClass.includes('purple');
        if (isFavorited) return { status: 'already_favorited', svgClass: svgClass };
        btn.click();
        return { status: 'clicked', svgClass: svgClass };
    }
}
var allSvgs = document.querySelectorAll('svg.prisma-icon');
for (var j = 0; j < allSvgs.length; j++) {
    var svg = allSvgs[j];
    var path = svg.querySelector('path');
    if (!path) continue;
    var d = path.getAttribute('d') || '';
    if (d.includes('5.21522') || d.includes('8.72728') || d.includes('M9.52438')) {
        var svgClass = svg.className.baseVal || '';
        if (svgClass.includes('purple')) return { status: 'already_favorited', svgClass: svgClass };
        var btn = svg.closest('button');
        if (btn) { btn.click(); return { status: 'clicked', svgClass: svgClass }; }
    }
}
return { status: 'not_found', message: 'heart button not found' };
"""


class ChatRoomManager:
    """채팅방 내 동작 관리 클래스"""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay

    def send_message(self, message: str) -> bool:
        """메시지 전송"""
        try:
            logger.info(f'[메시지 전송] 현재 URL: {self.driver.current_url}')
            input_selectors = [
                'textarea',
                "[contenteditable='true']",
                "input[placeholder*='메시지']",
                '.message-input textarea',
                "div[role='textbox']",
            ]
            input_elem = None
            for selector in input_selectors:
                try:
                    for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                        if elem.is_displayed() and input_elem is None:
                            input_elem = elem
                            logger.info(f'[메시지 전송] 입력 필드 발견: {selector}')
                    if input_elem:
                        break
                except Exception as e:
                    logger.debug(f"[메시지 전송] 셀렉터 '{selector}' 검색 실패: {e}")

            if not input_elem:
                logger.error('[메시지 전송 실패] 입력 필드를 찾을 수 없습니다.')
                return False

            input_elem.click()
            time.sleep(self.delay * 0.3)
            try:
                input_elem.clear()
            except Exception:
                pass
            self.driver.execute_script(_INPUT_JS, input_elem, message)
            logger.info(f'[메시지 전송] 메시지 입력 완료: {message[:30]}...')
            time.sleep(self.delay * 0.5)

            send_selectors = [
                '.btn-submit',
                'img.btn-submit',
                "button[type='submit']",
                "[class*='send']",
            ]
            send_btn = None
            for selector in send_selectors:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed() and send_btn is None:
                        send_btn = elem
                if send_btn:
                    break

            if send_btn:
                send_btn.click()
                logger.info('[메시지 전송] 전송 버튼 클릭 완료')
            else:
                logger.warning('[메시지 전송] 전송 버튼 못찾음, Enter 키로 전송 시도')
                input_elem.send_keys(Keys.RETURN)

            time.sleep(self.delay)
            logger.info(f'[메시지 전송] 완료: {message[:30]}...')
            return True
        except Exception as e:
            logger.error(f'[메시지 전송 실패] 예외 발생: {type(e).__name__}: {e}')
            return False

    def upload_images(self, image_paths: List[str]) -> bool:
        """이미지 업로드"""
        try:
            logger.info(f'[이미지 업로드] 시작: {len(image_paths)}개 파일')
            valid_paths = [
                os.path.abspath(path)
                for path in image_paths
                if path and os.path.exists(path)
            ]
            if not valid_paths:
                logger.error('[이미지 업로드 실패] 업로드할 유효한 이미지가 없습니다.')
                return False

            file_input_selectors = [
                "input[type='file']",
                'input.file-input-hidden',
                "input[accept*='image']",
            ]
            file_input = None
            for selector in file_input_selectors:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    file_input = elements[0]
                    break

            if not file_input:
                attach_selectors = [
                    "img[alt*='파일 첨부']",
                    "button[aria-label*='파일']",
                    "[class*='attach']",
                ]
                for selector in attach_selectors:
                    try:
                        elem = self.driver.find_element(By.CSS_SELECTOR, selector)
                        elem.click()
                        time.sleep(self.delay * 0.5)
                        break
                    except Exception:
                        continue
                for selector in file_input_selectors:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        file_input = elements[0]
                        break

            if not file_input:
                logger.error('[이미지 업로드 실패] 파일 입력 필드를 찾을 수 없습니다.')
                return False

            file_input.send_keys('\n'.join(valid_paths))
            time.sleep(self.delay * 2)
            logger.info(f'[이미지 업로드] 완료: {len(valid_paths)}개')
            return True
        except Exception as e:
            logger.error(f'[이미지 업로드 실패] 예외 발생: {type(e).__name__}: {e}')
            return False

    def toggle_favorite(self) -> bool:
        """즐겨찾기 추가 (이미 즐겨찾기된 경우 스킵)"""
        try:
            result = self.driver.execute_script(_FAVORITE_JS)
            if not result:
                logger.warning('[즐겨찾기] JavaScript 실행 결과 없음')
                return False

            status = result.get('status', 'unknown')
            if status == 'already_favorited':
                logger.info(f"[즐겨찾기] 이미 즐겨찾기됨 (스킵): {result.get('svgClass')}")
                return True
            if status == 'clicked':
                logger.info(f"[즐겨찾기] 버튼 클릭 완료: {result.get('svgClass')}")
                time.sleep(self.delay * 0.5)
                return True
            if status == 'not_found':
                logger.warning(f"[즐겨찾기] 버튼을 찾을 수 없음: {result.get('message')}")
                return False

            logger.warning(f'[즐겨찾기] 예상치 못한 상태: {result}')
            return False
        except Exception as e:
            logger.error(f'[즐겨찾기 실패] 예외 발생: {type(e).__name__}: {e}')
            return False

    def go_back(self) -> bool:
        """채팅 목록으로 돌아가기"""
        try:
            back_selectors = [
                "button[aria-label*='뒤로']",
                "a[href='/pro/chats']",
                "[class*='back'] button",
            ]
            back_btn = None
            for selector in back_selectors:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed():
                        back_btn = elem
                        break
                if back_btn:
                    break

            if back_btn:
                back_btn.click()
            else:
                self.driver.get(URLS['CHAT_LIST'])

            time.sleep(self.delay)
            logger.info('채팅 목록으로 돌아가기 완료')
            return True
        except Exception as e:
            logger.error(f'뒤로가기 오류: {e}')
            try:
                self.driver.get(URLS['CHAT_LIST'])
                time.sleep(self.delay)
                return True
            except Exception:
                return False

    def is_in_chat_room(self) -> bool:
        try:
            current_url = self.driver.current_url
            return '/pro/chats/' in current_url or 'from=chatroom' in current_url
        except Exception:
            return False

    def get_current_chat_id(self) -> Optional[str]:
        try:
            match = re.search(r'/pro/chats/(\d+)', self.driver.current_url)
            return match.group(1) if match else None
        except Exception:
            return None

    def get_my_sent_messages(self) -> List[str]:
        """채팅방 내 내가 보낸 메시지 텍스트 목록 반환"""
        try:
            result = self.driver.execute_script("""
                var allLi = document.querySelectorAll('li');
                var myMessages = [];
                for (var i = 0; i < allLi.length; i++) {
                    var li = allLi[i];
                    var style = window.getComputedStyle(li);
                    if (style.textAlign === 'right') {
                        var text = (li.textContent || '')
                            .replace(/오전|오후|안읽음/g, '').trim();
                        if (text.length > 0) myMessages.push(text.substring(0, 100));
                    }
                }
                return myMessages;
            """)
            messages = result if result else []
            logger.info(f'[채팅방] 내가 보낸 메시지 {len(messages)}개 확인')
            return messages
        except Exception as e:
            logger.error(f'[채팅방] 메시지 조회 오류: {e}')
            return []
