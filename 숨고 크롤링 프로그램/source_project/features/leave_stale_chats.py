"""
기능: 오래된 채팅방 일괄 정리 (희망일 만료 · 개설 30일 초과)

3단계: ① 목록 수집(방 입장 없음) → ② JSON 큐 저장 → ③ 검색 입장·판정·나가기
중단 시 JSON 이어하기.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Callable, Dict, List, Optional, Set, Tuple
from zoneinfo import ZoneInfo

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from automation.chat_item_validate import (
    is_valid_chat_list_item,
    normalize_chat_id,
    partition_valid_chats,
    row_preview_text,
)
from automation.chat_leave import ChatLeaveHelper
from automation.chat_list import ChatListManager
from automation.chat_list_search import ChatListSearchHelper
from automation.chat_navigation import (
    is_login_url,
    return_to_chat_list_session_safe,
    verify_chat_room_shell,
)
from automation.chat_room_opened_at import (
    extract_chat_room_opened_at,
    scroll_chat_room_to_top,
)
from automation.customer_request import (
    CustomerRequestReader,
    pick_preferred_date_raw_from_request,
)
from automation.overlay_modals import dismiss_blocking_overlays
from automation.preferred_date_parser import StaleChatVerdict, evaluate_stale_chat
from automation.selectors import SYSTEM_MESSAGES, URLS
from automation.withdrawn_customer import (
    REASON_LABELS as LEAVE_ONLY_REASON_LABELS,
    detect_leave_only_reason,
    leave_only_log_label,
)
from automation.window_layout import ensure_soomgo_mobile_layout
from features.content_sender import contains_hired_me, contains_hired_other
from features.stale_chat_queue import (
    STATUS_ERROR,
    STATUS_LEFT,
    STATUS_PENDING,
    STATUS_SKIP,
    STATUS_SKIP_HIRED,
    STATUS_WOULD_LEAVE,
    apply_list_hired_prefilter,
    clear_stale_chat_queue,
    create_queue_from_chats,
    get_pending_items,
    get_queue_summary,
    load_stale_chat_queue,
    mark_queue_interrupted,
    save_stale_chat_queue,
    summarize_results,
    update_queue_item,
)

logger = logging.getLogger(__name__)

DEFAULT_MAX_SCROLLS = 100
BATCH_PAUSE_EVERY = 25
BATCH_PAUSE_SEC = 2.5
KST = ZoneInfo('Asia/Seoul')

REASON_LABELS = {
    'preferred_date_passed': '희망일 만료',
    'room_older_than_30d': '개설 30일 초과',
    **LEAVE_ONLY_REASON_LABELS,
}


def order_chats_for_processing(chats: List[Dict], *, oldest_first: bool = True) -> List[Dict]:
    """collect_seq 0=목록 상단(최근). oldest_first=True → 오래된 것부터."""
    if not chats:
        return chats
    if all('collect_seq' in item for item in chats):
        return sorted(
            chats,
            key=lambda item: int(item.get('collect_seq', 0)),
            reverse=oldest_first,
        )
    return list(reversed(chats)) if oldest_first else list(chats)


def normalize_leave_stale_settings(settings: dict) -> tuple[bool, int, bool, bool]:
    dry_run = bool(settings.get('dry_run', True))
    resume = bool(settings.get('resume', False))
    fresh = bool(settings.get('fresh', False))
    max_scrolls = settings.get('max_scrolls', DEFAULT_MAX_SCROLLS)
    try:
        max_scrolls = int(max_scrolls)
    except (TypeError, ValueError):
        max_scrolls = DEFAULT_MAX_SCROLLS
    if max_scrolls < 1:
        max_scrolls = DEFAULT_MAX_SCROLLS
    return dry_run, max_scrolls, resume, fresh


class LeaveStaleChatsFeature:
    """희망일·개설일 기준 오래된 채팅방 나가기 (JSON 큐 + 검색 입장)."""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay
        self.chat_list = ChatListManager(driver, delay)
        self.chat_search = ChatListSearchHelper(driver, delay)
        self.chat_leave = ChatLeaveHelper(driver, delay)
        self.request_reader = CustomerRequestReader(driver, delay * 0.35)
        self.running = False
        self.log_callback: Optional[Callable[[str], None]] = None
        self._queue: Optional[dict] = None
        self._processed_in_run = 0

    def set_log_callback(self, callback: Callable[[str], None]):
        self.log_callback = callback
        self.chat_leave._log = callback

    def log(self, message: str):
        logger.info(message)
        if self.log_callback:
            self.log_callback(message)

    def stop(self):
        self.running = False
        self.log('오래된 채팅 정리 중지 요청됨')
        if self._queue is not None:
            mark_queue_interrupted(self._queue)

    def _kst_today(self):
        return datetime.now(KST).date()

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
            self.log(f'[목록 로드] {timeout}초 타임아웃')
            return False
        except Exception as e:
            self.log(f'[목록 로드] 오류: {type(e).__name__}')
            return False

    def _ensure_chat_list_workspace(self) -> bool:
        if is_login_url(self.driver.current_url):
            self.log('[세션] 로그인 페이지 — 재로그인이 필요합니다.')
            return False
        if not return_to_chat_list_session_safe(
            self.driver, self.delay, log=self.log, allow_full_get=True,
        ):
            return False
        try:
            self.chat_list.scroll_to_top()
            time.sleep(self.delay * 0.35)
        except Exception:
            pass
        self.chat_search.clear_search()
        return self._wait_for_chat_list_ready(timeout=12)

    def _scroll_and_wait_for_load(
        self,
        max_scroll_attempts: int = 12,
        *,
        known_ids: Optional[Set[str]] = None,
    ) -> bool:
        known = known_ids or set()
        try:
            before_ids = self.chat_list.get_visible_chat_ids()
            for attempt in range(max_scroll_attempts):
                if not self.running:
                    return False
                self.chat_list.scroll_down(500)
                time.sleep(0.35)
                after_ids = self.chat_list.get_visible_chat_ids()
                fresh = after_ids - before_ids
                unseen = fresh - known
                if unseen:
                    self.log(
                        f'[스크롤] 로딩 감지! 미수집 {len(unseen)}개 ({attempt + 1}회 스크롤)'
                    )
                    return True
                if fresh:
                    before_ids = after_ids
                    continue
            self.log(f'[스크롤] {max_scroll_attempts}회 시도 — 더 내려갈 목록 없음')
            return False
        except Exception as e:
            self.log(f'[스크롤] 오류: {type(e).__name__}')
            return False

    def _list_hired_flags(self, item: dict) -> tuple[bool, bool]:
        texts = (
            item.get('text', '') or '',
            item.get('last_message', '') or '',
            item.get('nickname', '') or '',
        )
        hired_me = contains_hired_me(*texts, marker=SYSTEM_MESSAGES['HIRED_ME'])
        hired_other = contains_hired_other(*texts, marker=SYSTEM_MESSAGES['HIRED_OTHER'])
        return hired_me, hired_other

    def _collect_all_chats(self, max_scrolls: int) -> List[Dict]:
        all_chats: List[Dict] = []
        checked_ids: Set[str] = set()
        seen_ids: Set[str] = set()
        previous_chat_ids: Set[str] = set()
        scroll_count = 0
        loop_count = 0

        try:
            self.chat_list.scroll_to_top()
            time.sleep(self.delay)
        except Exception as e:
            self.log(f'[수집] 초기화 중 오류: {type(e).__name__}')

        self.log('[1단계] 목록 스크롤 — chat_id·이름만 수집 (방 입장·검색 없음)')

        while self.running and scroll_count <= max_scrolls:
            loop_count += 1
            if loop_count > 1000:
                self.log('[수집] 루프 한계 도달, 수집 종료')
                break

            chat_items = self.chat_list.get_chat_items(exclude_ids=checked_ids)
            if not chat_items:
                if checked_ids and self.chat_list.get_chat_count() > 0:
                    if self._scroll_and_wait_for_load(known_ids=seen_ids):
                        scroll_count += 1
                        continue
                if not checked_ids:
                    debug_info = getattr(self.chat_list, 'last_extraction_debug', '')
                    self.log(
                        f'[수집] 채팅 목록을 읽지 못했습니다 '
                        f'({debug_info or "DOM 추출 실패"})'
                    )
                else:
                    self.log('[수집] 목록 끝 — 더 이상 채팅방 없음')
                break

            current_chat_ids = {
                item.get('chat_id') for item in chat_items if item.get('chat_id')
            }
            new_chat_ids = current_chat_ids - previous_chat_ids

            if not new_chat_ids and loop_count > 1:
                if self._scroll_and_wait_for_load(known_ids=seen_ids):
                    scroll_count += 1
                    continue
                self.log('[수집] 목록 끝 — 더 이상 채팅방 없음')
                break

            previous_chat_ids.update(current_chat_ids)

            added = 0
            for item in chat_items:
                if not self.running:
                    break
                chat_id = normalize_chat_id(item.get('chat_id'))
                if not chat_id:
                    continue
                checked_ids.add(chat_id)
                if chat_id in seen_ids:
                    continue

                row_text = item.get('text', '') or item.get('last_message', '')
                candidate = {
                    'chat_id': chat_id,
                    'nickname': item.get('nickname', '') or '',
                    'text': row_text,
                    'last_message': item.get('last_message', '') or '',
                    'updated_at': item.get('updated_at', '') or item.get('message_time', '') or '',
                    'href': item.get('href') or '',
                }
                if not is_valid_chat_list_item(candidate):
                    continue

                seen_ids.add(chat_id)
                added += 1
                nickname = candidate['nickname'] or row_preview_text(candidate) or f'ID:{chat_id}'
                hired_me, hired_other = self._list_hired_flags(item)
                leave_only_reason = detect_leave_only_reason(
                    row_text, candidate['last_message'],
                )
                all_chats.append({
                    'chat_id': chat_id,
                    'nickname': nickname,
                    'display_name': nickname,
                    'row_text': row_text,
                    'text': row_text,
                    'last_message': candidate['last_message'],
                    'updated_at': candidate['updated_at'],
                    'href': candidate['href'],
                    'hired_me': hired_me,
                    'hired_other': hired_other,
                    'leave_only_reason': leave_only_reason,
                    'withdrawn': leave_only_reason is not None,
                    'collect_seq': len(all_chats),
                })

            if added:
                self.log(
                    f'[수집] +{added}개 (누적 {len(all_chats)}개 · 스크롤 {scroll_count}회)'
                )

            if self._scroll_and_wait_for_load(known_ids=seen_ids):
                scroll_count += 1
            else:
                self.log('[수집] 목록 끝 — 수집 완료')
                break

        self.log(
            f'[1단계 완료] {len(all_chats)}개 채팅방 수집 '
            f'(스캔 {len(checked_ids)}건 · 스크롤 {scroll_count}회)'
        )
        leave_only_count = sum(1 for chat in all_chats if chat.get('leave_only_reason'))
        if leave_only_count:
            self.log(
                f'[수집] 판정 생략 대상 {leave_only_count}개 '
                f'(탈퇴·상대방 나감) — 3단계에서 바로 나가기'
            )
        return all_chats

    def _build_queue_from_collection(
        self, all_chats: List[Dict], *, dry_run: bool, kst_today: str,
    ) -> dict:
        valid_chats, invalid_chats = partition_valid_chats(all_chats)
        if invalid_chats:
            self.log(
                f'[큐] 유효하지 않은 항목 {len(invalid_chats)}개 제외 '
                f'(이름·미리보기 없음)'
            )
        ordered = order_chats_for_processing(valid_chats, oldest_first=True)
        queue = create_queue_from_chats(ordered, dry_run=dry_run, kst_today=kst_today)
        hired_skip = apply_list_hired_prefilter(queue)
        if hired_skip:
            self.log(f'[2단계] 목록 배지로 {hired_skip}개 스킵 (방 입장 없음)')
        save_stale_chat_queue(queue)
        self.log(f'[큐 저장] {len(queue.get("items") or [])}개 → {get_queue_summary()}')
        return queue

    def _prepare_room_ui_for_return(self) -> None:
        try:
            self.request_reader.close_request_modal()
        except Exception:
            pass
        dismiss_blocking_overlays(self.driver, self.delay * 0.25, max_rounds=3)

    def _return_to_list(self) -> bool:
        self._prepare_room_ui_for_return()
        ok = self.chat_search.return_to_list_spa(log=self.log)
        if ok:
            return True
        if is_login_url(self.driver.current_url):
            return False
        ok = return_to_chat_list_session_safe(
            self.driver, self.delay, log=self.log, allow_full_get=True,
        )
        if ok:
            self.chat_search.clear_search()
        return ok

    def _open_chat_for_item(self, item: dict) -> bool:
        chat_id = str(item.get('chat_id') or '')
        nickname = str(item.get('nickname') or item.get('display_name') or '')
        if not self._ensure_chat_list_workspace():
            return False
        if self.chat_search.open_chat(chat_id, nickname, log=self.log):
            shell = verify_chat_room_shell(self.driver)
            if shell.get('leaveOnly') or shell.get('withdrawn'):
                return True
            if shell.get('emptyShell') or not shell.get('hasMsgItems'):
                self.log('  스킵: 방 내용 없음 (빈 화면)')
                self._return_to_list()
                return False
            return True
        return False

    def _detect_leave_only_reason(self, item: dict) -> Optional[str]:
        reason = item.get('leave_only_reason')
        if reason:
            return str(reason)
        if item.get('withdrawn'):
            return 'withdrawn_customer'
        shell = verify_chat_room_shell(self.driver)
        if shell.get('peerLeft'):
            return 'peer_left_chat'
        if shell.get('leaveOnly') or shell.get('withdrawn'):
            try:
                body_text = self.driver.execute_script(
                    'return document.body.innerText || "";'
                )
            except Exception:
                body_text = ''
            body_reason = detect_leave_only_reason(body_text)
            if body_reason:
                return body_reason
            return 'withdrawn_customer'
        row_text = item.get('row_text') or item.get('text') or item.get('last_message') or ''
        return detect_leave_only_reason(row_text)

    def _handle_leave_only_chat(
        self,
        queue: dict,
        chat_id: str,
        *,
        reason: str,
        dry_run: bool,
    ) -> str:
        """탈퇴·상대방 나감 — 판정 없이 채팅방 나가기. 반환: left | would | error."""
        label_text = leave_only_log_label(reason)
        self.log(f'  {label_text} — 판정 생략 · 채팅방 나가기')
        label = '나갈 예정' if dry_run else '나가기'
        self.log(f'  {label}: {label_text}')
        verdict_reasons = [reason]
        if dry_run:
            update_queue_item(
                queue,
                chat_id,
                status=STATUS_WOULD_LEAVE,
                verdict_reasons=verdict_reasons,
                leave_only_reason=reason,
                skip_reason=None,
            )
            save_stale_chat_queue(queue)
            return 'would'
        if self.chat_leave.leave_chat_room():
            self.log(f'  → 나가기 완료 ({label_text})')
            update_queue_item(
                queue,
                chat_id,
                status=STATUS_LEFT,
                verdict_reasons=verdict_reasons,
                leave_only_reason=reason,
            )
            save_stale_chat_queue(queue)
            return 'left'
        self.log('  → 나가기 실패 (⋮ 메뉴·확인 모달 확인)')
        update_queue_item(
            queue,
            chat_id,
            status=STATUS_ERROR,
            error=f'{label_text} 나가기 실패',
        )
        save_stale_chat_queue(queue)
        return 'error'

    def _log_room_evaluation(self, verdict: StaleChatVerdict, *, dry_run: bool) -> None:
        opened = verdict.room_opened_at or '미확인'
        self.log(f'  채팅방 개설일: {opened}')
        pref = (verdict.preferred_raw or '').strip() or '없음'
        pref_line = f'  요청날짜: {pref}'
        if verdict.preferred_deadline and pref != '없음':
            pref_line += f' (마감 {verdict.preferred_deadline})'
        self.log(pref_line)
        if verdict.action == 'skip':
            self.log(f'  유지: {verdict.skip_reason or "정리 대상 아님"}')
            return
        reason_text = ' · '.join(REASON_LABELS.get(r, r) for r in verdict.reasons)
        label = '나갈 예정' if dry_run else '나가기'
        self.log(f'  {label}: {reason_text}')

    def _evaluate_chat(self, chat_info: dict, today) -> StaleChatVerdict:
        scroll_chat_room_to_top(self.driver)
        time.sleep(self.delay * 0.35)
        opened_at = extract_chat_room_opened_at(self.driver, today=today)
        request_data = self.request_reader.extract_customer_request()
        preferred_raw = pick_preferred_date_raw_from_request(request_data)
        return evaluate_stale_chat(
            preferred_raw=preferred_raw,
            opened_at=opened_at,
            today=today,
            hired_me=bool(chat_info.get('hired_me')),
            hired_other=bool(chat_info.get('hired_other')),
        )

    def _save_item_verdict(
        self,
        queue: dict,
        chat_id: str,
        verdict: StaleChatVerdict,
        *,
        dry_run: bool,
    ) -> str:
        if verdict.action == 'skip':
            status = STATUS_SKIP
            update_queue_item(
                queue,
                chat_id,
                status=status,
                opened_at=verdict.room_opened_at,
                preferred_raw=verdict.preferred_raw,
                skip_reason=verdict.skip_reason,
                verdict_reasons=[],
            )
        else:
            status = STATUS_WOULD_LEAVE if dry_run else STATUS_LEFT
            update_queue_item(
                queue,
                chat_id,
                status=status,
                opened_at=verdict.room_opened_at,
                preferred_raw=verdict.preferred_raw,
                verdict_reasons=list(verdict.reasons),
                skip_reason=None,
            )
        save_stale_chat_queue(queue)
        return status

    def _process_queue(
        self,
        queue: dict,
        *,
        dry_run: bool,
    ) -> Tuple[int, int, int]:
        pending = get_pending_items(queue)
        total_pending = len(pending)
        if not pending:
            self.log('[3단계] 처리할 pending 항목 없음')
            summary = summarize_results(queue, dry_run=dry_run)
            return summary['left'], summary['would_leave'], summary['skip']

        mode = '미리보기 (나가지 않음)' if dry_run else '실행 (실제 나가기)'
        self.log(f'[3단계] pending {total_pending}개 — {mode}')
        self.log('  입장: 목록 검색 → 클릭 (스크롤 입장 없음)')
        self.log('  처리 순서: 수집 맨 마지막(오래된 채팅)부터')
        today = self._kst_today()
        self.log(f'  기준일(KST): {today.isoformat()}')

        if not self._ensure_chat_list_workspace():
            mark_queue_interrupted(queue)
            return 0, 0, 0

        left_count = 0
        would_count = 0
        skip_count = 0
        self._processed_in_run = 0

        for idx, item in enumerate(pending, 1):
            if not self.running:
                mark_queue_interrupted(queue)
                break

            chat_id = str(item.get('chat_id') or '')
            display_name = item.get('display_name') or item.get('nickname') or chat_id
            self.log(f'[{idx}/{total_pending}] {display_name} (ID: {chat_id})')

            if not self._open_chat_for_item(item):
                if is_login_url(self.driver.current_url):
                    self.log('[세션] 로그아웃 감지 — 큐 저장 후 중단 (이어하기 가능)')
                    mark_queue_interrupted(queue)
                    self.running = False
                    break
                self.log('  방 입장 실패 — error 기록 후 계속')
                update_queue_item(
                    queue, chat_id,
                    status=STATUS_ERROR,
                    error='방 입장 실패',
                )
                save_stale_chat_queue(queue)
                self._return_to_list()
                continue

            self.log('  방 입장')
            time.sleep(self.delay * 0.35)

            leave_only_reason = self._detect_leave_only_reason(item)
            if leave_only_reason:
                outcome = self._handle_leave_only_chat(
                    queue,
                    chat_id,
                    reason=leave_only_reason,
                    dry_run=dry_run,
                )
                if outcome == 'left':
                    left_count += 1
                elif outcome == 'would':
                    would_count += 1
                self._return_to_list()
                if is_login_url(self.driver.current_url):
                    self.log('[세션] 로그아웃 감지 — 큐 저장 후 중단 (이어하기 가능)')
                    mark_queue_interrupted(queue)
                    self.running = False
                    break
                self._processed_in_run += 1
                if self._processed_in_run % BATCH_PAUSE_EVERY == 0:
                    self.log(
                        f'  [휴식] {BATCH_PAUSE_EVERY}건 처리 — '
                        f'{BATCH_PAUSE_SEC:.0f}초 대기'
                    )
                    time.sleep(BATCH_PAUSE_SEC)
                time.sleep(self.delay * 0.15)
                continue

            try:
                verdict = self._evaluate_chat(item, today)
            except Exception as e:
                self.log(f'  판정 오류: {type(e).__name__}')
                update_queue_item(
                    queue, chat_id,
                    status=STATUS_ERROR,
                    error=f'판정 오류: {type(e).__name__}',
                )
                save_stale_chat_queue(queue)
                self._return_to_list()
                continue

            self._log_room_evaluation(verdict, dry_run=dry_run)

            if verdict.action == 'skip':
                skip_count += 1
                self._save_item_verdict(queue, chat_id, verdict, dry_run=dry_run)
                self._return_to_list()
            else:
                would_count += 1
                if dry_run:
                    self._save_item_verdict(queue, chat_id, verdict, dry_run=True)
                    self._return_to_list()
                else:
                    if self.chat_leave.leave_chat_room():
                        left_count += 1
                        self.log(f'  → 나가기 완료 ({left_count}개)')
                        update_queue_item(
                            queue, chat_id,
                            status=STATUS_LEFT,
                            opened_at=verdict.room_opened_at,
                            preferred_raw=verdict.preferred_raw,
                            verdict_reasons=list(verdict.reasons),
                        )
                    else:
                        self.log('  → 나가기 실패 (⋮ 메뉴·확인 모달 확인)')
                        update_queue_item(
                            queue, chat_id,
                            status=STATUS_ERROR,
                            error='나가기 실패',
                        )
                    save_stale_chat_queue(queue)
                    self._return_to_list()

            if is_login_url(self.driver.current_url):
                self.log('[세션] 로그아웃 감지 — 큐 저장 후 중단 (이어하기 가능)')
                mark_queue_interrupted(queue)
                self.running = False
                break

            self._processed_in_run += 1
            if self._processed_in_run % BATCH_PAUSE_EVERY == 0:
                self.log(f'  [휴식] {BATCH_PAUSE_EVERY}건 처리 — {BATCH_PAUSE_SEC:.0f}초 대기')
                time.sleep(BATCH_PAUSE_SEC)

            time.sleep(self.delay * 0.15)

        summary = summarize_results(queue, dry_run=dry_run)
        self.log(
            f'[3단계 완료] 나감 {summary["left"]} · '
            f'{"나갈 예정" if dry_run else "나감"} {summary["would_leave"]} · '
            f'유지 {summary["skip"]} · 남음 {summary["pending"]} · 오류 {summary["error"]}'
        )
        self.log(f'[큐] {get_queue_summary()}')
        return summary['left'], summary['would_leave'], summary['skip']

    def run(self, settings: Optional[dict] = None) -> dict:
        if settings is None:
            settings = {}
        dry_run, max_scrolls, resume, fresh = normalize_leave_stale_settings(settings)
        self.running = True
        result = {'left': 0, 'would_leave': 0, 'skip': 0, 'dry_run': dry_run, 'resumed': resume}

        try:
            label = '미리보기' if dry_run else '실행'
            if resume:
                self.log(f'오래된 채팅 정리 {label} — 이어하기')
            else:
                self.log(f'오래된 채팅 정리 {label} 시작')
                self.log('  ① 목록 스크롤로 ID 수집 → ② 검색으로 한 명씩 입장·판정')
            if not dry_run:
                self.log('⚠ 실제 나가기 — 되돌릴 수 없습니다.')

            self.driver.get(URLS['CHAT_LIST'])
            ensure_soomgo_mobile_layout(self.driver)
            time.sleep(self.delay)
            if not self._wait_for_chat_list_ready():
                self.log('채팅 목록 페이지 로드 실패 — 로그인·URL을 확인하세요.')
                return result

            kst_today = self._kst_today().isoformat()

            if resume:
                queue = load_stale_chat_queue()
                if not queue:
                    self.log('이어할 큐 파일 없음 — 새로 시작하세요.')
                    return result
                pending = get_pending_items(queue)
                if not pending:
                    self.log(f'이어할 pending 없음 — {get_queue_summary()}')
                    summary = summarize_results(queue, dry_run=dry_run)
                    result.update(summary)
                    return result
                queue['dry_run'] = dry_run
                queue['interrupted'] = False
                self._queue = queue
                self.log(f'[이어하기] {get_queue_summary()}')
            else:
                if fresh:
                    clear_stale_chat_queue()
                all_chats = self._collect_all_chats(max_scrolls)
                if not self.running and not all_chats:
                    return result
                self._queue = self._build_queue_from_collection(
                    all_chats, dry_run=dry_run, kst_today=kst_today,
                )
                queue = self._queue

            left, would, skip = self._process_queue(queue, dry_run=dry_run)
            result['left'] = left
            result['would_leave'] = would
            result['skip'] = skip
            result['pending'] = summarize_results(queue, dry_run=dry_run).get('pending', 0)
            self.log(
                f'오래된 채팅 정리 {label} 완료 — '
                f'{"예정" if dry_run else "나감"} {would if dry_run else left} · 유지 {skip}'
            )
            if result.get('pending', 0) > 0:
                self.log(f'미완료 {result["pending"]}건 — 「이어하기」로 계속할 수 있습니다.')
            return result
        except Exception as e:
            self.log(f'오래된 채팅 정리 오류: {e}')
            logger.exception('오래된 채팅 정리 상세 오류')
            if self._queue is not None:
                mark_queue_interrupted(self._queue)
            return result
        finally:
            self.running = False
