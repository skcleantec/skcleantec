"""preferred_date_parser 단위 테스트."""
from __future__ import annotations

import unittest
from datetime import date

from automation.preferred_date_parser import (
    ROOM_STALE_DAYS,
    evaluate_stale_chat,
    interpret_preferred_date,
)


class PreferredDateParserTests(unittest.TestCase):
    def test_exact_iso(self) -> None:
        r = interpret_preferred_date('2026-03-15', opened_at=date(2026, 3, 1), today=date(2026, 3, 16))
        self.assertEqual(r.deadline, date(2026, 3, 15))
        self.assertEqual(r.kind, 'exact')

    def test_korean_md(self) -> None:
        r = interpret_preferred_date('3월 15일', opened_at=date(2026, 3, 1), today=date(2026, 3, 1))
        self.assertEqual(r.deadline, date(2026, 3, 15))

    def test_relative_week_from_opened(self) -> None:
        opened = date(2026, 8, 10)
        r = interpret_preferred_date(
            '일주일 안에 청소 원합니다',
            opened_at=opened,
            today=date(2026, 8, 18),
        )
        self.assertEqual(r.deadline, date(2026, 8, 17))
        self.assertEqual(r.kind, 'relative')

    def test_negotiable(self) -> None:
        r = interpret_preferred_date(
            '협의 또는 기타: 9월 중순 이후',
            opened_at=date(2026, 8, 1),
            today=date(2026, 8, 20),
        )
        self.assertEqual(r.kind, 'negotiable')
        self.assertIsNone(r.deadline)

    def test_month_mid(self) -> None:
        r = interpret_preferred_date('9월 중순 이후', opened_at=date(2026, 8, 1), today=date(2026, 8, 1))
        self.assertEqual(r.kind, 'range_end')
        self.assertEqual(r.deadline, date(2026, 9, 20))

    def test_evaluate_week_passed(self) -> None:
        opened = date(2026, 8, 10)
        v = evaluate_stale_chat(
            preferred_raw='일주일 이내로 진행하고 싶어요',
            opened_at=opened,
            today=date(2026, 8, 18),
        )
        self.assertEqual(v.action, 'leave')
        self.assertIn('preferred_date_passed', v.reasons)

    def test_evaluate_room_30d(self) -> None:
        opened = date(2026, 7, 1)
        v = evaluate_stale_chat(
            preferred_raw='협의',
            opened_at=opened,
            today=date(2026, 8, 1),
        )
        self.assertEqual(v.action, 'leave')
        self.assertIn('room_older_than_30d', v.reasons)

    def test_evaluate_negotiable_young_room_skip(self) -> None:
        opened = date(2026, 8, 1)
        v = evaluate_stale_chat(
            preferred_raw='협의',
            opened_at=opened,
            today=date(2026, 8, 15),
        )
        self.assertEqual(v.action, 'skip')

    def test_hired_other_skip(self) -> None:
        v = evaluate_stale_chat(
            preferred_raw='2020-01-01',
            opened_at=date(2020, 1, 1),
            today=date(2026, 8, 18),
            hired_other=True,
        )
        self.assertEqual(v.action, 'skip')

    def test_room_stale_constant(self) -> None:
        self.assertEqual(ROOM_STALE_DAYS, 30)


if __name__ == '__main__':
    unittest.main()
