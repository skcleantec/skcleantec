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

CHAT_NOT_FOUND_MESSAGE = '선택한 채팅방을 찾지 못했습니다. 채팅 목록을 다시 열어 주세요.'
CHAT_REQUIRED_MESSAGE = '보낼 채팅방을 먼저 고르세요.'
DUPLICATE_CHAT_MESSAGE = '같은 이름 채팅이 여러 개'

_UNREAD_RE = re.compile(r'^(?:\d+|안\s*읽음|읽지\s*않음)$')
_CLOCK_RE = re.compile(r'\d{1,2}:\d{2}')
_DATE_RE = re.compile(r'\d+월\s*\d+일(?:\s*\([^)]+\))?')
_PRICE_RE = re.compile(r'[￦₩].*$')


class MisoChatError(RuntimeError):
    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.code = code


def _now_iso() -> str:
    return datetime.now(KST).isoformat(timespec='seconds')


def normalize_customer_name(raw: str) -> str:
    name = re.sub(r'\s*고객\s*$', '', (raw or '').strip())
    return re.sub(r'\s+', ' ', name).strip()


def canonical_service_summary(text: str) -> str:
    """지역·유형·서비스일. 마지막 메시지·시각·안읽음은 넣지 않는다."""
    blob = _PRICE_RE.sub('', re.sub(r'\s+', ' ', (text or '')).strip()).strip()
    found = _DATE_RE.search(blob)
    date = ''
    type_part = blob
    if found:
        date = re.sub(r'\s+', '', found.group(0))
        type_part = f'{blob[: found.start()]} {blob[found.end() :]}'
    type_part = re.sub(r'\s+', ' ', type_part).strip(' •·-')
    return ' '.join(part for part in (type_part, date) if part)


def service_summary_from_status(status_line: str) -> str:
    line = (status_line or '').strip()
    tail = line.split('•', 1)[1].strip() if '•' in line else ''
    return canonical_service_summary(tail)


def stable_chat_id(name: str, summary: str) -> str:
    key = f'{normalize_customer_name(name)}|{canonical_service_summary(summary)}'
    return hashlib.sha256(key.encode('utf-8')).hexdigest()[:16]


def _chat_id(raw: str) -> str:
    """전체 문구 해시. 목록 구분값에는 쓰지 않는다."""
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
        parts = [p.strip() for p in d.split(',') if p.strip()]
        preview_name = next((p for p in parts if '고객' in p and not _CLOCK_RE.search(p)), parts[1] if len(parts) > 1 else '')
        last_at = next(
            (p for p in parts if _CLOCK_RE.search(p) and '•' not in p and '고객' not in p),
            parts[2] if len(parts) > 2 else '',
        )
        status_line = next((p for p in parts if '•' in p), parts[4] if len(parts) > 4 else '')
        preview_message = next(
            (
                p
                for p in parts
                if p not in (preview_name, last_at, status_line)
                and not _UNREAD_RE.match(p)
                and '고객' not in p
            ),
            '',
        )
        unread = any(_UNREAD_RE.match(p) for p in parts) or '안읽음' in d or '안 읽음' in d
        summary = service_summary_from_status(status_line)
        rows.append(
            {
                'chatId': stable_chat_id(preview_name, summary),
                'title': preview_name or '고객',
                'preview': preview_message or None,
                'updatedAt': last_at or None,
                'updatedAtLabel': last_at or None,
                'unread': unread,
                'statusLabel': _parse_status_label(status_line) or status_line or None,
                'rawStatusText': status_line or None,
                'serviceSummary': summary,
                'rawContentDesc': d,
                'bounds': n.bounds,
            }
        )
    by_id: dict[str, int] = {}
    for row in rows:
        by_id[row['chatId']] = by_id.get(row['chatId'], 0) + 1
    if any(count > 1 for count in by_id.values()):
        raise MisoChatError(DUPLICATE_CHAT_MESSAGE, 'DUPLICATE_CHAT')
    return rows


def _looks_like_login_screen(root) -> bool:
    blob = '\n'.join(
        f'{n.text}\n{n.content_desc}' for n in collect_nodes(root) if n.text or n.content_desc
    )
    hits = sum(1 for hint in LOGIN_HINTS if hint in blob)
    return hits >= 2


def _on_chat_list(root) -> bool:
    try:
        if parse_list_rows(root):
            return True
    except MisoChatError:
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

    try:
        rows = parse_list_rows(root)
    except MisoChatError as e:
        return {'ok': False, 'error': str(e), 'code': e.code, 'items': []}
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
        try:
            rows = parse_list_rows(root)
        except MisoChatError as e:
            return {'ok': False, 'error': str(e), 'code': e.code, 'items': []}
    elif not rows:
        _tap_chat_tab(serial, root)
        time.sleep(1.2)
        root = dump_ui(serial, 'miso-open-chats-retry')
        try:
            rows = parse_list_rows(root)
        except MisoChatError as e:
            return {'ok': False, 'error': str(e), 'code': e.code, 'items': []}

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
        raise MisoChatError(
            str(result.get('error') or CHAT_NOT_FOUND_MESSAGE),
            str(result.get('code') or 'CHAT_NOT_FOUND'),
        )
    rows: list[dict[str, Any]] = list(result.get('items') or [])
    row = find_row_by_chat_id(rows, chat_id)
    if not row:
        root = dump_ui(serial, 'miso-open-chat-by-id')
        rows = parse_list_rows(root)
        row = find_row_by_chat_id(rows, chat_id)
    if not row:
        raise MisoChatError(CHAT_NOT_FOUND_MESSAGE, 'CHAT_NOT_FOUND')
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
                'error': '에뮬레이터가 연결되지 않았습니다. PC에서 「청소비서 미소 연동」을 켠 뒤 다시 시도해 주세요.',
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
