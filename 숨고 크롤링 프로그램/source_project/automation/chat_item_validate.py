"""채팅 목록 행·chat_id 유효성 검사."""
from __future__ import annotations

import re
from typing import Dict, List, Tuple

_MIN_CHAT_ID_LEN = 6
_MAX_CHAT_ID_LEN = 12

_LOADING_TEXTS = frozenset({
    '',
    '...',
    '로딩',
    'loading',
    '불러오는 중',
})

_BRAND_NICKNAMES = frozenset({
    '숨고',
    'soomgo',
    '숨고 고수',
})


def is_brand_placeholder_nickname(nickname: str) -> bool:
    name = re.sub(r'\s+', ' ', str(nickname or '').strip())
    if not name:
        return False
    if name in _BRAND_NICKNAMES:
        return True
    return name.lower() in {'soomgo', '숨고'}


def normalize_chat_id(value) -> str | None:
    raw = str(value or '').strip()
    if not raw.isdigit():
        return None
    if len(raw) < _MIN_CHAT_ID_LEN or len(raw) > _MAX_CHAT_ID_LEN:
        return None
    return raw


def row_preview_text(item: dict) -> str:
    parts = (
        item.get('nickname'),
        item.get('text'),
        item.get('last_message'),
        item.get('row_text'),
    )
    for part in parts:
        text = re.sub(r'\s+', ' ', str(part or '').strip())
        if text and text.lower() not in _LOADING_TEXTS:
            return text
    return ''


def has_chat_link_evidence(item: dict, chat_id: str) -> bool:
    href = str(item.get('href') or '')
    if href.startswith(('http', '/')) and f'/pro/chats/{chat_id}' in href:
        return True
    blob = ' '.join(
        str(item.get(key) or '')
        for key in ('text', 'last_message', 'row_text')
    )
    return f'/pro/chats/{chat_id}' in blob


def is_valid_chat_list_item(item: dict) -> bool:
    """목록에서 실제 채팅방 행인지 판별 — 유령·오추출 ID 제외."""
    chat_id = normalize_chat_id(item.get('chat_id'))
    if not chat_id:
        return False

    nickname = re.sub(r'\s+', ' ', str(item.get('nickname') or '').strip())
    preview = row_preview_text(item)
    last_message = re.sub(r'\s+', ' ', str(item.get('last_message') or '').strip())
    updated_at = str(item.get('updated_at') or '').strip()

    if is_brand_placeholder_nickname(nickname):
        if not last_message or last_message == nickname:
            return False
        if len(last_message) < 4:
            return False

    if nickname and not is_brand_placeholder_nickname(nickname):
        return True

    if len(preview) < 4:
        return False

    if last_message or updated_at:
        return True

    if has_chat_link_evidence(item, chat_id):
        return True

    return len(preview) >= 12


def partition_valid_chats(chats: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    valid: List[Dict] = []
    invalid: List[Dict] = []
    for item in chats:
        if is_valid_chat_list_item(item):
            valid.append(item)
        else:
            invalid.append(item)
    return valid, invalid
