"""숨고 채팅 목록 — 고객명/닉네임 정확도 매칭"""
from __future__ import annotations

import re

_HAS_NAME_CHAR = re.compile(r'[\uac00-\ud7a3a-z]', re.I)


def normalize_chat_query(value: str) -> str:
    s = re.sub(r'\s+', ' ', (value or '').strip())
    s = re.sub(r'^내\s*고용\s*', '', s, flags=re.I)
    return s.lower()


def build_chat_query_aliases(nickname: str | None, customer_name: str | None = None) -> list[str]:
    aliases: list[str] = []
    for raw in (nickname, customer_name):
        norm = normalize_chat_query(raw or '')
        if len(norm) < 2:
            continue
        if norm not in aliases:
            aliases.append(norm)
    return aliases


def classify_name_match(query_aliases: list[str], candidate_name: str) -> str | None:
    nn = normalize_chat_query(candidate_name)
    if not nn or len(nn) < 2:
        return None
    for want in query_aliases:
        if nn == want:
            return 'exact'
    for want in query_aliases:
        if len(want) < 2:
            continue
        if nn.startswith(want):
            suffix = nn[len(want) :]
            if not suffix or not _HAS_NAME_CHAR.search(suffix):
                return 'partial'
        if want.startswith(nn) and len(nn) >= max(2, int(len(want) * 0.75)):
            return 'partial'
    return None


def is_auto_entry_match(match: str | None) -> bool:
    return match == 'exact'
