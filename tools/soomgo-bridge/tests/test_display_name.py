"""이름 칸은 특수문자를 그대로 두고, 이름 칸이 없으면 지역명을 이름으로 쓰지 않는다."""
from __future__ import annotations

import json
import shutil
import subprocess
import unittest

from automation.selectors import SOOMGO_DISPLAY_NAME_JS


def _js(expr: str):
    node = shutil.which('node')
    if not node:
        raise unittest.SkipTest('node 없음')
    script = SOOMGO_DISPLAY_NAME_JS + f'\nprocess.stdout.write(JSON.stringify({expr}));'
    out = subprocess.check_output([node, '-e', script], text=True, encoding='utf-8')
    return json.loads(out)


class DisplayNameTests(unittest.TestCase):
    def test_name_slot_keeps_special_characters(self) -> None:
        for raw in ['민지♡', '김ㅇㅇ', 'Kim_J', '🌸수진', '(주)한빛', '박 지 영']:
            got = _js(f'pickSoomgoCustomerName({json.dumps(raw)}, [])')
            self.assertEqual(got, ' '.join(raw.split()), raw)

    def test_region_only_lines_are_not_a_name(self) -> None:
        lines = ['인천 연수구', '청소업체 · 서울', '이사/입주 청소 원하세요?']
        got = _js(f'pickSoomgoCustomerName(null, {json.dumps(lines)})')
        self.assertIsNone(got)

    def test_system_phrase_in_name_slot_is_dropped(self) -> None:
        self.assertIsNone(_js('pickSoomgoCustomerName("고객", ["인천 연수구"])'))
        self.assertIsNone(_js('pickSoomgoCustomerName("3시간 전", ["민지♡"])'))


if __name__ == '__main__':
    unittest.main()
