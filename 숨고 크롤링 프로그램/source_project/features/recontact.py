"""
기능 1: 재접촉 기능
- 키워드 기반으로 채팅방 검색
- 마지막 메시지에 키워드가 있으면 메시지 전송
- 기간 지정 가능 (오늘 ~ 90일전, 전체)
- 2단계 처리: 1) 매칭 채팅방 수집 2) URL 직접 이동하여 처리
"""
import glob
import logging
import os
import re
import sys
import time
from datetime import datetime, date, timezone, timedelta
from logging.handlers import RotatingFileHandler
from typing import Callable, List, Dict, Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from urllib3.exceptions import ReadTimeoutError, MaxRetryError, ProtocolError, NewConnectionError

from features.content_sender import (
    contains_hired_me,
    has_sendable_content,
    normalize_hired_me_settings,
    normalize_hired_other_content,
    normalize_recontact_content,
    process_send_order,
)

from automation.chat_list import ChatListManager
from automation.chat_room import ChatRoomManager
from automation.selectors import URLS

logger = logging.getLogger(__name__)

PERIOD_TODAY = 0
PERIOD_1_DAY = 1
PERIOD_2_DAYS = 2
PERIOD_3_DAYS = 3
PERIOD_7_DAYS = 7
PERIOD_14_DAYS = 14
PERIOD_30_DAYS = 30
PERIOD_60_DAYS = 60
PERIOD_90_DAYS = 90
PERIOD_UNLIMITED = -1

PERIOD_LABEL_TO_DAYS = {
    '오늘': PERIOD_TODAY,
    '1일전': PERIOD_1_DAY,
    '2일전': PERIOD_2_DAYS,
    '3일전': PERIOD_3_DAYS,
    '7일전': PERIOD_7_DAYS,
    '14일전': PERIOD_14_DAYS,
    '30일전': PERIOD_30_DAYS,
    '60일전': PERIOD_60_DAYS,
    '90일전': PERIOD_90_DAYS,
    '전체': PERIOD_UNLIMITED,
}
PERIOD_CHOICES = tuple(PERIOD_LABEL_TO_DAYS.keys())

KST = timezone(timedelta(hours=9))
# 가상 스크롤 목록에서 연속 N건이 기간 밖일 때만 수집 종료 (1건 오판으로 조기 종료 방지)
CONSECUTIVE_OUT_OF_PERIOD_STOP = 8
DEFAULT_MAX_SCROLLS = 150


def resolve_recontact_period(settings: dict) -> tuple[int, str]:
    """재접촉 설정에서 (기간 일수, 표시 라벨) 반환"""
    raw_days = settings.get('period_days')
    if raw_days is not None:
        try:
            period_days = int(raw_days)
        except (TypeError, ValueError):
            period_days = PERIOD_TODAY
        if period_days < 0:
            return PERIOD_UNLIMITED, '전체'
        for label, days in PERIOD_LABEL_TO_DAYS.items():
            if days == period_days:
                return period_days, label
        return period_days, f'{period_days}일'

    period_label = (settings.get('period') or '오늘').strip()
    if period_label not in PERIOD_LABEL_TO_DAYS:
        period_label = '오늘'
    return PERIOD_LABEL_TO_DAYS[period_label], period_label


def get_base_path():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parent_dir = os.path.dirname(script_dir)
    if os.path.isdir(os.path.join(parent_dir, 'images')) and not os.path.isdir(
        os.path.join(script_dir, 'images')
    ):
        return parent_dir
    return script_dir


def _cleanup_old_logs(log_dir: str, keep_count: int):
    pattern = os.path.join(log_dir, 'recontact_debug_*.log')
    log_files = sorted(glob.glob(pattern), key=os.path.getmtime)
    if len(log_files) <= keep_count:
        return
    for old_file in log_files[:-keep_count] if keep_count > 0 else log_files:
        try:
            os.remove(old_file)
        except Exception as e:
            logger.warning(f'[로그 정리] 삭제 실패: {old_file} - {e}')


def setup_debug_logger(max_files: int = 10):
    debug_logger = logging.getLogger('recontact_debug')
    debug_logger.setLevel(logging.DEBUG)
    debug_logger.handlers.clear()

    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'log')
    os.makedirs(log_dir, exist_ok=True)
    _cleanup_old_logs(log_dir, max_files - 1)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = os.path.join(log_dir, f'recontact_debug_{timestamp}.log')
    file_handler = RotatingFileHandler(
        log_file, maxBytes=10485760, backupCount=3, encoding='utf-8'
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s.%(msecs)03d [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    ))
    debug_logger.addHandler(file_handler)
    debug_logger.info('===== 재접촉 디버그 로그 시작 =====')
    debug_logger.info(f'로그 파일: {log_file}')
    return debug_logger


class RecontactFeature:
    """재접촉 기능 클래스 (2단계 처리 방식)"""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay
        self.chat_list = ChatListManager(driver, delay)
        self.chat_room = ChatRoomManager(driver, delay)
        self.running = False
        self.log_callback: Optional[Callable[[str], None]] = None
        self.debug_logger = None
        self._start_time = None
        self.images_folder = os.path.join(get_base_path(), 'images')

    def set_log_callback(self, callback: Callable[[str], None]):
        self.log_callback = callback

    def _debug(self, message: str, level: str = 'DEBUG'):
        if not self.debug_logger:
            return
        elapsed = ''
        if self._start_time:
            elapsed = f'[+{time.time() - self._start_time:.1f}s] '
        full_message = f'{elapsed}{message}'
        getattr(self.debug_logger, level.lower(), self.debug_logger.debug)(full_message)

    def log(self, message: str, gui: bool = True):
        logger.info(message)
        self._debug(message, 'INFO')
        if gui and self.log_callback:
            self.log_callback(message)

    def stop(self):
        self.running = False
        self.log('재접촉 기능 중지 요청됨')

    def _kst_today(self) -> date:
        return datetime.now(KST).date()

    def _days_ago_from_date(self, message_date: date, period_days: int) -> bool:
        """message_date가 period_days(0=오늘 … N=N일전 포함) 범위 밖이면 True"""
        days_ago = (self._kst_today() - message_date).days
        return days_ago > period_days

    def _extract_time_from_row_text(self, row_text: str) -> str:
        """목록 행 text에서 시간 라벨 추출 (fiber updated_at 보조)"""
        if not row_text:
            return ''
        for line in reversed(row_text.splitlines()):
            candidate = line.strip()
            if not candidate:
                continue
            if re.match(r'^(오전|오후)\s*\d{1,2}:\d{2}$', candidate):
                return candidate
            if candidate in ('어제', '방금', '금방'):
                return candidate
            if re.match(r'^\d+일\s*전$', candidate):
                return candidate
            date_match = re.match(r'^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$', candidate)
            if date_match:
                y, m, d = date_match.groups()
                return f'{y}. {m.zfill(2)}. {d.zfill(2)}'
        return ''

    def _resolve_message_time(self, item: dict) -> str:
        updated_at = (item.get('message_time') or item.get('updated_at') or '').strip()
        if updated_at:
            return updated_at
        return self._extract_time_from_row_text(item.get('text', '') or '')

    def _is_out_of_period(self, message_time: str, period_days: int) -> bool:
        if period_days < 0:
            return False
        if not message_time:
            return False

        iso_match = re.match(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})?$', message_time)
        if iso_match:
            try:
                iso_text = iso_match.group(1)
                tz_suffix = iso_match.group(2)
                if tz_suffix:
                    dt = datetime.fromisoformat(iso_text + tz_suffix.replace('Z', '+00:00'))
                    message_date = dt.astimezone(KST).date()
                else:
                    message_date = datetime.fromisoformat(iso_text).replace(tzinfo=KST).date()
                return self._days_ago_from_date(message_date, period_days)
            except ValueError:
                pass
            # 레거시: 타임존 없이 날짜 부분만
            try:
                message_date = date(int(message_time[0:4]), int(message_time[5:7]), int(message_time[8:10]))
                return self._days_ago_from_date(message_date, period_days)
            except ValueError:
                return False

        if re.match(r'^(오전|오후)\s*\d{1,2}:\d{2}$', message_time):
            return False
        if message_time in ('어제', '방금', '금방'):
            return period_days < PERIOD_1_DAY

        date_match = re.match(r'^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$', message_time)
        if date_match:
            try:
                message_date = date(
                    int(date_match.group(1)),
                    int(date_match.group(2)),
                    int(date_match.group(3)),
                )
                return self._days_ago_from_date(message_date, period_days)
            except ValueError:
                return False

        day_match = re.match(r'^(\d+)일\s*전$', message_time)
        if day_match:
            return int(day_match.group(1)) > period_days

        return False

    def _max_scrolls_for_period(self, period_days: int) -> int:
        if period_days < 0:
            return DEFAULT_MAX_SCROLLS
        if period_days == PERIOD_TODAY:
            return 40
        return min(DEFAULT_MAX_SCROLLS, max(60, period_days * 30))

    def _parse_keywords(self, keyword_input: str) -> List[str]:
        keywords = []
        for part in keyword_input.replace('\n', ',').split(','):
            kw = part.strip()
            if kw:
                keywords.append(kw)
        return keywords

    def _match_any_keyword(self, text: str, keywords: List[str], chat_info: str = '') -> str:
        """마지막 메시지 텍스트에 키워드 포함 여부 확인 (부분 문자열)"""
        if not text or not text.strip():
            return ''
        searchable = text.strip()
        for kw in sorted(keywords, key=len, reverse=True):
            if kw and kw in searchable:
                preview = searchable[:80].replace('\n', ' ')
                self.log(
                    f"[키워드 매칭] '{kw}' 발견! | 채팅: {chat_info} | "
                    f"마지막메시지: {preview}",
                    gui=False,
                )
                return kw
        return ''

    def _scroll_and_wait_for_load(self, max_scroll_attempts: int = 30) -> bool:
        """
        동적 로딩 감지 스크롤.
        가상 스크롤은 새 ID 추가뿐 아니라 visible ID 집합·순서가 바뀌면 성공으로 본다.
        """
        try:
            before_ids = self.chat_list.get_visible_chat_ids()
            before_list = self.chat_list.get_visible_chat_id_list()

            self.log(
                f'[스크롤] 현재 {len(before_ids)}개, 동적 스크롤 시작...',
                gui=False,
            )

            for attempt in range(max_scroll_attempts):
                if not self.running:
                    return False

                self.chat_list.scroll_down(500)
                time.sleep(0.35)

                after_ids = self.chat_list.get_visible_chat_ids()
                after_list = self.chat_list.get_visible_chat_id_list()

                if after_ids != before_ids or after_list != before_list:
                    new_ids = after_ids - before_ids
                    self.log(
                        f'[스크롤] 로딩 감지! '
                        f'새 {len(new_ids)}개 / 목록 변경 ({attempt + 1}회 스크롤)',
                        gui=False,
                    )
                    return True

            try:
                li_elements = self.chat_list._find_chat_list_elements()
                if li_elements:
                    self.driver.execute_script(
                        "arguments[0].scrollIntoView({block: 'end', behavior: 'auto'});",
                        li_elements[-1],
                    )
                    time.sleep(0.45)
                    after_ids = self.chat_list.get_visible_chat_ids()
                    after_list = self.chat_list.get_visible_chat_id_list()
                    if after_ids != before_ids or after_list != before_list:
                        self.log('[스크롤] scrollIntoView 후 목록 변경 감지', gui=False)
                        return True
            except Exception:
                pass

            self.log(f'[스크롤] {max_scroll_attempts}회 시도 후 추가 로딩 없음', gui=False)
            return False
        except Exception as e:
            self._debug(f'[_scroll_and_wait_for_load] 오류: {type(e).__name__}: {e}', 'ERROR')
            return False

    def _wait_for_chat_list_ready(self, timeout: int = 15) -> bool:
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: d.execute_script('return document.readyState') == 'complete'
            )
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((
                    By.CSS_SELECTOR,
                    'ul.css-19wxjby > li, main ul > li, ul[class*="css-"] > li, a[href*="/pro/chats/"]',
                ))
            )
            time.sleep(0.5)
            return self.chat_list.get_chat_count() > 0
        except TimeoutException:
            self.log(f'[페이지 로드] {timeout}초 타임아웃')
            return False
        except Exception as e:
            self.log(f'[페이지 로드] 오류: {type(e).__name__}')
            return False

    def _safe_navigate(self, url: str, max_retries: int = 3) -> bool:
        for attempt in range(max_retries):
            try:
                self.driver.set_page_load_timeout(60)
                self.driver.get(url)
                if '/pro/chats' in url and '/pro/chats/' not in url:
                    if self._wait_for_chat_list_ready():
                        return True
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    return False
                time.sleep(self.delay)
                return True
            except (TimeoutException, ReadTimeoutError, MaxRetryError, ProtocolError, NewConnectionError, WebDriverException) as e:
                self.log(f'[페이지 이동] 실패 ({attempt + 1}/{max_retries}): {type(e).__name__}', gui=False)
            except Exception as e:
                self.log(f'[페이지 이동] 예외: {type(e).__name__}')
                logger.exception('[페이지 이동] 상세 오류')
            if attempt < max_retries - 1:
                time.sleep((attempt + 1) * 2)
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

    def _collect_matching_chats(
        self,
        keywords: List[str],
        period_days: int,
        period_text: str,
        general_ready: bool,
        hired_other_enabled: bool,
        hired_other_ready: bool,
        hired_other_system_message: str,
        hired_me_enabled: bool,
        hired_me_filter_text: str,
    ) -> List[Dict]:
        matching_chats = []
        checked_count = 0
        hired_me_skip_count = 0
        checked_chat_ids = set()
        previous_chat_ids = set()
        loop_count = 0
        scroll_count = 0
        consecutive_out_of_period = 0
        max_scrolls = self._max_scrolls_for_period(period_days)

        try:
            self.chat_list.scroll_to_top()
            time.sleep(self.delay)
        except Exception as e:
            self.log(f'[수집] 초기화 중 오류: {type(e).__name__}')

        self.log(
            f'[1단계] 키워드 매칭 채팅방 수집 시작 (기간: {period_text}, '
            f'최대 스크롤 {max_scrolls}회)'
        )

        while self.running and scroll_count <= max_scrolls:
            loop_count += 1
            if loop_count > 1000:
                self.log('[수집] 루프 한계 도달, 수집 종료')
                break

            try:
                chat_items = self.chat_list.get_chat_items(exclude_ids=checked_chat_ids)
            except Exception as e:
                self.log(f'[수집 중단] 채팅 목록 가져오기 실패: {type(e).__name__}')
                break

            debug_info = getattr(self.chat_list, 'last_extraction_debug', '')
            if chat_items and 'click_fallback=' in debug_info and loop_count == 1:
                self.log(f'[스캔] 클릭 방식으로 채팅방 {len(chat_items)}개 ID 수집')

            if not chat_items:
                debug_info = getattr(self.chat_list, 'last_extraction_debug', '')
                if checked_chat_ids and self.chat_list.get_chat_count() > 0:
                    try:
                        if self._scroll_and_wait_for_load():
                            scroll_count += 1
                            continue
                    except Exception as e:
                        self.log(f'[수집 중단] 스크롤 중 오류: {type(e).__name__}')
                        break
                    self.log('[스캔] 더 이상 로드할 채팅방 없음')
                    break

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
                try:
                    if self._scroll_and_wait_for_load():
                        scroll_count += 1
                        continue
                    self.log('[스캔] 더 이상 로드할 채팅방 없음')
                    break
                except Exception as e:
                    self.log(f'[수집 중단] 스크롤 중 오류: {type(e).__name__}')
                    break

            if new_chat_ids:
                self.log(f'[스캔] 채팅방 {len(chat_items)}개 로드됨, 확인: {len(new_chat_ids)}개', gui=False)

            period_ended = False
            for item in chat_items:
                if not self.running:
                    break

                chat_id = item.get('chat_id')
                if not chat_id or chat_id in checked_chat_ids:
                    continue

                checked_chat_ids.add(chat_id)
                checked_count += 1

                nickname = item.get('nickname', '')
                text = item.get('text', '')
                last_message = item.get('last_message', '')
                last_message_type = item.get('last_message_type', '')
                message_time = self._resolve_message_time(item)
                display_name = nickname or f'ID:{chat_id}'
                row_text = text or ''

                if self._is_out_of_period(message_time, period_days):
                    consecutive_out_of_period += 1
                    self.log(
                        f'[기간 스킵] {display_name} 범위 밖 '
                        f'(시간: {message_time or "미상"}, 연속 {consecutive_out_of_period}건)',
                        gui=False,
                    )
                    if consecutive_out_of_period >= CONSECUTIVE_OUT_OF_PERIOD_STOP:
                        self.log(
                            f'[기간 종료] 연속 {consecutive_out_of_period}건이 '
                            f'기간({period_text}) 밖 — 수집 종료'
                        )
                        period_ended = True
                        break
                    continue

                consecutive_out_of_period = 0

                if (
                    hired_me_enabled
                    and contains_hired_me(row_text, last_message, marker=hired_me_filter_text)
                ):
                    hired_me_skip_count += 1
                    self.log(
                        f'[내 고용 스킵] {display_name} - 이미 고용된 고객 '
                        f'(감지: "{hired_me_filter_text}")',
                        gui=False,
                    )
                    continue

                if (
                    hired_other_enabled
                    and hired_other_ready
                    and hired_other_system_message
                    and hired_other_system_message in row_text
                ):
                    preview = row_text[:60].replace('\n', ' ')
                    self.log(
                        f'[다른 고수 고용] "{hired_other_system_message}" 감지 | '
                        f'채팅: {display_name} | 행미리보기: {preview}',
                        gui=False,
                    )
                    matching_chats.append({
                        'chat_id': chat_id,
                        'nickname': nickname,
                        'display_name': display_name,
                        'match_type': 'hired_other',
                        'matched_keyword': hired_other_system_message,
                        'row_text': row_text,
                    })
                    self.log(f"  → 다른 고수 고용 매칭! 수집됨: {display_name}")
                    continue

                if last_message_type == 'SYSTEM':
                    continue

                if not general_ready:
                    continue

                last_message_clean = (last_message or '').strip()
                if not last_message_clean:
                    self.log(
                        f'[키워드 스킵] {display_name} - 마지막 메시지 없음',
                        gui=False,
                    )
                    continue

                matched_keyword = self._match_any_keyword(
                    last_message_clean, keywords, display_name
                )
                if matched_keyword:
                    matching_chats.append({
                        'chat_id': chat_id,
                        'nickname': nickname,
                        'display_name': display_name,
                        'match_type': 'keyword',
                        'matched_keyword': matched_keyword,
                        'row_text': row_text,
                    })
                    self.log(f"  → 키워드 '{matched_keyword}' 매칭! 수집됨: {display_name}")

            previous_chat_ids.update(current_chat_ids)

            if period_ended:
                break

            if self._scroll_and_wait_for_load():
                scroll_count += 1
            else:
                self.log('[스캔] 더 이상 로드할 채팅방 없음')
                break

        if hired_me_skip_count:
            self.log(f'[1단계] 내 고용 스킵: {hired_me_skip_count}건', gui=False)
        self.log(
            f'[1단계 완료] {checked_count}개 스캔, {len(matching_chats)}개 매칭됨 '
            f'(스크롤 {scroll_count}회)'
        )
        return matching_chats

    def _process_collected_chats(
        self,
        matching_chats: List[Dict],
        texts: Dict[str, str],
        send_order: List[str],
        hired_other_texts: Dict[str, str],
        hired_other_send_order: List[str],
        hired_me_enabled: bool,
        hired_me_filter_text: str,
    ) -> int:
        if not matching_chats:
            self.log('[2단계] 처리할 매칭 채팅방 없음')
            return 0

        self.log(f'[2단계] {len(matching_chats)}개 채팅방 처리 시작')
        processed_count = 0

        for idx, chat_info in enumerate(matching_chats, 1):
            if not self.running:
                break

            chat_id = chat_info['chat_id']
            display_name = chat_info['display_name']
            matched_keyword = chat_info.get('matched_keyword', '')
            match_type = chat_info.get('match_type', 'keyword')
            row_text = chat_info.get('row_text', '')

            if (
                hired_me_enabled
                and contains_hired_me(row_text, marker=hired_me_filter_text)
            ):
                self.log(
                    f'  → [내 고용] 2차 스킵: {display_name} '
                    f'(감지: "{hired_me_filter_text}")',
                    gui=False,
                )
                continue

            type_label = '다른 고수 고용' if match_type == 'hired_other' else '재접촉'
            self.log(
                f"[{idx}/{len(matching_chats)}] {display_name} "
                f"({type_label}, 조건: '{matched_keyword}') 처리 중..."
            )

            chat_url = f'https://soomgo.com/pro/chats/{chat_id}'
            if not self._safe_navigate_to_chat(chat_url):
                self.log(f'  → 채팅방 이동 실패: {display_name}')
                continue

            time.sleep(self.delay * 0.5)
            if match_type == 'hired_other':
                send_ok = process_send_order(
                    self.chat_room,
                    hired_other_texts,
                    hired_other_send_order,
                    self.images_folder,
                    self.delay,
                    self.log,
                )
            else:
                send_ok = process_send_order(
                    self.chat_room,
                    texts,
                    send_order,
                    self.images_folder,
                    self.delay,
                    self.log,
                )

            if send_ok:
                self.chat_room.toggle_favorite()
                processed_count += 1
                self.log(f'  → [{type_label}] 처리 완료: {display_name}')
            else:
                self.log(f'  → [{type_label}] 메시지/이미지 전송 실패: {display_name}')

        self.log(f'[2단계 완료] {processed_count}/{len(matching_chats)}개 처리 완료')
        return processed_count

    def run(self, settings: dict = None, keyword: str = None, message: str = None, period_days: int = PERIOD_TODAY) -> int:
        """재접촉 실행 (settings dict 또는 레거시 인자)"""
        if settings is None:
            legacy_label = '오늘'
            for label, days in PERIOD_LABEL_TO_DAYS.items():
                if days == period_days:
                    legacy_label = label
                    break
            settings = {
                'keyword': keyword or '',
                'message': message or '',
                'period': legacy_label,
            }

        keyword_input = settings.get('keyword', '')
        texts, send_order = normalize_recontact_content(settings)
        hired_other_texts, hired_other_send_order, hired_other_system_message, hired_other_enabled = (
            normalize_hired_other_content(settings)
        )
        hired_me_filter_text, hired_me_enabled = normalize_hired_me_settings(settings)
        period_days, period_text = resolve_recontact_period(settings)

        self.running = True
        processed_count = 0
        self.debug_logger = setup_debug_logger()
        self._start_time = time.time()

        try:
            keywords = self._parse_keywords(keyword_input)
            if not keywords:
                self.log('키워드가 없습니다.')
                return 0

            general_ready = bool(
                send_order and has_sendable_content(texts, send_order, self.images_folder)
            )
            hired_other_active = hired_other_enabled and bool(hired_other_send_order)
            hired_other_ready = bool(
                hired_other_active
                and has_sendable_content(
                    hired_other_texts, hired_other_send_order, self.images_folder
                )
            )

            if not general_ready and not hired_other_ready:
                self.log('전송할 내용이 없습니다. 일반 재접촉 또는 다른 고수 고용 설정을 확인하세요.')
                return 0

            if hired_other_enabled and not hired_other_ready:
                self.log('다른 고수 고용이 활성화되었지만 전송 내용이 없습니다. 일반 재접촉만 진행합니다.')

            keywords_display = ', '.join(keywords[:5]) + ('...' if len(keywords) > 5 else '')
            self.log(
                f'재접촉 기능 시작 [v3.5] - 키워드: [{keywords_display}] '
                f'({len(keywords)}개), 기간: {period_text}'
            )
            self.log(f'[키워드 전체 목록] {keywords}', gui=False)
            if general_ready:
                self.log(f"일반 전송순서: {' → '.join(send_order)}")
            if hired_other_enabled and hired_other_ready:
                self.log(f'다른 고수 고용 감지 문구: "{hired_other_system_message}"')
                self.log(f"다른 고수 고용 전송순서: {' → '.join(hired_other_send_order)}")
            if hired_me_enabled:
                self.log(
                    f'내 고용 제외 활성: "{hired_me_filter_text}" (띄어쓰기 무시 후 매칭)'
                )
            else:
                self.log('내 고용 제외 비활성 - 이미 고용된 고객도 재접촉 대상에 포함될 수 있음')

            if not self._safe_navigate(URLS['CHAT_LIST']):
                self.log('채팅 목록 페이지 이동 실패')
                return 0

            time.sleep(self.delay * 2)
            matching_chats = self._collect_matching_chats(
                keywords,
                period_days,
                period_text,
                general_ready,
                hired_other_enabled,
                hired_other_ready,
                hired_other_system_message,
                hired_me_enabled,
                hired_me_filter_text,
            )

            if not self.running:
                self.log('재접촉 기능 중지됨')
                if matching_chats:
                    self.log(f'[중지] 수집된 {len(matching_chats)}개 채팅방 처리 진행')
                    processed_count = self._process_collected_chats(
                        matching_chats,
                        texts,
                        send_order,
                        hired_other_texts,
                        hired_other_send_order,
                        hired_me_enabled,
                        hired_me_filter_text,
                    )
                return processed_count

            processed_count = self._process_collected_chats(
                matching_chats,
                texts,
                send_order,
                hired_other_texts,
                hired_other_send_order,
                hired_me_enabled,
                hired_me_filter_text,
            )
            self.log(f'재접촉 기능 완료 - 처리한 채팅방: {processed_count}개')
            return processed_count

        except (TimeoutException, ReadTimeoutError, MaxRetryError, ProtocolError, NewConnectionError) as e:
            self.log(f'재접촉 기능 타임아웃 오류: {type(e).__name__}')
            logger.exception('재접촉 기능 타임아웃 상세')
            return processed_count
        except WebDriverException as e:
            self.log(f'재접촉 기능 WebDriver 오류: {str(e)[:150]}')
            logger.exception('재접촉 기능 WebDriver 상세')
            return processed_count
        except Exception as e:
            self.log(f'재접촉 기능 오류: {type(e).__name__}: {e}')
            logger.exception('재접촉 기능 상세 오류')
            return processed_count
        finally:
            self.running = False
            if self.debug_logger:
                total_time = time.time() - self._start_time if self._start_time else 0
                self._debug(f'[run] 최종 처리: {processed_count}개, 소요: {total_time:.1f}초')
                self._debug('===== 재접촉 디버그 로그 종료 =====')
                for handler in self.debug_logger.handlers[:]:
                    handler.close()
                    self.debug_logger.removeHandler(handler)
