"""Open Miso 「대화하기」 tab and scrape chat list rows."""
from __future__ import annotations

import hashlib
import re
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Any

from automation.adb_client import first_online_emulator, get_foreground_package, tap
from automation.anr_guard import dismiss_blocking_dialogs, ensure_emulator_responsive
from automation.uiautomator import (
    collect_nodes,
    dump_ui,
    find_clickable_by_desc_contains,
    launch_miso_app,
    parse_bounds,
    press_back,
    tap_node,
)
from bridge_config import MISO_PACKAGE

KST = timezone(timedelta(hours=9))
_adb_lock = threading.Lock()

LOGIN_HINTS = ('로그인', '휴대폰', '인증번호', '시작하기')


def _now_iso() -> str:
    return datetime.now(KST).isoformat(timespec='seconds')


def _chat_id(raw: str) -> str:
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]


def _parse_status_label(status_line: str) -> str:
    line = status_line.strip()
    if not line:
        return ''
    if '•' in line:
        return line.split('•', 1)[0].strip()
    return line


def parse_list_rows(root) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for n in collect_nodes(root):
        if not n.clickable:
            continue
        d = n.content_desc
        if not d:
            continue
        if ' 고객' not in d and '고객,' not in d:
            continue
        if '•' not in d and '기한' not in d:
            continue
        if d in seen:
            continue
        seen.add(d)
        parts = [p.strip() for p in d.split(',')]
        preview_name = parts[1] if len(parts) > 1 else ''
        last_at = parts[2] if len(parts) > 2 else ''
        preview_message = parts[3] if len(parts) > 3 else ''
        status_line = parts[4] if len(parts) > 4 else ''
        rows.append(
            {
                'chatId': _chat_id(d),
                'title': preview_name or '고객',
                'preview': preview_message or None,
                'updatedAt': last_at or None,
                'updatedAtLabel': last_at or None,
                'unread': False,
                'statusLabel': _parse_status_label(status_line) or status_line or None,
                'rawStatusText': status_line or None,
                'rawContentDesc': d,
                'bounds': n.bounds,
            }
        )
    return rows


def _looks_like_login_screen(root) -> bool:
    blob = '\n'.join(
        f'{n.text}\n{n.content_desc}' for n in collect_nodes(root) if n.text or n.content_desc
    )
    hits = sum(1 for hint in LOGIN_HINTS if hint in blob)
    return hits >= 2


def _on_chat_list(root) -> bool:
    if parse_list_rows(root):
        return True
    for n in collect_nodes(root):
        if '대화하기' in n.content_desc and n.clickable:
            return True
        if n.text == '고객' and n.clickable:
            return True
    return False


def _tap_chat_tab(serial: str | None, root) -> None:
    node = find_clickable_by_desc_contains(root, '대화하기')
    if not node:
        raise RuntimeError('「대화하기」 탭을 찾지 못했습니다. (UI_CHANGED)')
    tap_node(serial, node)
    time.sleep(1.8)


def is_automation_active() -> bool:
    return _adb_lock.locked()


def _open_chats_body(serial: str, *, force_launch: bool = False, gentle: bool = False) -> dict[str, Any]:
    dismiss_blocking_dialogs(serial)
    foreground = get_foreground_package(serial)
    if foreground is None:
        dismiss_blocking_dialogs(serial)
        foreground = get_foreground_package(serial)

    if gentle and foreground == MISO_PACKAGE:
        pass
    elif foreground != MISO_PACKAGE or force_launch:
        launch_miso_app(serial)
        if not gentle and foreground is not None:
            press_back(serial, 2)

    root = dump_ui(serial, 'miso-open-chats')
    if _looks_like_login_screen(root):
        return {
            'ok': False,
            'error': '미소 파트너 앱에 로그인이 필요합니다. 에뮬레이터에서 로그인한 뒤 다시 시도해 주세요.',
            'code': 'MISO_NOT_LOGGED_IN',
            'items': [],
        }

    rows = parse_list_rows(root)
    if not rows and not _on_chat_list(root):
        _tap_chat_tab(serial, root)
        root = dump_ui(serial, 'miso-open-chats-after-tab')
        if _looks_like_login_screen(root):
            return {
                'ok': False,
                'error': '미소 파트너 앱에 로그인이 필요합니다.',
                'code': 'MISO_NOT_LOGGED_IN',
                'items': [],
            }
        rows = parse_list_rows(root)
    elif not rows:
        _tap_chat_tab(serial, root)
        time.sleep(1.2)
        root = dump_ui(serial, 'miso-open-chats-retry')
        rows = parse_list_rows(root)

    if not rows:
        return {
            'ok': False,
            'error': '채팅 목록을 읽지 못했습니다. 「대화하기」 탭·고객 목록을 확인해 주세요.',
            'code': 'UI_CHANGED',
            'items': [],
        }

    return {
        'ok': True,
        'items': rows,
        'count': len(rows),
        'openedAt': _now_iso(),
        'screen': 'chat_list',
    }


def find_row_by_chat_id(rows: list[dict[str, Any]], chat_id: str) -> dict[str, Any] | None:
    return next((r for r in rows if r.get('chatId') == chat_id), None)


def tap_chat_row(serial: str | None, row: dict[str, Any]) -> None:
    bounds = parse_bounds(str(row.get('bounds') or ''))
    if not bounds:
        raise RuntimeError('채팅 행 좌표를 찾지 못했습니다.')
    x1, y1, x2, y2 = bounds
    tap(serial, (x1 + x2) // 2, (y1 + y2) // 2)


def open_chat_by_id(serial: str | None, chat_id: str) -> dict[str, Any]:
    """Go to chat list, tap matching row, return fresh row meta."""
    result = _open_chats_body(serial, gentle=True)
    if not result.get('ok'):
        raise RuntimeError(str(result.get('error') or '채팅 목록을 열 수 없습니다.'))
    rows: list[dict[str, Any]] = list(result.get('items') or [])
    row = find_row_by_chat_id(rows, chat_id)
    if not row:
        root = dump_ui(serial, 'miso-open-chat-by-id')
        rows = parse_list_rows(root)
        row = find_row_by_chat_id(rows, chat_id)
    if not row:
        raise RuntimeError('선택한 채팅을 목록에서 찾지 못했습니다. 「채팅 목록 열기」 후 다시 시도해 주세요.')
    tap_chat_row(serial, row)
    time.sleep(2.2)
    return row


def open_chats(*, force_launch: bool = False) -> dict[str, Any]:
    """Navigate to chat list and return parsed rows."""
    with _adb_lock:
        device = first_online_emulator()
        if not device:
            return {
                'ok': False,
                'error': '에뮬레이터(adb)가 연결되지 않았습니다. run-emulator.bat 실행 후 다시 시도해 주세요.',
                'code': 'BRIDGE_NOT_READY',
                'items': [],
            }
        dismiss_blocking_dialogs(device.serial)
        blocked = ensure_emulator_responsive(device.serial)
        if blocked:
            return {
                'ok': False,
                'error': blocked,
                'code': 'ADB_ANR',
                'items': [],
            }
        return _open_chats_body(device.serial, force_launch=force_launch, gentle=True)
