"""
기능: 나간 채팅방 삭제
"""
import logging
import time
from typing import Callable, Optional

from automation.chat_leave import ChatLeaveHelper
from automation.chat_list import ChatListManager
from automation.chat_room import ChatRoomManager
from automation.selectors import URLS

logger = logging.getLogger(__name__)

DEFAULT_LEFT_CHAT_TEXT = '상대방이 채팅방을 나갔습니다'


class DeleteLeftChatsFeature:
    """나간 채팅방 삭제 기능 클래스"""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay
        self.chat_list = ChatListManager(driver, delay)
        self.chat_room = ChatRoomManager(driver, delay)
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
        self.log('나간 채팅방 삭제 기능 중지 요청됨')

    def _scroll_and_wait_for_load(self, max_scroll_attempts: int = 10) -> bool:
        before_count = self.chat_list.get_chat_count()
        for attempt in range(max_scroll_attempts):
            if not self.running:
                return False
            self.chat_list.scroll_down(500)
            time.sleep(0.3)
            after_count = self.chat_list.get_chat_count()
            if after_count > before_count:
                self.log(f'[스크롤] 로딩 감지! {before_count}→{after_count}개 ({attempt + 1}회 스크롤)')
                return True
        return False

    def run(self, detection_text: str = DEFAULT_LEFT_CHAT_TEXT) -> int:
        self.running = True
        deleted_count = 0
        scroll_count = 0
        max_scrolls = 100

        try:
            self.log(f"나간 채팅방 삭제 시작 (감지 텍스트: '{detection_text}')")
            self.log('채팅 목록 페이지로 이동 중...')
            self.driver.get(URLS['CHAT_LIST'])
            time.sleep(self.delay * 2)
            self.log('채팅 목록 페이지 로드 완료')
            self.chat_list.clear_processed()

            while self.running and scroll_count < max_scrolls:
                self.log('채팅방 목록 가져오는 중...')
                chat_items = self.chat_list.get_chat_items()
                self.log(f'채팅방 {len(chat_items)}개 발견')

                if not chat_items:
                    self.log('채팅방을 찾을 수 없습니다.')
                    break

                found_new = False
                for item in chat_items:
                    if not self.running:
                        break

                    chat_id = item.get('chat_id')
                    last_message = item.get('last_message', '')
                    text = item.get('text', '')
                    nickname = item.get('nickname', 'Unknown')

                    if self.chat_list.is_processed(chat_id):
                        continue

                    if detection_text not in last_message and detection_text not in text:
                        continue

                    found_new = True
                    self.log(f'나간 채팅방 발견: {nickname} (ID: {chat_id})')
                    self.log(f'삭제 시도: {nickname} (ID: {chat_id})')

                    if self.chat_list.click_chat_item(item):
                        time.sleep(self.delay)
                        if self.chat_leave.leave_chat_room():
                            deleted_count += 1
                            self.log(f'삭제 완료: {nickname} ({deleted_count}개)')
                        else:
                            self.log(f'삭제 실패: {nickname}')
                        self.chat_room.go_back()
                        time.sleep(self.delay)

                    self.chat_list.mark_as_processed(chat_id)

                if not found_new:
                    self.log('감지 텍스트 없음, 스크롤 시도...')
                    if self._scroll_and_wait_for_load():
                        scroll_count += 1
                    else:
                        self.log('더 이상 로드할 채팅방이 없습니다.')
                        break

            self.log(f'나간 채팅방 삭제 완료 - 삭제된 채팅방: {deleted_count}개')
            return deleted_count

        except Exception as e:
            self.log(f'나간 채팅방 삭제 오류: {e}')
            logger.exception('나간 채팅방 삭제 상세 오류')
            return deleted_count
        finally:
            self.running = False
