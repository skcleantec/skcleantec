"""숨고 고객요청 희망일 — 모호·상대 표현 해석 (채팅 개설일 앵커)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

DateKind = Literal['exact', 'range_end', 'relative', 'negotiable', 'unknown']
Confidence = Literal['high', 'medium', 'low']

ROOM_STALE_DAYS = 30
RELATIVE_WEEK_DAYS = 7
RELATIVE_TWO_WEEK_DAYS = 14

_YMD_RE = re.compile(r'(\d{4})[-./](\d{1,2})[-./](\d{1,2})')
_KR_YMD_RE = re.compile(r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일')
_KR_MD_RE = re.compile(r'(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일')
_MD_SLASH_RE = re.compile(r'(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d)')

_NEGOTIABLE_RE = re.compile(
    r'협의|미정|상담\s*후|조율|추후|나중|유동|변동|미정|따로\s*연락|연락\s*주',
    re.I,
)
_RELATIVE_WEEK_RE = re.compile(
    r'일\s*주\s*일?\s*(?:이내|안|안에|내)|1\s*주\s*(?:이내|안|안에|내)|'
    r'일주일\s*(?:이내|안|안에|내)|week',
    re.I,
)
_RELATIVE_TWO_WEEK_RE = re.compile(
    r'2\s*주\s*(?:이내|안|안에|내)|이\s*주\s*일?\s*(?:이내|안|안에|내)|'
    r'보름\s*(?:이내|안)|2주일',
    re.I,
)
_RELATIVE_ASAP_RE = re.compile(
    r'빠른\s*시일|가능한\s*한\s*빨리|최대한\s*빨리|asap|급|당장|바로',
    re.I,
)
_MONTH_MID_RE = re.compile(r'(\d{1,2})\s*월\s*중순(?:\s*이후|\s*쯤|\s*경)?', re.I)
_MONTH_LATE_RE = re.compile(r'(\d{1,2})\s*월\s*하순(?:\s*이후|\s*쯤|\s*경)?', re.I)
_MONTH_EARLY_RE = re.compile(r'(\d{1,2})\s*월\s*상순(?:\s*이후|\s*쯤|\s*경)?', re.I)
_MONTH_ONLY_RE = re.compile(r'(?<!\d)(\d{1,2})\s*월(?:\s*쯤|\s*경|\s*중|\s*내)?(?:\s*이후)?(?!\d\s*일)', re.I)


@dataclass(frozen=True)
class PreferredDateInterpretation:
    raw: str
    kind: DateKind
    deadline: date | None
    confidence: Confidence
    reason: str


def _valid_ymd(y: int, mo: int, d: int) -> date | None:
    if y < 2000 or y > 2100 or mo < 1 or mo > 12 or d < 1 or d > 31:
        return None
    try:
        return date(y, mo, d)
    except ValueError:
        return None


def _year_hint_for_month_day(today: date, month: int, day: int) -> int:
    y = today.year
    candidate = _valid_ymd(y, month, day)
    if candidate is None:
        return y
    if candidate > today + timedelta(days=60):
        return y - 1
    return y


def _last_day_of_month(y: int, mo: int) -> int:
    if mo == 12:
        nxt = date(y + 1, 1, 1)
    else:
        nxt = date(y, mo + 1, 1)
    return (nxt - timedelta(days=1)).day


def _month_part_deadline(today: date, month: int, part: str) -> date | None:
    y = today.year
    if month < today.month - 1:
        y += 1
    last = _last_day_of_month(y, month)
    if part == 'early':
        d = min(10, last)
    elif part == 'mid':
        d = min(20, last)
    elif part == 'late':
        d = last
    else:
        d = last
    return _valid_ymd(y, month, d)


def interpret_preferred_date(
    raw: str | None,
    *,
    opened_at: date | None,
    today: date,
) -> PreferredDateInterpretation:
    text = (raw or '').strip()
    if not text:
        return PreferredDateInterpretation(
            raw='',
            kind='unknown',
            deadline=None,
            confidence='low',
            reason='희망일 없음',
        )

    if _NEGOTIABLE_RE.search(text) and not _YMD_RE.search(text) and not _KR_MD_RE.search(text):
        return PreferredDateInterpretation(
            raw=text,
            kind='negotiable',
            deadline=None,
            confidence='high',
            reason='협의·미정 — 희망일 만료 조건 미적용',
        )

    m = _YMD_RE.search(text) or _KR_YMD_RE.search(text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        deadline = _valid_ymd(y, mo, d)
        if deadline:
            return PreferredDateInterpretation(
                raw=text,
                kind='exact',
                deadline=deadline,
                confidence='high',
                reason=f'명시일 {deadline.isoformat()}',
            )

    m = _KR_MD_RE.search(text)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        y = _year_hint_for_month_day(today, mo, d)
        deadline = _valid_ymd(y, mo, d)
        if deadline:
            return PreferredDateInterpretation(
                raw=text,
                kind='exact',
                deadline=deadline,
                confidence='high',
                reason=f'월일 표기 → {deadline.isoformat()}',
            )

    m = _MD_SLASH_RE.search(text)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        y = _year_hint_for_month_day(today, mo, d)
        deadline = _valid_ymd(y, mo, d)
        if deadline:
            return PreferredDateInterpretation(
                raw=text,
                kind='exact',
                deadline=deadline,
                confidence='medium',
                reason=f'슬래시 월일 → {deadline.isoformat()}',
            )

    for regex, part in (
        (_MONTH_MID_RE, 'mid'),
        (_MONTH_LATE_RE, 'late'),
        (_MONTH_EARLY_RE, 'early'),
    ):
        mm = regex.search(text)
        if mm:
            month = int(mm.group(1))
            deadline = _month_part_deadline(today, month, part)
            if deadline:
                label = {'early': '상순', 'mid': '중순', 'late': '하순'}[part]
                return PreferredDateInterpretation(
                    raw=text,
                    kind='range_end',
                    deadline=deadline,
                    confidence='medium',
                    reason=f'{month}월 {label} → {deadline.isoformat()}',
                )

    mm = _MONTH_ONLY_RE.search(text)
    if mm:
        month = int(mm.group(1))
        y = today.year
        if month < today.month:
            y += 1
        last = _last_day_of_month(y, month)
        deadline = _valid_ymd(y, month, last)
        if deadline:
            return PreferredDateInterpretation(
                raw=text,
                kind='range_end',
                deadline=deadline,
                confidence='medium',
                reason=f'{month}월 말 → {deadline.isoformat()}',
            )

    anchor = opened_at
    if anchor is None:
        return PreferredDateInterpretation(
            raw=text,
            kind='unknown',
            deadline=None,
            confidence='low',
            reason='상대 표현인데 채팅 개설일 없음',
        )

    if _RELATIVE_WEEK_RE.search(text) or _RELATIVE_ASAP_RE.search(text):
        deadline = anchor + timedelta(days=RELATIVE_WEEK_DAYS)
        return PreferredDateInterpretation(
            raw=text,
            kind='relative',
            deadline=deadline,
            confidence='medium',
            reason=f'개설일+7일 → {deadline.isoformat()}',
        )

    if _RELATIVE_TWO_WEEK_RE.search(text):
        deadline = anchor + timedelta(days=RELATIVE_TWO_WEEK_DAYS)
        return PreferredDateInterpretation(
            raw=text,
            kind='relative',
            deadline=deadline,
            confidence='medium',
            reason=f'개설일+14일 → {deadline.isoformat()}',
        )

    return PreferredDateInterpretation(
        raw=text,
        kind='unknown',
        deadline=None,
        confidence='low',
        reason='희망일 파싱 불가',
    )


@dataclass(frozen=True)
class StaleChatVerdict:
    action: Literal['leave', 'skip']
    reasons: tuple[str, ...]
    preferred_raw: str | None
    preferred_deadline: str | None
    preferred_kind: DateKind | None
    preferred_confidence: Confidence | None
    preferred_reason: str | None
    room_opened_at: str | None
    skip_reason: str | None


def evaluate_stale_chat(
    *,
    preferred_raw: str | None,
    opened_at: date | None,
    today: date,
    hired_me: bool = False,
    hired_other: bool = False,
) -> StaleChatVerdict:
    base = {
        'preferred_raw': (preferred_raw or '').strip() or None,
        'preferred_deadline': None,
        'preferred_kind': None,
        'preferred_confidence': None,
        'preferred_reason': None,
        'room_opened_at': opened_at.isoformat() if opened_at else None,
    }

    if hired_me:
        return StaleChatVerdict(
            action='skip',
            reasons=(),
            skip_reason='내 고용 — 나가기 제외',
            **base,
        )
    if hired_other:
        return StaleChatVerdict(
            action='skip',
            reasons=(),
            skip_reason='다른 고수 고용 — 나가기 제외',
            **base,
        )

    reasons: list[str] = []
    interp = interpret_preferred_date(preferred_raw, opened_at=opened_at, today=today)
    base['preferred_deadline'] = interp.deadline.isoformat() if interp.deadline else None
    base['preferred_kind'] = interp.kind
    base['preferred_confidence'] = interp.confidence
    base['preferred_reason'] = interp.reason

    if interp.deadline and interp.confidence != 'low' and today > interp.deadline:
        reasons.append('preferred_date_passed')

    future_preferred = (
        interp.kind != 'negotiable'
        and interp.deadline is not None
        and interp.confidence != 'low'
        and today <= interp.deadline
    )

    if opened_at is not None:
        room_deadline = opened_at + timedelta(days=ROOM_STALE_DAYS)
        if today > room_deadline and not future_preferred:
            reasons.append('room_older_than_30d')

    if reasons:
        return StaleChatVerdict(action='leave', reasons=tuple(reasons), skip_reason=None, **base)

    skip = '정리 대상 아님'
    if future_preferred and opened_at:
        room_deadline = opened_at + timedelta(days=ROOM_STALE_DAYS)
        if today > room_deadline:
            skip = (
                f'희망일 {interp.deadline.isoformat()} 남음 — '
                f'개설 {ROOM_STALE_DAYS}일 초과지만 유지'
            )
    elif interp.kind == 'negotiable' and opened_at:
        room_deadline = opened_at + timedelta(days=ROOM_STALE_DAYS)
        if today <= room_deadline:
            skip = '협의·미정 — 개설 30일 미만'
    return StaleChatVerdict(action='skip', reasons=(), skip_reason=skip, **base)
