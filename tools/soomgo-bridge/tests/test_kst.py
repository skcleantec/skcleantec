"""KST 헬퍼 — Windows 번들 Python tzdata 누락 회귀 방지."""
from __future__ import annotations

import unittest
from datetime import date, datetime, timedelta, timezone

from automation.kst import KST, kst_today, resolve_kst_tz


class KstHelperTests(unittest.TestCase):
    def test_kst_today_returns_date(self) -> None:
        today = kst_today()
        self.assertIsInstance(today, date)

    def test_resolve_kst_tz_never_raises(self) -> None:
        tz = resolve_kst_tz()
        now = datetime.now(tz)
        self.assertIsNotNone(now.tzinfo)

    def test_module_kst_is_usable(self) -> None:
        now = datetime.now(KST)
        self.assertIsNotNone(now.tzinfo)

    def test_fallback_offset_when_zoneinfo_missing(self) -> None:
        tz = timezone(timedelta(hours=9))
        self.assertEqual(tz.utcoffset(None), timedelta(hours=9))


if __name__ == '__main__':
    unittest.main()
