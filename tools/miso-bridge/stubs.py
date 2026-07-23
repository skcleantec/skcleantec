"""Stub API payloads until automation motions are wired."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))


def _now_iso() -> str:
    return datetime.now(KST).isoformat(timespec='seconds')


def stub_not_implemented(action: str) -> dict:
    return {
        'ok': False,
        'error': f'{action} — 아직 연결되지 않았습니다 (브릿지 골격 단계).',
        'code': 'NOT_IMPLEMENTED',
        'phase': 'skeleton',
    }


def stub_open_chats() -> dict:
    return {
        **stub_not_implemented('open-chats'),
        'items': [],
    }


def stub_extract() -> dict:
    return {
        **stub_not_implemented('extract'),
        'source': 'miso',
        'extractedAt': _now_iso(),
    }


def stub_send_message(message: str) -> dict:
    return {
        **stub_not_implemented('send-message'),
        'message': message,
    }
