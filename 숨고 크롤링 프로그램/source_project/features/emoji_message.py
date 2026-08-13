"""
기능 2: 이모지 메시지 기능 (레거시 단독 실행용)
"""
import logging
import time
from typing import Callable, List, Optional

from automation.chat_list import ChatListManager
from automation.chat_room import ChatRoomManager
from automation.selectors import URLS

logger = logging.getLogger(__name__)


class EmojiMessageFeature:
    """이모지 메시지 기능 클래스"""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay
        self.chat_list = ChatListManager(driver, delay)
        self.chat_room = ChatRoomManager(driver, delay)
        self.running = False
        self.log_callback: Optional[Callable[[str], None]] = None

    def set_log_callback(self, callback: Callable[[str], None]):
        self.log_callback = callback

    def log(self, message: str):
        logger.info(message)
        if self.log_callback:
            self.log_callback(message)

    def stop(self):
        self.running = False
        self.log('이모지 메시지 기능 중지 요청됨')

    def run(
        self,
        emoji: str,
        images: List[str] = None,
        text1: str = '',
        text2: str = '',
        max_count: int = 100,
    ) -> int:
        self.running = True
        processed_count = 0
        scroll_count = 0
        max_scrolls = 50
        images = images or []

        self.log(f"이모지 메시지 기능 시작 - 이모지: '{emoji}'")

        try:
            self.driver.get(URLS['CHAT_LIST'])
            time.sleep(self.delay * 2)
            self.chat_list.clear_processed()

            while self.running and processed_count < max_count and scroll_count < max_scrolls:
                chat_items = self.chat_list.get_chat_items()
                if not chat_items:
                    self.log('채팅방을 찾을 수 없습니다.')
                    break

                found_new = False
                for item in chat_items:
                    if not self.running:
                        break

                    chat_id = item.get('chat_id')
                    text = item.get('text', '')
                    if self.chat_list.is_processed(chat_id):
                        continue
                    if self.chat_list.is_yesterday_message(text):
                        self.log('어제 메시지 발견 - 최상단으로 이동')
                        self.chat_list.scroll_to_top()
                        scroll_count = 0
                        time.sleep(self.delay)
                        break
                    if emoji not in text:
                        continue

                    found_new = True
                    self.log(f'이모지 발견: 채팅방 {chat_id}')
                    if self.chat_list.click_chat_item(item):
                        time.sleep(self.delay)
                        success = True
                        if images:
                            success = self.chat_room.upload_images(images)
                        if text1 and success:
                            success = self.chat_room.send_message(text1)
                        if text2 and success:
                            success = self.chat_room.send_message(text2)
                        if success:
                            self.chat_room.toggle_favorite()
                            time.sleep(self.delay * 0.3)
                            self.log(f'처리 완료: 채팅방 {chat_id}')
                            processed_count += 1
                        self.chat_room.go_back()
                        time.sleep(self.delay)
                    self.chat_list.mark_as_processed(chat_id)

                if not found_new:
                    self.chat_list.scroll_down(400)
                    scroll_count += 1
                    time.sleep(self.delay * 0.5)

            self.log(f'이모지 메시지 기능 완료 - 처리한 채팅방: {processed_count}개')
            return processed_count
        except Exception as e:
            self.log(f'이모지 메시지 기능 오류: {e}')
            logger.exception('이모지 메시지 기능 상세 오류')
            return processed_count
        finally:
            self.running = False
