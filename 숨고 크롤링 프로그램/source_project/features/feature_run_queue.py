"""재접촉·이모지/견적조회 — 중지 후 이어하기용 JSON 큐."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from desktop.config import (
    COMBINED_QUEUE_PATH,
    RECONTACT_QUEUE_PATH,
    ensure_app_data,
)

logger = logging.getLogger(__name__)

KST = ZoneInfo('Asia/Seoul')
QUEUE_VERSION = 1

FEATURE_RECONTACT = 'recontact'
FEATURE_COMBINED = 'combined'

STATUS_PENDING = 'pending'
STATUS_DONE = 'done'
STATUS_ERROR = 'error'

TERMINAL_STATUSES = frozenset({STATUS_DONE, STATUS_ERROR})

_QUEUE_PATHS = {
    FEATURE_RECONTACT: RECONTACT_QUEUE_PATH,
    FEATURE_COMBINED: COMBINED_QUEUE_PATH,
}


def _now_iso() -> str:
    return datetime.now(KST).isoformat(timespec='seconds')


def queue_file_path(feature: str):
    return _QUEUE_PATHS[feature]


def load_feature_queue(feature: str) -> Optional[dict]:
    path = queue_file_path(feature)
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(raw, dict) and isinstance(raw.get('items'), list):
            return raw
    except Exception as exc:
        logger.warning('load_feature_queue(%s): %s', feature, exc)
    return None


def save_feature_queue(feature: str, queue: dict) -> None:
    ensure_app_data()
    queue['feature'] = feature
    queue['updated_at'] = _now_iso()
    path = queue_file_path(feature)
    path.write_text(
        json.dumps(queue, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


def clear_feature_queue(feature: str) -> None:
    path = queue_file_path(feature)
    if path.is_file():
        path.unlink(missing_ok=True)


def create_queue_from_chats(feature: str, chats: List[Dict]) -> dict:
    items: List[dict] = []
    for chat in chats:
        chat_id = str(chat.get('chat_id') or '').strip()
        if not chat_id:
            continue
        items.append(
            {
                'chat_id': chat_id,
                'nickname': chat.get('nickname') or '',
                'display_name': chat.get('display_name')
                or chat.get('nickname')
                or f'ID:{chat_id}',
                'match_type': chat.get('match_type') or 'keyword',
                'matched_keyword': chat.get('matched_keyword') or '',
                'row_text': chat.get('row_text') or '',
                'status': STATUS_PENDING,
                'error': None,
                'processed_at': None,
            }
        )
    return {
        'version': QUEUE_VERSION,
        'feature': feature,
        'created_at': _now_iso(),
        'updated_at': _now_iso(),
        'interrupted': False,
        'phase': 'process',
        'processed_tracker': None,
        'items': items,
    }


def get_pending_items(queue: dict) -> List[dict]:
    items = queue.get('items') or []
    return [item for item in items if item.get('status') == STATUS_PENDING]


def has_resumable_queue(feature: str) -> bool:
    queue = load_feature_queue(feature)
    if not queue:
        return False
    return len(get_pending_items(queue)) > 0


def get_queue_summary(feature: str) -> str:
    queue = load_feature_queue(feature)
    if not queue:
        return '큐 없음'
    items = queue.get('items') or []
    pending = len(get_pending_items(queue))
    total = len(items)
    done = total - pending
    label = '재접촉' if feature == FEATURE_RECONTACT else '이모지/견적'
    return f'{label} 완료 {done}/{total} · 남음 {pending}'


def find_queue_item(queue: dict, chat_id: str) -> Optional[dict]:
    cid = str(chat_id or '').strip()
    for item in queue.get('items') or []:
        if str(item.get('chat_id') or '') == cid:
            return item
    return None


def mark_item_done(queue: dict, chat_id: str) -> None:
    item = find_queue_item(queue, chat_id)
    if not item:
        return
    item['status'] = STATUS_DONE
    item['processed_at'] = _now_iso()
    item['error'] = None


def mark_item_error(queue: dict, chat_id: str, error: str) -> None:
    item = find_queue_item(queue, chat_id)
    if not item:
        return
    item['status'] = STATUS_ERROR
    item['error'] = (error or '')[:200]
    item['processed_at'] = _now_iso()


def mark_queue_interrupted(queue: dict, feature: str) -> None:
    queue['interrupted'] = True
    queue['interrupted_at'] = _now_iso()
    save_feature_queue(feature, queue)


def pending_to_chat_infos(queue: dict) -> List[Dict]:
    infos: List[Dict] = []
    for item in get_pending_items(queue):
        infos.append(
            {
                'chat_id': item.get('chat_id'),
                'nickname': item.get('nickname') or '',
                'display_name': item.get('display_name') or '',
                'match_type': item.get('match_type') or 'keyword',
                'matched_keyword': item.get('matched_keyword') or '',
                'row_text': item.get('row_text') or '',
            }
        )
    return infos


def tracker_export_state(tracker) -> dict:
    tracker._check_date_reset()
    processed = {}
    for nickname, row in (tracker.processed_today or {}).items():
        processed[nickname] = dict(row)
    return {
        'current_date': tracker.current_date.isoformat(),
        'processed_today': processed,
        'emoji_count': int(tracker.emoji_count or 0),
        'quote_count': int(tracker.quote_count or 0),
    }


def tracker_import_state(tracker, data: Optional[dict]) -> None:
    if not data:
        return
    try:
        raw_date = data.get('current_date')
        if raw_date:
            tracker.current_date = date.fromisoformat(str(raw_date))
    except (TypeError, ValueError):
        tracker.current_date = date.today()
    tracker.processed_today = {}
    for nickname, row in (data.get('processed_today') or {}).items():
        if nickname and isinstance(row, dict):
            tracker.processed_today[str(nickname)] = dict(row)
    tracker.emoji_count = int(data.get('emoji_count') or 0)
    tracker.quote_count = int(data.get('quote_count') or 0)


def attach_tracker_to_queue(queue: dict, tracker) -> None:
    queue['processed_tracker'] = tracker_export_state(tracker)


def restore_tracker_from_queue(tracker, queue: dict) -> None:
    tracker_import_state(tracker, queue.get('processed_tracker'))


def save_queue_with_tracker(feature: str, queue: dict, tracker=None) -> None:
    if tracker is not None and feature == FEATURE_COMBINED:
        attach_tracker_to_queue(queue, tracker)
    save_feature_queue(feature, queue)


def finalize_queue_if_complete(feature: str, queue: dict) -> bool:
    """pending 없으면 큐 삭제. True = 전부 완료."""
    if get_pending_items(queue):
        return False
    clear_feature_queue(feature)
    return True
