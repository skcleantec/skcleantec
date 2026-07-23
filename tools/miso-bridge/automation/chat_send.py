"""Send a chat message in Miso partner app."""
from __future__ import annotations

import time
from typing import Any

from automation.adb_client import first_online_emulator
from automation.chat_extract import _ensure_chat_detail, is_chat_detail
from automation.chat_list import _adb_lock, _now_iso
from automation.text_input import type_into_field
from automation.uiautomator import collect_nodes, dump_ui, find_clickable_by_desc_contains, tap_node


def find_message_input(root):
    for n in collect_nodes(root):
        blob = f'{n.text} {n.content_desc}'.strip()
        if '메시지' in blob and ('입력' in blob or '입력해' in blob):
            return n
    for n in collect_nodes(root):
        if n.text == '메시지를 입력해주세요':
            return n
    return None


def find_send_button(root):
    for n in collect_nodes(root):
        if n.content_desc == 'send' and n.clickable:
            return n
    return find_clickable_by_desc_contains(root, 'send')


def send_chat_message(*, message: str, chat_id: str | None = None) -> dict[str, Any]:
    text = message.strip()
    if not text:
        return {'ok': False, 'error': 'message 필드가 필요합니다.', 'code': 'BAD_REQUEST'}

    with _adb_lock:
        device = first_online_emulator()
        if not device:
            return {
                'ok': False,
                'error': '에뮬레이터(adb)가 연결되지 않았습니다.',
                'code': 'BRIDGE_NOT_READY',
            }

        serial = device.serial
        try:
            _resolved, chat_root = _ensure_chat_detail(serial, chat_id)
        except RuntimeError as e:
            return {'ok': False, 'error': str(e), 'code': 'UI_CHANGED'}

        if chat_root is None:
            return {
                'ok': False,
                'error': '채팅방을 연 뒤 메시지를 보내 주세요. (또는 chatId 전달)',
                'code': 'NO_CHAT_SELECTED',
            }

        root = chat_root
        input_node = find_message_input(root)
        if not input_node:
            root = dump_ui(serial, 'miso-send-check')
            input_node = find_message_input(root)
        if not input_node:
            return {
                'ok': False,
                'error': '채팅 입력창을 찾지 못했습니다. 채팅방 화면인지 확인해 주세요.',
                'code': 'UI_CHANGED',
            }

        tap_node(serial, input_node)
        time.sleep(0.4)
        try:
            type_into_field(serial, text)
        except RuntimeError as e:
            return {
                'ok': False,
                'error': f'메시지 입력 실패: {e}',
                'code': 'UI_CHANGED',
            }
        time.sleep(0.3)

        root = dump_ui(serial, 'miso-send-ready')
        send_btn = find_send_button(root)
        if send_btn:
            tap_node(serial, send_btn)
        else:
            shell_enter(serial)
        time.sleep(0.8)

        after = dump_ui(serial, 'miso-send-after')
        if not is_chat_detail(after):
            return {
                'ok': False,
                'error': '전송 후 채팅 화면을 확인하지 못했습니다.',
                'code': 'UI_CHANGED',
            }

        return {
            'ok': True,
            'sentAt': _now_iso(),
            'message': text,
            'chatId': chat_id,
        }


def shell_enter(serial: str | None) -> None:
    from automation.adb_client import shell

    shell(serial, 'input keyevent 66')
