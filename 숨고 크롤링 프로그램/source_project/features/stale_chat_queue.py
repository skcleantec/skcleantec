"""오래된 채팅 정리 — JSON 큐 저장·이어하기."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from desktop.config import STALE_CHAT_QUEUE_PATH, ensure_app_data

logger = logging.getLogger(__name__)

KST = ZoneInfo('Asia/Seoul')
QUEUE_VERSION = 1

STATUS_PENDING = 'pending'
STATUS_SKIP_HIRED = 'skip_hired'
STATUS_SKIP = 'skip'
STATUS_WOULD_LEAVE = 'would_leave'
STATUS_LEFT = 'left'
STATUS_ERROR = 'error'

TERMINAL_STATUSES = frozenset({
    STATUS_SKIP_HIRED,
    STATUS_SKIP,
    STATUS_WOULD_LEAVE,
    STATUS_LEFT,
    STATUS_ERROR,
})


def _now_iso() -> str:
    return datetime.now(KST).isoformat(timespec='seconds')


def queue_file_path():
    return STALE_CHAT_QUEUE_PATH


def load_stale_chat_queue() -> Optional[dict]:
    path = queue_file_path()
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(raw, dict) and isinstance(raw.get('items'), list):
            return raw
    except Exception as e:
        logger.warning('load_stale_chat_queue: %s', e)
    return None


def save_stale_chat_queue(queue: dict) -> None:
    ensure_app_data()
    queue['updated_at'] = _now_iso()
    path = queue_file_path()
    path.write_text(
        json.dumps(queue, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


def clear_stale_chat_queue() -> None:
    path = queue_file_path()
    if path.is_file():
        path.unlink(missing_ok=True)


def create_queue_from_chats(
    chats: List[Dict],
    *,
    dry_run: bool,
    kst_today: str,
) -> dict:
    items: List[dict] = []
    for chat in chats:
        chat_id = str(chat.get('chat_id') or '').strip()
        if not chat_id:
            continue
        items.append({
            'chat_id': chat_id,
            'nickname': chat.get('nickname') or chat.get('display_name') or '',
            'display_name': chat.get('display_name') or chat.get('nickname') or f'ID:{chat_id}',
            'collect_seq': int(chat.get('collect_seq', 0)),
            'hired_me': bool(chat.get('hired_me')),
            'hired_other': bool(chat.get('hired_other')),
            'leave_only_reason': chat.get('leave_only_reason'),
            'withdrawn': bool(chat.get('withdrawn') or chat.get('leave_only_reason')),
            'status': STATUS_PENDING,
            'opened_at': None,
            'preferred_raw': None,
            'verdict_reasons': [],
            'skip_reason': None,
            'error': None,
            'processed_at': None,
        })
    return {
        'version': QUEUE_VERSION,
        'dry_run': dry_run,
        'kst_today': kst_today,
        'created_at': _now_iso(),
        'updated_at': _now_iso(),
        'interrupted': False,
        'phase': 'process',
        'items': items,
    }


def apply_list_hired_prefilter(queue: dict) -> int:
    """목록 배지만으로 스킵 — 방 입장 없음."""
    count = 0
    for item in queue.get('items') or []:
        if item.get('status') != STATUS_PENDING:
            continue
        if item.get('hired_me'):
            item['status'] = STATUS_SKIP_HIRED
            item['skip_reason'] = '내 고용 — 나가기 제외 (목록 배지)'
            item['processed_at'] = _now_iso()
            count += 1
        elif item.get('hired_other'):
            item['status'] = STATUS_SKIP_HIRED
            item['skip_reason'] = '다른 고수 고용 — 나가기 제외 (목록 배지)'
            item['processed_at'] = _now_iso()
            count += 1
    return count


def get_pending_items(queue: dict) -> List[dict]:
    """pending — collect_seq 큰 것(목록 맨 아래·오래된)부터."""
    items = queue.get('items') or []
    pending = [item for item in items if item.get('status') == STATUS_PENDING]
    pending.sort(key=lambda row: int(row.get('collect_seq', 0)), reverse=True)
    return pending


def has_resumable_queue() -> bool:
    queue = load_stale_chat_queue()
    if not queue:
        return False
    return len(get_pending_items(queue)) > 0


def get_queue_summary() -> str:
    queue = load_stale_chat_queue()
    if not queue:
        return '큐 없음'
    counts = count_by_status(queue)
    pending = counts.get(STATUS_PENDING, 0)
    total = len(queue.get('items') or [])
    done = total - pending
    return f'완료 {done}/{total} · 남음 {pending}'


def count_by_status(queue: dict) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for item in queue.get('items') or []:
        status = str(item.get('status') or STATUS_PENDING)
        counts[status] = counts.get(status, 0) + 1
    return counts


def find_queue_item(queue: dict, chat_id: str) -> Optional[dict]:
    cid = str(chat_id or '').strip()
    for item in queue.get('items') or []:
        if str(item.get('chat_id') or '') == cid:
            return item
    return None


def update_queue_item(queue: dict, chat_id: str, **fields: Any) -> None:
    item = find_queue_item(queue, chat_id)
    if not item:
        return
    item.update(fields)
    if fields.get('status') in TERMINAL_STATUSES and not item.get('processed_at'):
        item['processed_at'] = _now_iso()


def mark_queue_interrupted(queue: dict) -> None:
    queue['interrupted'] = True
    queue['interrupted_at'] = _now_iso()
    save_stale_chat_queue(queue)


def summarize_results(queue: dict, *, dry_run: bool) -> dict:
    counts = count_by_status(queue)
    left = counts.get(STATUS_LEFT, 0)
    would = counts.get(STATUS_WOULD_LEAVE, 0)
    skip = (
        counts.get(STATUS_SKIP, 0)
        + counts.get(STATUS_SKIP_HIRED, 0)
    )
    return {
        'left': left,
        'would_leave': would,
        'skip': skip,
        'pending': counts.get(STATUS_PENDING, 0),
        'error': counts.get(STATUS_ERROR, 0),
        'dry_run': dry_run,
    }
