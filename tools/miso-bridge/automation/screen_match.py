"""미소 화면에서 탭·안내 창을 찾는다. 글자 하나에만 기대지 않는다."""
from __future__ import annotations

import xml.etree.ElementTree as ET

from automation.uiautomator import UiNode, collect_nodes, parse_bounds, tap_node

DISMISS_LABELS = ('닫기', '나중에', '확인')
LOGIN_HINTS = ('로그인', '인증번호', '시작하기')
PAY_HINTS = ('결제하기', '카드 결제', '결제 수단', '결제 금액')
CONSENT_HINTS = ('동의하고', '필수 동의', '개인정보 처리', '약관 동의')
CHAT_TAB_HINTS = ('대화하기', '대화 하기')
PARTNER_ENTRY_HINTS = ('마이페이지', '내 정보')


def _blob(root: ET.Element) -> str:
    return '\n'.join(
        f'{n.text}\n{n.content_desc}' for n in collect_nodes(root) if n.text or n.content_desc
    )


def covering_block_message(root: ET.Element) -> str | None:
    """로그인·결제·동의 창은 누르지 않고, 무엇이 떠 있는지만 알린다."""
    blob = _blob(root)
    login_hits = sum(1 for hint in LOGIN_HINTS if hint in blob)
    if login_hits >= 2 or ('로그인' in blob and '비밀번호' in blob):
        return '미소 로그인이 필요한 창이 열려 있습니다. 가상폰에서 로그인한 뒤 다시 시도해 주세요.'
    if any(hint in blob for hint in PAY_HINTS):
        return '결제 창이 열려 있습니다. 가상폰에서 결제를 마친 뒤 다시 시도해 주세요.'
    if any(hint in blob for hint in CONSENT_HINTS):
        return '동의 창이 열려 있습니다. 가상폰에서 확인한 뒤 다시 시도해 주세요.'
    return None


def _clickable_containing(root: ET.Element, x: int, y: int) -> UiNode | None:
    best: UiNode | None = None
    best_area: int | None = None
    for node in collect_nodes(root):
        if not node.clickable:
            continue
        bounds = parse_bounds(node.bounds)
        if not bounds:
            continue
        x1, y1, x2, y2 = bounds
        if x1 <= x <= x2 and y1 <= y <= y2:
            area = (x2 - x1) * (y2 - y1)
            if best_area is None or area < best_area:
                best = node
                best_area = area
    return best


def find_labeled(root: ET.Element, label: str) -> UiNode | None:
    """같은 글자의 누를 수 있는 칸, 없으면 그 글자를 감싼 칸."""
    for node in collect_nodes(root):
        if node.clickable and (node.text == label or node.content_desc == label) and node.center:
            return node
    for node in collect_nodes(root):
        if node.text == label or node.content_desc == label:
            center = node.center
            if not center:
                continue
            parent = _clickable_containing(root, center[0], center[1])
            if parent:
                return parent
    return None


def dismiss_light_notices(serial: str | None, root: ET.Element) -> bool:
    """닫기·나중에·확인만 닫는다. 로그인·결제·동의 창은 그대로 둔다."""
    if covering_block_message(root):
        return False
    for label in DISMISS_LABELS:
        node = find_labeled(root, label)
        if node:
            tap_node(serial, node)
            return True
    return False


def chat_load_error_message(root: ET.Element) -> str | None:
    blob = _blob(root)
    if '문제가 발생했습니다' in blob or '잠시 후 다시 시도' in blob:
        return (
            '미소 대화 화면에서 「문제가 발생했습니다」가 떠 있습니다. '
            '대화 목록을 불러오지 못했습니다.'
        )
    return None


def find_retry_button(root: ET.Element) -> UiNode | None:
    return find_labeled(root, '다시 시도')


def on_catalog_home(root: ET.Element) -> bool:
    """같은 앱의 서비스 목록. 파트너 하단 탭이 없다."""
    blob = _blob(root)
    if any(hint in blob for hint in CHAT_TAB_HINTS):
        return False
    return '마이페이지' in blob or 'AI 홈' in blob


def find_partner_entry(root: ET.Element) -> UiNode | None:
    for hint in PARTNER_ENTRY_HINTS:
        node = find_labeled(root, hint)
        if node:
            return node
        for candidate in collect_nodes(root):
            if candidate.clickable and hint in f'{candidate.text} {candidate.content_desc}':
                return candidate
    return None


def find_chat_tab(root: ET.Element) -> UiNode | None:
    for node in collect_nodes(root):
        if not node.clickable:
            continue
        blob = f'{node.text} {node.content_desc}'
        if any(hint in blob for hint in CHAT_TAB_HINTS):
            return node
    for hint in CHAT_TAB_HINTS:
        node = find_labeled(root, hint)
        if node:
            return node
    return None
