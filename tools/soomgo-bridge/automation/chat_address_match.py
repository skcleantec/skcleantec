"""CRM 주소 ↔ 숨고 채팅 목록 지역(serviceRegion) 매칭"""
from __future__ import annotations

import re
from typing import Any

from automation.chat_name_match import is_auto_entry_match

_SIDO_COMPACT: tuple[tuple[str, str], ...] = (
    ('경기', '경기도'),
    ('충북', '충청북도'),
    ('충남', '충청남도'),
    ('전북', '전북특별자치도'),
    ('전남', '전라남도'),
    ('경북', '경상북도'),
    ('경남', '경상남도'),
    ('강원', '강원특별자치도'),
    ('제주', '제주특별자치도'),
)

_ADMIN_UNITS = re.compile(r'[\uac00-\ud7a3\d]+(?:동|읍|면|리|가)')
_CITY_UNITS = re.compile(r'[\uac00-\ud7a3\d]+(?:시|군|구)')


def _strip_spaces(value: str) -> str:
    return re.sub(r'\s+', '', value or '')


def extract_region_text(service_region: str | None) -> str:
    raw = (service_region or '').strip()
    if not raw:
        return ''
    if '•' in raw or '·' in raw:
        parts = re.split(r'[•·]', raw, maxsplit=1)
        raw = parts[-1].strip() if parts else raw
    raw = re.sub(
        r'^(?:이사/입주\s*청소업체|입주/이사\s*청소업체|이사/입주|입주/이사)\s*',
        '',
        raw,
    ).strip()
    return raw


def normalize_address_for_match(value: str) -> str:
    s = _strip_spaces(value)
    for compact, full in _SIDO_COMPACT:
        if not s.startswith(compact):
            continue
        if s.startswith(full):
            break
        if compact == '제주' and s.startswith('제주시'):
            break
        s = full + s[len(compact) :]
        break
    return s.lower()


def score_address_match(crm_address: str, soomgo_region: str | None) -> int:
    crm = normalize_address_for_match(crm_address)
    region = normalize_address_for_match(extract_region_text(soomgo_region))
    if not crm or not region:
        return 0
    if region in crm or crm in region:
        return 6
    score = 0
    for unit in _ADMIN_UNITS.findall(region):
        if unit in crm:
            score += 2
    for unit in _CITY_UNITS.findall(region):
        if unit in crm:
            score += 1
    return score


def pick_best_by_address(candidates: list[dict[str, Any]], address: str | None) -> dict[str, Any] | None:
    if not candidates:
        return None
    if len(candidates) == 1:
        only = candidates[0]
        if is_auto_entry_match(str(only.get('match') or '')):
            return only
        return None

    addr = (address or '').strip()
    if not addr:
        return None

    scored: list[tuple[int, dict[str, Any]]] = []
    for candidate in candidates:
        region = candidate.get('serviceRegion') or candidate.get('regionText')
        scored.append((score_address_match(addr, str(region) if region else None), candidate))

    scored.sort(key=lambda item: item[0], reverse=True)
    best_score, best = scored[0]
    if best_score < 2:
        return None
    if len(scored) > 1 and scored[1][0] == best_score:
        return None
    return best
