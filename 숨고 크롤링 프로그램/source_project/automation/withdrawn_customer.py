"""탈퇴·상대방 나감 채팅방 — 판정 생략 후 나가기 대상."""
from __future__ import annotations

from typing import Optional

WITHDRAWN_CUSTOMER_MARKER = '탈퇴한 고객'
PEER_LEFT_CHAT_MARKER = '상대방이 채팅방을 나갔습니다'

LEAVE_ONLY_MARKERS: tuple[tuple[str, str], ...] = (
    (WITHDRAWN_CUSTOMER_MARKER, 'withdrawn_customer'),
    (PEER_LEFT_CHAT_MARKER, 'peer_left_chat'),
)

REASON_LABELS = {
    'withdrawn_customer': '탈퇴한 고객',
    'peer_left_chat': '상대방 나감',
}


def _joined_text(*parts: str) -> str:
    return ' '.join(str(part or '') for part in parts)


def detect_leave_only_reason(*parts: str) -> Optional[str]:
    text = _joined_text(*parts)
    for marker, reason in LEAVE_ONLY_MARKERS:
        if marker in text:
            return reason
    return None


def is_leave_only_list_text(*parts: str) -> bool:
    return detect_leave_only_reason(*parts) is not None


def is_withdrawn_list_text(*parts: str) -> bool:
    """하위 호환 — 탈퇴 또는 상대방 나감."""
    return is_leave_only_list_text(*parts)


def leave_only_log_label(reason: Optional[str]) -> str:
    if reason and reason in REASON_LABELS:
        return REASON_LABELS[reason]
    return '판정 생략 대상'
