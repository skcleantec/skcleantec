"""오래된 숨고 채팅방 — 판정·전체 목록 스캔·나가기."""
from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from automation.chat_list_enumerate import enumerate_chat_list
from automation.chat_room import ChatRoomManager
from automation.chat_room_leave import leave_current_chat_room
from automation.chat_room_opened_at import extract_chat_room_opened_at
from automation.customer_request import CustomerRequestManager, pick_preferred_date_raw_from_request
from automation.login import goto_chat_list
from automation.navigation import ensure_chat_workspace, open_chat_room_by_id
from automation.preferred_date_parser import StaleChatVerdict, evaluate_stale_chat

logger = logging.getLogger(__name__)

KST = ZoneInfo('Asia/Seoul')


def _kst_today() -> datetime.date:
    return datetime.now(KST).date()


def _verdict_to_dict(
    chat_id: str,
    nickname: str | None,
    verdict: StaleChatVerdict,
    *,
    dry_run: bool,
    left: bool = False,
    error: str | None = None,
) -> dict[str, Any]:
    action = verdict.action
    if dry_run and action == 'leave':
        action = 'would_leave'
    if left:
        action = 'left'
    if error:
        action = 'failed'
    return {
        'chatId': chat_id,
        'nickname': nickname,
        'action': action,
        'reasons': list(verdict.reasons),
        'skipReason': verdict.skip_reason,
        'preferredDateRaw': verdict.preferred_raw,
        'preferredDeadline': verdict.preferred_deadline,
        'preferredKind': verdict.preferred_kind,
        'preferredConfidence': verdict.preferred_confidence,
        'preferredReason': verdict.preferred_reason,
        'roomOpenedAt': verdict.room_opened_at,
        'error': error,
    }


def evaluate_current_chat_room(
    driver,
    *,
    delay: float = 0.45,
    list_hints: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """현재 열린 채팅방 1건 판정."""
    room = ChatRoomManager(driver, delay=delay)
    if not room.is_in_chat_room():
        return {'ok': False, 'error': '채팅방이 열려 있지 않습니다.'}

    chat_id = room.get_current_chat_id() or ''
    nickname = room.get_nickname()
    today = _kst_today()

    hints = list_hints or {}
    hired_me = bool(hints.get('hiredMe'))
    hired_other = bool(hints.get('hiredOther')) or room.detect_hired_other()

    opened_at = extract_chat_room_opened_at(driver, today=today)

    req_mgr = CustomerRequestManager(driver, delay=delay)
    request_data = req_mgr.extract_customer_request() or {}
    preferred_raw = pick_preferred_date_raw_from_request(request_data)

    verdict = evaluate_stale_chat(
        preferred_raw=preferred_raw,
        opened_at=opened_at,
        today=today,
        hired_me=hired_me,
        hired_other=hired_other,
    )
    return {
        'ok': True,
        'chatId': chat_id,
        'nickname': nickname,
        'verdict': verdict,
        'item': _verdict_to_dict(chat_id, nickname, verdict, dry_run=True),
    }


def scan_stale_chats(
    driver,
    *,
    dry_run: bool = True,
    limit: int | None = None,
    offset: int = 0,
    delay: float = 0.45,
) -> dict[str, Any]:
    """채팅 목록 전체 스캔 — dry-run 또는 실제 나가기."""
    today = _kst_today()
    if not goto_chat_list(driver, force_list=True):
        return {'ok': False, 'error': '숨고 채팅 목록으로 이동하지 못했습니다.'}

    rows = enumerate_chat_list(driver, delay=delay * 0.8)
    total = len(rows)
    start = max(0, int(offset or 0))
    end = total if limit is None else min(total, start + max(1, int(limit)))
    batch = rows[start:end]

    items: list[dict[str, Any]] = []
    left_count = 0
    would_count = 0
    skip_count = 0
    fail_count = 0

    for row in batch:
        chat_id = str(row.get('chatId') or '')
        nickname = row.get('nickname')
        if not chat_id.isdigit():
            continue

        if not open_chat_room_by_id(driver, chat_id, delay=delay):
            fail_count += 1
            items.append({
                'chatId': chat_id,
                'nickname': nickname,
                'action': 'failed',
                'error': '채팅방을 열지 못했습니다.',
                'reasons': [],
            })
            continue

        time.sleep(delay * 0.5)
        eval_res = evaluate_current_chat_room(driver, delay=delay, list_hints=row)
        if not eval_res.get('ok'):
            fail_count += 1
            items.append({
                'chatId': chat_id,
                'nickname': nickname,
                'action': 'failed',
                'error': eval_res.get('error') or 'evaluate_failed',
                'reasons': [],
            })
            continue

        verdict: StaleChatVerdict = eval_res['verdict']
        if verdict.action == 'skip':
            skip_count += 1
            items.append(_verdict_to_dict(chat_id, nickname, verdict, dry_run=dry_run))
            goto_chat_list(driver, force_list=False)
            time.sleep(delay * 0.35)
            continue

        would_count += 1
        if dry_run:
            items.append(_verdict_to_dict(chat_id, nickname, verdict, dry_run=True))
            goto_chat_list(driver, force_list=False)
            time.sleep(delay * 0.35)
            continue

        ok_leave, leave_err = leave_current_chat_room(driver, delay=delay)
        if ok_leave:
            left_count += 1
            items.append(_verdict_to_dict(chat_id, nickname, verdict, dry_run=False, left=True))
        else:
            fail_count += 1
            items.append(
                _verdict_to_dict(
                    chat_id,
                    nickname,
                    verdict,
                    dry_run=False,
                    error=leave_err or 'leave_failed',
                ),
            )
        ensure_chat_workspace(driver, delay=delay, force_list=True)
        time.sleep(delay * 0.4)

    return {
        'ok': True,
        'dryRun': dry_run,
        'today': today.isoformat(),
        'totalListed': total,
        'offset': start,
        'processed': len(batch),
        'summary': {
            'left': left_count,
            'wouldLeave': would_count if dry_run else would_count,
            'skipped': skip_count,
            'failed': fail_count,
        },
        'items': items,
    }


def leave_current_if_stale(
    driver,
    *,
    dry_run: bool = True,
    delay: float = 0.45,
) -> dict[str, Any]:
    """현재 채팅방 — 판정 후 (dry-run이 아니면) 나가기."""
    eval_res = evaluate_current_chat_room(driver, delay=delay)
    if not eval_res.get('ok'):
        return eval_res

    verdict: StaleChatVerdict = eval_res['verdict']
    chat_id = str(eval_res.get('chatId') or '')
    nickname = eval_res.get('nickname')

    if verdict.action == 'skip' or dry_run:
        return {
            'ok': True,
            'dryRun': dry_run,
            'left': False,
            'item': _verdict_to_dict(chat_id, nickname, verdict, dry_run=dry_run),
        }

    ok_leave, leave_err = leave_current_chat_room(driver, delay=delay)
    return {
        'ok': ok_leave,
        'dryRun': False,
        'left': ok_leave,
        'error': leave_err,
        'item': _verdict_to_dict(
            chat_id,
            nickname,
            verdict,
            dry_run=False,
            left=ok_leave,
            error=leave_err,
        ),
    }
