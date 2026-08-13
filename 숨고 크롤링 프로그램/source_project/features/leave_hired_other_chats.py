"""
기능: 다른 고수를 고용함 배지가 있는 채팅방 일괄 나가기
"""
import logging
import time
from typing import Callable, Dict, List, Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from automation.chat_leave import ChatLeaveHelper
from automation.chat_list import ChatListManager
from automation.selectors import SYSTEM_MESSAGES, URLS

logger = logging.getLogger(__name__)

DEFAULT_MAX_SCROLLS = 100


def normalize_leave_hired_other_settings(settings: dict) -> tuple[str, int]:
    detection_text = (
        settings.get('detection_text') or SYSTEM_MESSAGES['HIRED_OTHER']
    ).strip() or SYSTEM_MESSAGES['HIRED_OTHER']
    max_scrolls = settings.get('max_scrolls', DEFAULT_MAX_SCROLLS)
    try:
        max_scrolls = int(max_scrolls)
    except (TypeError, ValueError):
        max_scrolls = DEFAULT_MAX_SCROLLS
    if max_scrolls < 1:
        max_scrolls = DEFAULT_MAX_SCROLLS
    return detection_text, max_scrolls


class LeaveHiredOtherChatsFeature:
    """다른 고수 고용 배지 채팅방 나가기"""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay
        self.chat_list = ChatListManager(driver, delay)
        self.chat_leave = ChatLeaveHelper(driver, delay)
        self.running = False
        self.log_callback: Optional[Callable[[str], None]] = None

    def set_log_callback(self, callback: Callable[[str], None]):
        self.log_callback = callback
        self.chat_leave._log = callback

    def log(self, message: str):
        logger.info(message)
        if self.log_callback:
            self.log_callback(message)

    def stop(self):
        self.running = False
        self.log('다른 고수 고용 방 나가기 중지 요청됨')

    def _scroll_and_wait_for_load(self, max_scroll_attempts: int = 10) -> bool:
        before_count = self.chat_list.get_chat_count()
        for _ in range(max_scroll_attempts):
            if not self.running:
                return False
            self.chat_list.scroll_down(500)
            time.sleep(0.3)
            after_count = self.chat_list.get_chat_count()
            if after_count > before_count:
                self.log(f'[스크롤] 로딩 감지! {before_count}→{after_count}개')
                return True
        return False

    def _safe_navigate_to_chat(self, chat_url: str, max_retries: int = 3) -> bool:
        for attempt in range(max_retries):
            try:
                self.driver.set_page_load_timeout(60)
                self.driver.get(chat_url)
                WebDriverWait(self.driver, 15).until(
                    lambda d: d.execute_script('return document.readyState') == 'complete'
                )
                time.sleep(self.delay)
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, "textarea, [role='textbox'], .chat-messages, header")
                    )
                )
                return True
            except Exception as e:
                self.log(
                    f'[채팅방 이동] 실패 ({attempt + 1}/{max_retries}): {type(e).__name__}'
                )
                if attempt < max_retries - 1:
                    time.sleep(2)
        return False

    def _return_to_chat_list(self) -> bool:
        try:
            self.driver.get(URLS['CHAT_LIST'])
            time.sleep(self.delay * 1.5)
            return True
        except Exception as e:
            self.log(f'[목록 복귀] 실패: {type(e).__name__}')
            return False

    def _matches_detection(self, item: dict, detection_text: str) -> bool:
        """채팅 목록 행(text)에 배지/시스템 문구가 있는지 확인"""
        row_text = item.get('text', '') or ''
        return bool(row_text) and detection_text in row_text

    def _collect_matching_chats(
        self, detection_text: str, max_scrolls: int
    ) -> List[Dict]:
        matching: List[Dict] = []
        checked_ids = set()
        seen_match_ids = set()
        scroll_count = 0

        try:
            self.chat_list.scroll_to_top()
            time.sleep(self.delay)
        except Exception as e:
            self.log(f'[수집] 초기화 중 오류: {type(e).__name__}')

        self.log(f"[1단계] '{detection_text}' 배지 채팅방 수집 시작")

        while self.running and scroll_count <= max_scrolls:
            chat_items = self.chat_list.get_chat_items(exclude_ids=checked_ids)
            if not chat_items:
                if checked_ids and self.chat_list.get_chat_count() > 0:
                    if self._scroll_and_wait_for_load():
                        scroll_count += 1
                        continue
                break

            found_on_screen = False
            for item in chat_items:
                if not self.running:
                    break

                chat_id = item.get('chat_id')
                if not chat_id:
                    continue
                checked_ids.add(chat_id)

                if not self._matches_detection(item, detection_text):
                    continue

                if chat_id in seen_match_ids:
                    continue

                seen_match_ids.add(chat_id)
                found_on_screen = True
                nickname = item.get('nickname', '') or f'ID:{chat_id}'
                matching.append({
                    'chat_id': chat_id,
                    'nickname': nickname,
                    'display_name': nickname,
                    'row_text': item.get('text', ''),
                })
                self.log(f"  → 목록 배지 감지: {nickname} (ID: {chat_id})")

            if not found_on_screen:
                if not self._scroll_and_wait_for_load():
                    break
                scroll_count += 1
            elif self._scroll_and_wait_for_load():
                scroll_count += 1
            else:
                break

        self.log(f'[1단계 완료] {len(matching)}개 채팅방 수집됨')
        return matching

    def _process_leaves(self, matching_chats: List[Dict]) -> int:
        if not matching_chats:
            self.log('[2단계] 나갈 채팅방 없음')
            return 0

        self.log(f'[2단계] {len(matching_chats)}개 채팅방 나가기 시작')
        left_count = 0

        for idx, chat_info in enumerate(matching_chats, 1):
            if not self.running:
                break

            chat_id = chat_info['chat_id']
            display_name = chat_info['display_name']
            self.log(f'[{idx}/{len(matching_chats)}] {display_name} 나가기 시도...')

            chat_url = f'https://soomgo.com/pro/chats/{chat_id}'
            if not self._safe_navigate_to_chat(chat_url):
                self.log(f'  → 채팅방 이동 실패: {display_name}')
                self._return_to_chat_list()
                continue

            time.sleep(self.delay * 0.5)
            if self.chat_leave.leave_chat_room():
                left_count += 1
                self.log(f'  → 나가기 완료: {display_name} ({left_count}개)')
            else:
                self.log(f'  → 나가기 실패: {display_name}')

            self._return_to_chat_list()

        self.log(f'[2단계 완료] {left_count}/{len(matching_chats)}개 나가기 완료')
        return left_count

    def run(self, settings: Optional[dict] = None, detection_text: Optional[str] = None) -> int:
        if settings is None:
            settings = {}
        if detection_text:
            settings = {**settings, 'detection_text': detection_text}

        detection_text, max_scrolls = normalize_leave_hired_other_settings(settings)
        self.running = True
        left_count = 0

        try:
            self.log(f"다른 고수 고용 방 나가기 시작 (감지: '{detection_text}')")
            self.driver.get(URLS['CHAT_LIST'])
            time.sleep(self.delay * 2)

            matching_chats = self._collect_matching_chats(detection_text, max_scrolls)
            if not self.running:
                if matching_chats:
                    self.log(f'[중지] 수집된 {len(matching_chats)}개 채팅방 처리 진행')
                    left_count = self._process_leaves(matching_chats)
                return left_count

            left_count = self._process_leaves(matching_chats)
            self.log(f'다른 고수 고용 방 나가기 완료 - {left_count}개')
            return left_count
        except Exception as e:
            self.log(f'다른 고수 고용 방 나가기 오류: {e}')
            logger.exception('다른 고수 고용 방 나가기 상세 오류')
            return left_count
        finally:
            self.running = False
