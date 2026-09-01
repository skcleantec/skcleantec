"""KST(Asia/Seoul) — Windows 번들 Python에 tzdata가 없을 때 UTC+9 폴백."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

_KST_FALLBACK = timezone(timedelta(hours=9))


def resolve_kst_tz():
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo('Asia/Seoul')
    except Exception:
        return _KST_FALLBACK


KST = resolve_kst_tz()


def kst_today() -> date:
    return datetime.now(KST).date()
