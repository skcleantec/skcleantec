"""Dismiss system ANR / blocking dialogs before UI automation."""
from __future__ import annotations

import time

from automation.adb_client import tap
from automation.uiautomator import collect_nodes, dump_ui, find_by_text

ANR_HINTS = ('응답하지 않음', 'Not Responding', 'not responding')
WAIT_LABELS = ('대기', 'Wait')
CLOSE_LABELS = ('앱 닫기', '닫기', 'Close app', 'Close')


def _blob(root) -> str:
    parts: list[str] = []
    for n in collect_nodes(root):
        if n.text:
            parts.append(n.text)
        if n.content_desc:
            parts.append(n.content_desc)
    return '\n'.join(parts)


def anr_blocker_message(root) -> str | None:
    from automation.phone_runtime import phone_is_busy

    if phone_is_busy():
        return '가상폰이 아직 바빠요, 잠시 뒤 다시 확인'
    blob = _blob(root)
    if any(h in blob for h in ANR_HINTS):
        return (
            '에뮬레이터가 「응답 없음」 상태입니다. 에뮬레이터 창에서 「대기」를 누른 뒤 '
            '미소 채팅방을 열고 다시 시도해 주세요.'
        )
    return None


def ensure_emulator_responsive(serial: str | None) -> str | None:
    """Return user-facing error when ANR dialog blocks automation."""
    try:
        root = dump_ui(serial, 'miso-anr-probe')
    except RuntimeError as e:
        msg = str(e).lower()
        if 'timeout' in msg:
            return (
                '에뮬레이터가 응답하지 않습니다. 에뮬레이터를 다시 켠 뒤 '
                '미소 채팅방을 열고 다시 시도해 주세요.'
            )
        return str(e)
    return anr_blocker_message(root)


def _is_close(text: str) -> bool:
    lowered = text.strip().lower()
    return any(label.lower() == lowered for label in CLOSE_LABELS)


def dismiss_blocking_dialogs(serial: str | None) -> bool:
    """「응답하지 않음」이면 「대기」만 누른다. 「앱 닫기」는 누르지 않는다."""
    try:
        root = dump_ui(serial, 'miso-anr-check')
    except RuntimeError:
        return False

    if not anr_blocker_message(root):
        return False

    from automation.phone_runtime import note_anr_wait

    note_anr_wait()
    for label in WAIT_LABELS:
        node = find_by_text(root, label, clickable=True) or find_by_text(root, label)
        if not node or not node.center or _is_close(node.text):
            continue
        tap(serial, node.center[0], node.center[1])
        time.sleep(1.2)
        return True
    return True
