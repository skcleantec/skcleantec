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
        '프로필 관리',
        '받은 견적',
        '마이페이지',
        '고용 요청',
        '숨고페이 요청',
        '일정 등록',
        '전체보기',
        '고수 프로필 보기',
        '프로필',
        '채팅 메시지 검색하기',
        '보낸견적 확인하러 가기',
    }
)

_SOOMGO_SIDEBAR_NAV_MARKERS: tuple[str, ...] = (
    '프로필 관리',
    '받은 견적',
    '마이페이지',
    '채팅방 나가기',
    '고객님이 견적을 읽었습니다',
    '고객님이 견적을 확인',
    '견적을 읽었습니다',
    '채팅 메시지 검색하기',
    '숨고 알리미',
    '직접 거래는 사기',
    '피싱 위험',
)

_CHAT_MESSAGE_LINE_RE = re.compile(
    r'^\d{1,2}:\d{2}$|^\d{1,2}:\d{2}\s*$|채팅\d+\+|^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}',
)

_REQUEST_SIGNAL_RE = re.compile(
    r'평|방\s*개수|화장실|베란다|입주|이사|아파트|빌라|원룸|오피스|지역|주소|희망일|원하는\s*날짜|\?',
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
    if any(marker in t for marker in _SOOMGO_SIDEBAR_NAV_MARKERS):
        return True
    if re.fullmatch(r'\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(?:월|화|수|목|금|토|일)?요일?', t):
        return True
    if _CHAT_MESSAGE_LINE_RE.search(t):
        return True
    if re.search(r'\d{1,2}:\d{2}\s*$', t) and len(t) < 48:
        return True
    if len(t) > 100 and ('통신판매' in t or '사기입니다' in t):
        return True
    return False


def is_soomgo_chat_scrape_memo(text: str | None) -> bool:
    """채팅 li 스크랩(가격 협상·전화번호·알리미) 여부."""
    t = (text or '').strip()
    if not t:
        return False
    lines = [line.strip() for line in t.splitlines() if line.strip()]
    if len(lines) < 2:
        return False
    chat_hits = 0
    for line in lines:
        if is_soomgo_boilerplate_line(line):
            chat_hits += 1
            continue
        if _CHAT_MESSAGE_LINE_RE.search(line):
            chat_hits += 1
            continue
        if re.search(r'\d{1,2}:\d{2}', line) and len(line) < 64:
            chat_hits += 1
            continue
        if re.search(r'010[-\s]?\d{4}', line):
            chat_hits += 1
            continue
        if any(marker in line for marker in ('백만원', '현금가', '전화한번', '숨고 알리미', '피싱')):
            chat_hits += 1
    return chat_hits >= 2


def is_soomgo_sidebar_nav_memo(text: str | None) -> bool:
    t = (text or '').strip()
    if not t:
        return False
    hits = sum(1 for marker in _SOOMGO_SIDEBAR_NAV_MARKERS if marker in t)
    if hits >= 2:
        return True
    lines = [line.strip() for line in t.splitlines() if line.strip()]
    if not lines:
        return False
    nav_lines = sum(1 for line in lines if is_soomgo_boilerplate_line(line))
    return nav_lines >= 2 and nav_lines >= max(2, len(lines) // 2)


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


def count_clean_request_pairs(data: dict | None) -> int:
    if not data:
        return 0
    pairs = data.get('requestPairs')
    if not isinstance(pairs, list):
        return 0
    count = 0
    for item in pairs:
        if not isinstance(item, dict):
            continue
        q = str(item.get('question', '')).strip()
        a = str(item.get('answer', '')).strip()
        if is_soomgo_boilerplate_line(a) and is_soomgo_boilerplate_line(q):
            continue
        if not a:
            continue
        count += 1
    return count


def has_meaningful_request_fields(data: dict | None) -> bool:
    if not data:
        return False
    pairs = data.get('requestPairs')
    clean_pairs = 0
    if isinstance(pairs, list):
        for item in pairs:
            if not isinstance(item, dict):
                continue
            q = str(item.get('question', '')).strip()
            a = str(item.get('answer', '')).strip()
            if is_soomgo_boilerplate_line(a) and is_soomgo_boilerplate_line(q):
                continue
            if not a:
                continue
            clean_pairs += 1
    if clean_pairs >= 2:
        return True
    if data.get('roomCount') and data.get('pyeong'):
        return True
    if data.get('region') and data.get('customerName') and clean_pairs >= 1:
        return True
    if data.get('serviceType') and data.get('buildingType') and clean_pairs >= 1:
        return True
    memo = str(data.get('requestMemo') or '').strip()
    if memo and not is_soomgo_sidebar_nav_memo(memo) and not is_soomgo_chat_scrape_memo(memo):
        if _REQUEST_SIGNAL_RE.search(memo):
            return True
    return False


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
    if memo and is_soomgo_sidebar_nav_memo(memo):
        return True
    if '브레이브모바일' in memo and '요청 상세' not in raw:
        return True
    if '프로필 관리' in raw and '마이페이지' in raw and not has_meaningful_request_fields(data):
        return True
    pairs = data.get('requestPairs')
    if isinstance(pairs, list):
        clean_pairs = count_clean_request_pairs(data)
        if clean_pairs == 0 and memo and is_soomgo_sidebar_nav_memo(memo):
            return True
    if count_clean_request_pairs(data) == 0 and not any(
        data.get(key)
        for key in (
            'pyeong',
            'region',
            'customerName',
            'serviceType',
            'roomCount',
            'preferredDate',
            'buildingType',
            'bathroomCount',
            'verandaCount',
        )
    ):
        return True
    return False
