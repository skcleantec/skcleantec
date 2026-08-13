"""
기능 2+3 통합: 이모지/견적조회 통합 기능
- 당일 무한 반복 모드
- 닉네임 기반 처리 기록 추적 (자정 자동 리셋)
- 이미지 폴더별 순차 전송 (images/1 → images/2 → images/3)
"""
import logging
import os
import sys
import time
from datetime import datetime
from typing import Callable, Dict, List, Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from urllib3.exceptions import ReadTimeoutError, MaxRetryError, ProtocolError, NewConnectionError

from automation.chat_list import ChatListManager
from automation.chat_room import ChatRoomManager
from automation.processed_tracker import ProcessedTracker
from automation.selectors import URLS, SYSTEM_MESSAGES

logger = logging.getLogger(__name__)


def get_base_path():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class CombinedFeature:
    """이모지/견적조회 통합 기능 클래스 (무한 반복 모드)"""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay
        self.chat_list = ChatListManager(driver, delay)
        self.chat_room = ChatRoomManager(driver, delay)
        self.tracker = ProcessedTracker()
        self.running = False
        self.test_mode = False
        self.log_callback: Optional[Callable[[str], None]] = None
        self.stats_callback: Optional[Callable[[dict], None]] = None
        self.start_time = None
        self.images_folder = os.path.join(get_base_path(), 'images')

    def _get_numeric_folders(self) -> List[int]:
        if not os.path.exists(self.images_folder):
            return []
        folders = []
        for name in os.listdir(self.images_folder):
            folder_path = os.path.join(self.images_folder, name)
            if os.path.isdir(folder_path) and name.isdigit():
                folders.append(int(name))
        return sorted(folders)

    def _get_folder_images(self, folder_num: int) -> List[str]:
        folder_path = os.path.join(self.images_folder, str(folder_num))
        if not os.path.exists(folder_path):
            return []
        images = []
        for f in sorted(os.listdir(folder_path)):
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                images.append(os.path.join(folder_path, f))
        return images

    def set_log_callback(self, callback: Callable[[str], None]):
        self.log_callback = callback

    def set_stats_callback(self, callback: Callable[[dict], None]):
        self.stats_callback = callback

    def log(self, message: str, gui: bool = True):
        logger.info(message)
        if gui and self.log_callback:
            self.log_callback(message)

    def _update_stats(self):
        if self.stats_callback:
            stats = self.tracker.get_stats()
            stats['start_time'] = self.start_time.strftime('%H:%M:%S') if self.start_time else ''
            self.stats_callback(stats)

    def stop(self):
        self.running = False
        self.log('통합 기능 중지 요청됨')

    def clear_processed(self):
        self.tracker.clear()
        self.log('처리 기록 초기화 완료')
        self._update_stats()

    def get_stats(self) -> dict:
        return self.tracker.get_stats()

    def _wait_for_chat_list_ready(self, timeout: int = 15) -> bool:
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: d.execute_script('return document.readyState') == 'complete'
            )
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'ul.css-19wxjby > li, main ul > li'))
            )
            time.sleep(0.5)
            return self.chat_list.get_chat_count() > 0
        except TimeoutException:
            self.log(f'[페이지 로드] {timeout}초 타임아웃 - 채팅방 요소 없음')
            return False
        except Exception as e:
            self.log(f'[페이지 로드] 오류: {type(e).__name__}')
            return False

    def _safe_navigate(self, url: str, max_retries: int = 3) -> bool:
        for attempt in range(max_retries):
            try:
                start_time = time.time()
                self.log(f'[페이지 이동] 시도 {attempt + 1}/{max_retries}...', gui=False)
                self.driver.set_page_load_timeout(60)
                self.driver.get(url)
                if '/pro/chats' in url:
                    if self._wait_for_chat_list_ready():
                        self.log(f'[페이지 이동] 성공 ({time.time() - start_time:.1f}초 소요)', gui=False)
                        return True
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    return False
                self.log(f'[페이지 이동] 성공 ({time.time() - start_time:.1f}초 소요)', gui=False)
                return True
            except (TimeoutException, ReadTimeoutError, MaxRetryError, ProtocolError, NewConnectionError, WebDriverException) as e:
                self.log(f'[페이지 이동] 실패: {type(e).__name__}: {str(e)[:100]}')
                if attempt < max_retries - 1:
                    time.sleep(2)
            except Exception as e:
                self.log(f'[페이지 이동] 예외: {type(e).__name__}')
                if attempt < max_retries - 1:
                    time.sleep(2)
        return False

    def _scroll_and_wait_for_load(self, max_scroll_attempts: int = 10) -> bool:
        before_ids = self.chat_list.get_visible_chat_ids()
        for attempt in range(max_scroll_attempts):
            if not self.running:
                return False
            self.chat_list.scroll_down(500)
            time.sleep(0.3)
            after_ids = self.chat_list.get_visible_chat_ids()
            if after_ids - before_ids:
                self.log(f'[스크롤] 로딩 감지! 새 {len(after_ids - before_ids)}개 ({attempt + 1}회 스크롤)', gui=False)
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
                        (By.CSS_SELECTOR, "textarea, [role='textbox'], .chat-messages")
                    )
                )
                return True
            except Exception as e:
                self.log(f'[채팅방 이동] 실패 ({attempt + 1}/{max_retries}): {type(e).__name__}', gui=False)
                if attempt < max_retries - 1:
                    time.sleep(2)
        return False

    def _send_folder_images(self, folder_num: int) -> bool:
        images = self._get_folder_images(folder_num)
        if not images:
            return True
        if not self.chat_room.upload_images(images):
            self.log(f'이미지 폴더{folder_num} 업로드 실패')
            return False
        time.sleep(self.delay)
        return True

    def _process_chat_content(self, texts: Dict[str, str], send_order: List[str]) -> bool:
        try:
            success = True
            for item_name in send_order:
                if not success and not self.test_mode:
                    break

                if item_name.startswith('이미지폴더'):
                    try:
                        folder_num = int(item_name.replace('이미지폴더', ''))
                    except ValueError:
                        self.log(f'잘못된 이미지 폴더 이름: {item_name}')
                        continue
                    imgs = self._get_folder_images(folder_num)
                    if self.test_mode:
                        self.log(f'[테스트] {item_name} 전송 예정: {len(imgs)}장')
                    elif imgs and not self._send_folder_images(folder_num):
                        success = False
                    continue

                if not item_name.startswith('텍스트'):
                    continue

                text_content = texts.get(item_name, '').strip()
                if not text_content:
                    continue

                if self.test_mode:
                    preview = text_content[:30] + '...' if len(text_content) > 30 else text_content
                    self.log(f'[테스트] {item_name} 전송 예정: "{preview}"')
                    continue

                if not self.chat_room.send_message(text_content):
                    self.log(f'{item_name} 전송 실패')
                    success = False
                time.sleep(1)

            if self.test_mode:
                self.log('[테스트] 즐겨찾기 추가 예정')
                return success

            if success:
                self.chat_room.toggle_favorite()
                time.sleep(self.delay * 0.3)
            return success
        except Exception as e:
            self.log(f'채팅방 처리 오류: {e}')
            return False

    def _collect_matching_chats(
        self,
        emoji: str,
        emoji_enabled: bool,
        quote_enabled: bool,
        max_count: int,
        quote_system_message: str,
    ) -> List[Dict]:
        matching_chats = []
        checked_count = 0
        previous_chat_ids = set()
        checked_chat_ids = set()

        self.chat_list.scroll_to_top()
        time.sleep(self.delay)
        self.log(f'[1단계] 매칭 채팅방 수집 시작 (상위 {max_count}개 스캔)')

        while self.running and checked_count < max_count:
            chat_items = self.chat_list.get_chat_items()
            if not chat_items:
                debug_info = getattr(self.chat_list, 'last_extraction_debug', '')
                current_url = ''
                try:
                    current_url = self.driver.current_url
                except Exception:
                    pass
                chat_count = self.chat_list.get_chat_count()
                detail = f' (URL: {current_url}, li={chat_count}'
                if debug_info:
                    detail += f', {debug_info}'
                detail += ')'
                self.log('[스캔] 채팅방을 찾을 수 없음 - DOM 추출 실패' + detail)
                break

            current_chat_ids = {item.get('chat_id') for item in chat_items if item.get('chat_id')}
            new_chat_ids = current_chat_ids - previous_chat_ids

            if not new_chat_ids and previous_chat_ids:
                if not self._scroll_and_wait_for_load():
                    break
                previous_chat_ids.update(current_chat_ids)
                continue

            if new_chat_ids:
                self.log(f'[스캔] 채팅방 {len(chat_items)}개 로드됨, 확인: {len(new_chat_ids)}개', gui=False)

            for item in chat_items:
                if not self.running or checked_count >= max_count:
                    break

                chat_id = item.get('chat_id')
                if not chat_id or chat_id in checked_chat_ids:
                    continue

                checked_chat_ids.add(chat_id)
                checked_count += 1

                nickname = item.get('nickname', '')
                text = item.get('text', '')
                display_name = nickname or chat_id

                if nickname and self.tracker.is_processed(nickname):
                    logger.debug(f'[스킵] 이미 처리됨: {display_name}')
                    continue

                text_preview = (text[:50] + '...' if len(text) > 50 else text).replace('\n', ' ')
                has_emoji = emoji_enabled and emoji and emoji in text
                has_quote = (
                    quote_enabled
                    and quote_system_message
                    and quote_system_message in text
                )

                if has_quote and item.get('is_favorite', False):
                    self.log(f'  → 견적조회 스킵 (즐겨찾기 완료): {display_name}', gui=False)
                    has_quote = False

                self.log(
                    f'[{checked_count}/{max_count}] {display_name} | 이모지:{has_emoji} 견적:{has_quote} | {text_preview}',
                    gui=False,
                )

                if has_emoji:
                    matching_chats.append({
                        'chat_id': chat_id,
                        'nickname': nickname,
                        'match_type': 'emoji',
                        'display_name': display_name,
                    })
                    self.log(f'  → 이모지 매칭! 수집됨: {display_name}')
                    continue

                if has_quote:
                    matching_chats.append({
                        'chat_id': chat_id,
                        'nickname': nickname,
                        'match_type': 'quote',
                        'display_name': display_name,
                    })
                    self.log(f'  → 견적조회 매칭! 수집됨: {display_name}')

            previous_chat_ids.update(current_chat_ids)
            if checked_count < max_count:
                self._scroll_and_wait_for_load()

        self.log(f'[1단계 완료] {checked_count}개 스캔, {len(matching_chats)}개 매칭됨')
        return matching_chats

    def _process_collected_chats(
        self,
        matching_chats: List[Dict],
        emoji_texts: Dict[str, str],
        emoji_send_order: List[str],
        quote_texts: Dict[str, str],
        quote_send_order: List[str],
    ):
        if not matching_chats:
            self.log('[2단계] 처리할 매칭 채팅방 없음')
            return

        self.log(f'[2단계] {len(matching_chats)}개 채팅방 처리 시작')
        for idx, chat_info in enumerate(matching_chats, 1):
            if not self.running:
                break

            chat_id = chat_info['chat_id']
            nickname = chat_info['nickname']
            match_type = chat_info['match_type']
            display_name = chat_info['display_name']

            if nickname and self.tracker.is_processed(nickname):
                self.log(f'[{idx}/{len(matching_chats)}] {display_name} - 이미 처리됨, 스킵')
                continue

            prefix = '[테스트] ' if self.test_mode else ''
            self.log(f'{prefix}[{idx}/{len(matching_chats)}] {display_name} ({match_type}) 처리 시작')

            chat_url = f'https://soomgo.com/pro/chats/{chat_id}'
            if not self._safe_navigate_to_chat(chat_url):
                self.log(f'  → 채팅방 이동 실패: {display_name}')
                continue

            if match_type == 'emoji':
                if self._process_chat_content(emoji_texts, emoji_send_order):
                    if nickname:
                        self.tracker.mark_processed(nickname, 'emoji')
                    msg = '[테스트] 처리 완료 (실제 전송 안됨): ' if self.test_mode else '[이모지] 처리 완료: '
                    self.log(f'{msg}{display_name}')
                self._update_stats()
                continue

            if match_type == 'quote':
                my_messages = self.chat_room.get_my_sent_messages()
                already_sent = any(msg.strip().startswith('🌟오늘') for msg in my_messages)
                if already_sent:
                    self.log(f'  → 이미 이모티콘 메시지 발송됨 - 스킵: {display_name}')
                    continue
                if self._process_chat_content(quote_texts, quote_send_order):
                    if nickname:
                        self.tracker.mark_processed(nickname, 'quote')
                    msg = '[테스트] 처리 완료 (실제 전송 안됨): ' if self.test_mode else '[견적조회] 처리 완료: '
                    self.log(f'{msg}{display_name}')
                self._update_stats()

        self.log('[2단계 완료] 처리 종료')

    def _process_cycle(
        self,
        emoji: str,
        emoji_enabled: bool,
        quote_enabled: bool,
        emoji_texts: Dict[str, str],
        emoji_send_order: List[str],
        quote_texts: Dict[str, str],
        quote_send_order: List[str],
        max_count: int,
        quote_system_message: str,
    ):
        matching_chats = self._collect_matching_chats(
            emoji, emoji_enabled, quote_enabled, max_count, quote_system_message
        )
        if not self.running:
            return
        self._process_collected_chats(
            matching_chats, emoji_texts, emoji_send_order, quote_texts, quote_send_order
        )
        self.log('사이클 완료')

    def run(self, settings: dict = None, **kwargs) -> dict:
        """통합 기능 실행 (settings dict 또는 개별 인자 지원)"""
        if settings is None:
            settings = kwargs if kwargs else {}

        emoji = settings.get('emoji', '')
        emoji_enabled = settings.get('emoji_enabled', True)
        quote_enabled = settings.get('quote_enabled', True)
        emoji_texts = settings.get('emoji_texts', {})
        emoji_send_order = settings.get('emoji_send_order', [])
        quote_texts = settings.get('quote_texts', {})
        quote_send_order = settings.get('quote_send_order', [])
        quote_system_message = settings.get(
            'quote_system_message', SYSTEM_MESSAGES['QUOTE_VIEW']
        )
        max_count = settings.get('max_count', 20)

        self.running = True
        self.start_time = datetime.now()

        img_info = []
        for folder_num in self._get_numeric_folders():
            imgs = self._get_folder_images(folder_num)
            if imgs:
                img_info.append(f'폴더{folder_num}: {len(imgs)}장')
        img_summary = ', '.join(img_info) if img_info else '이미지 없음'
        mode_text = '[테스트 모드] ' if self.test_mode else ''

        self.log(
            f'{mode_text}통합 기능 시작 [v3.1-fiber] - 이모지: {emoji_enabled}, '
            f'견적조회: {quote_enabled}, 상위 {max_count}개 확인'
        )
        self.log(f'이미지: {img_summary}')
        if emoji_enabled:
            self.log(f"이모지 전송순서: {' → '.join(emoji_send_order)}")
        if quote_enabled:
            self.log(f'견적조회 감지 문구: "{quote_system_message}"')
            self.log(f"견적조회 전송순서: {' → '.join(quote_send_order)}")
        if self.test_mode:
            self.log('⚠ 테스트 모드: 실제 전송 없이 조건 탐지만 확인')
        self._update_stats()

        try:
            if not self._safe_navigate(URLS['CHAT_LIST']):
                self.log('초기 페이지 이동 실패 - 기능 종료')
                return self.tracker.get_stats()

            time.sleep(self.delay * 2)

            while self.running:
                self._process_cycle(
                    emoji, emoji_enabled, quote_enabled,
                    emoji_texts, emoji_send_order,
                    quote_texts, quote_send_order,
                    max_count, quote_system_message,
                )
                if not self.running:
                    break

                self.log('[사이클 완료] 채팅 목록으로 이동 및 새로고침...')
                if not self._safe_navigate(URLS['CHAT_LIST']):
                    self.log('목록 이동 실패 - 기능 종료')
                    break
                time.sleep(self.delay * 2)

            stats = self.tracker.get_stats()
            self.log(f"통합 기능 종료 - 이모지: {stats['emoji_count']}개, 견적조회: {stats['quote_count']}개")
            return stats

        except (TimeoutException, ReadTimeoutError, MaxRetryError, ProtocolError, NewConnectionError) as e:
            self.log(f'통합 기능 타임아웃 오류: {type(e).__name__}')
            logger.exception('통합 기능 타임아웃 상세')
            return self.tracker.get_stats()
        except WebDriverException as e:
            self.log(f'통합 기능 WebDriver 오류: {str(e)[:150]}')
            logger.exception('통합 기능 WebDriver 상세')
            return self.tracker.get_stats()
        except Exception as e:
            self.log(f'통합 기능 오류: {type(e).__name__}: {e}')
            logger.exception('통합 기능 상세 오류')
            return self.tracker.get_stats()
        finally:
            self.running = False
