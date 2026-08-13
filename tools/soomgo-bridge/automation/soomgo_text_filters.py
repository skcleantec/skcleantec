"""숨고 UI·법적 고지·메뉴 문구 필터 — 추출 오염 방지."""
from __future__ import annotations

import re

_SOOMGO_BOILERPLATE_MARKERS: tuple[str, ...] = (
    '브레이브모바일',
    '통신판매중개자',
    '거래당사자',
    '공공기관 사칭',
    '100% 사기',
    '전자세금계산서',
    '공식 번호로 직접 확인',
)

_SOOMGO_UI_CHROME_LINES: frozenset[str] = frozenset(
    {
        '고객 요청',
        '고객 요청 보기',
        '요청 상세',
        '알림 끄기',
        '신고하기',
        '채팅방 나가기',
        '인터넷',
    }
)

_REGION_BAD_MARKERS = re.compile(
    r'브레이브|통신판매|사기|기관|주식|거래당|세금계산서|확인하세요|개별 판매',
)
_REGION_HINT = re.compile(
    r'^[가-힣0-9\s·\-]+(?:시|군|구)(?:\s+[가-힣0-9\s·\-]+(?:구|동|읍|면|리|로|길))?'
)


def is_soomgo_boilerplate_line(text: str | None) -> bool:
    t = (text or '').strip()
    if not t:
        return True
    if t in _SOOMGO_UI_CHROME_LINES:
        return True
    if any(marker in t for marker in _SOOMGO_BOILERPLATE_MARKERS):
        return True
    if len(t) > 100 and ('통신판매' in t or '사기입니다' in t):
        return True
    return False


def is_plausible_soomgo_region(text: str | None) -> bool:
    t = (text or '').strip()
    if not t or is_soomgo_boilerplate_line(t):
        return False
    if len(t) < 4 or len(t) > 40:
        return False
    if _REGION_BAD_MARKERS.search(t):
        return False
    return bool(_REGION_HINT.search(t))


def filter_soomgo_memo_lines(lines: list[str]) -> list[str]:
    out: list[str] = []
    for raw in lines:
        line = raw.strip()
        if not line or is_soomgo_boilerplate_line(line):
            continue
        out.append(line)
    return out


def is_garbage_request_extract(data: dict | None) -> bool:
    if not data:
        return True
    region = str(data.get('region') or '').strip()
    memo = str(data.get('requestMemo') or '').strip()
    raw = str(data.get('requestRawText') or '').strip()
    if region and not is_plausible_soomgo_region(region):
        return True
    if memo and is_soomgo_boilerplate_line(memo.split('\n', 1)[0]):
        return True
    if '브레이브모바일' in memo and '요청 상세' not in raw:
        return True
    pairs = data.get('requestPairs')
    if isinstance(pairs, list):
        clean_pairs = 0
        for item in pairs:
            if not isinstance(item, dict):
                continue
            a = str(item.get('answer', '')).strip()
            q = str(item.get('question', '')).strip()
            if is_soomgo_boilerplate_line(a) and is_soomgo_boilerplate_line(q):
                continue
            clean_pairs += 1
        if clean_pairs == 0 and (memo or region):
            return True
    return False
