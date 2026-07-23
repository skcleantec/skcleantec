"""Dismiss system ANR / blocking dialogs before UI automation."""
from __future__ import annotations

import time

from automation.adb_client import tap
from automation.uiautomator import collect_nodes, dump_ui, find_by_text

ANR_HINTS = ('응답하지 않음', 'Not Responding', 'not responding')
WAIT_LABELS = ('대기', 'Wait')


def _blob(root) -> str:
    parts: list[str] = []
    for n in collect_nodes(root):
        if n.text:
            parts.append(n.text)
        if n.content_desc:
            parts.append(n.content_desc)
    return '\n'.join(parts)


def anr_blocker_message(root) -> str | None:
    blob = _blob(root)
    if any(h in blob for h in ANR_HINTS):
        return (
            '에뮬레이터가 「응답 없음」 상태입니다. 에뮬레이터 창에서 「대기」를 누르거나 '
            'AVD를 재시작(Cold Boot)한 뒤, 미소 **채팅방**을 연 뒤 「미소 정보」를 다시 실행해 주세요. '
            '(16KB page size AVD는 미소 앱이 자주 멈출 수 있습니다 — API 34 Play 이미지 권장)'
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
                '에뮬레이터 adb가 응답하지 않습니다. AVD를 재시작한 뒤 '
                '미소 채팅방을 연 뒤 다시 시도해 주세요.'
            )
        return str(e)
    return anr_blocker_message(root)


def dismiss_blocking_dialogs(serial: str | None) -> bool:
    """Tap 「대기」 on system ANR when possible. Returns True if a blocker was handled."""
    try:
        root = dump_ui(serial, 'miso-anr-check')
    except RuntimeError:
        return False

    if not anr_blocker_message(root):
        return False

    for label in WAIT_LABELS:
        node = find_by_text(root, label, clickable=True)
        if node and node.center:
            tap(serial, node.center[0], node.center[1])
            time.sleep(1.2)
            return True
        node = find_by_text(root, label)
        if node and node.center:
            tap(serial, node.center[0], node.center[1])
            time.sleep(1.2)
            return True

    tap(serial, 540, 1398)
    time.sleep(1.2)
    return True
