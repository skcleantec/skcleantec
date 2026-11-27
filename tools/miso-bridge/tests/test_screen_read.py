"""화면 읽기 실패는 다시 시도하고, 6.2611.1 화면은 목록 오류로 구분한다."""
from __future__ import annotations

import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

import automation.uiautomator as ui
from automation.chat_extract import is_chat_detail
from automation.chat_list import parse_list_rows
from automation.screen_match import (
    chat_load_error_message,
    dismiss_light_notices,
    find_chat_tab,
)
from automation.uiautomator import ScreenReadError

FIXTURE = Path(__file__).resolve().parent / 'fixtures' / 'chat-screen-6.2611.1.xml'

LIST_ROW_XML = """<?xml version="1.0" encoding="utf-8"?>
<hierarchy rotation="0">
  <node text="" content-desc="가, 가*나 고객, 11월 1일 10:00, 안내 문구, 기한 만료 • 입주청소 11월 2일"
        clickable="true" bounds="[0,500][1080,700]" class="android.view.ViewGroup" />
</hierarchy>
"""


class DumpRetryTest(unittest.TestCase):
    def setUp(self) -> None:
        self._sleeps: list[float] = []
        ui.time.sleep = lambda seconds: self._sleeps.append(seconds)  # type: ignore[method-assign]
        ui.release_uiautomator = lambda serial: None  # type: ignore[method-assign]

    def test_failed_dump_retries_then_screen_read_failed(self) -> None:
        calls = {'n': 0}

        def shell_result(serial, command, timeout=30.0):
            calls['n'] += 1
            return 0, 'ERROR: could not get idle state.', ''

        ui.shell_result = shell_result  # type: ignore[method-assign]
        with self.assertRaises(ScreenReadError) as caught:
            ui.dump_ui('emulator-5554', 'miso-test')
        self.assertEqual(caught.exception.code, 'SCREEN_READ_FAILED')
        self.assertIn('화면을 읽지 못했습니다', str(caught.exception))
        self.assertEqual(calls['n'], 3)
        self.assertEqual(self._sleeps.count(1.5), 2)

    def test_second_dump_is_used(self) -> None:
        calls = {'n': 0}

        def shell_result(serial, command, timeout=30.0):
            calls['n'] += 1
            if calls['n'] == 1:
                return 0, 'ERROR: could not get idle state.', ''
            return 0, 'UI hierchary dumped to: /sdcard/miso-test.xml', ''

        def pull_file(serial, remote, local):
            local.write_text(
                '<?xml version="1.0"?><hierarchy><node text="대화" /></hierarchy>',
                encoding='utf-8',
            )

        ui.shell_result = shell_result  # type: ignore[method-assign]
        ui.pull_file = pull_file  # type: ignore[method-assign]
        root = ui.dump_ui('emulator-5554', 'miso-test')
        self.assertEqual(calls['n'], 2)
        self.assertEqual(root.find('node').get('text'), '대화')


class ChatScreenFixtureTest(unittest.TestCase):
    def setUp(self) -> None:
        self.root = ET.parse(FIXTURE).getroot()

    def test_chat_tab_is_the_clickable_badge_label(self) -> None:
        tab = find_chat_tab(self.root)
        self.assertIsNotNone(tab)
        assert tab is not None
        self.assertTrue(tab.clickable)
        self.assertIn('대화하기', tab.content_desc)
        self.assertNotEqual(tab.text, '대화하기')

    def test_error_panel_is_not_a_changed_list(self) -> None:
        message = chat_load_error_message(self.root)
        self.assertIsNotNone(message)
        assert message is not None
        self.assertIn('문제가 발생했습니다', message)
        self.assertEqual(parse_list_rows(self.root), [])
        self.assertFalse(is_chat_detail(self.root))

    def test_close_button_is_tapped_and_payment_is_not(self) -> None:
        tapped: list[str] = []

        def tap_node(serial, node):
            tapped.append(node.text or node.content_desc)

        import automation.screen_match as screen

        screen.tap_node = tap_node  # type: ignore[method-assign]
        notice = ET.fromstring(
            '<hierarchy><node text="닫기" content-desc="" clickable="true" bounds="[10,10][80,40]"/></hierarchy>'
        )
        self.assertTrue(screen.dismiss_light_notices(None, notice))
        self.assertEqual(tapped, ['닫기'])
        payment = ET.fromstring(
            '<hierarchy>'
            '<node text="결제하기" content-desc="" clickable="true" bounds="[10,10][80,40]"/>'
            '<node text="확인" content-desc="" clickable="true" bounds="[10,50][80,90]"/>'
            '</hierarchy>'
        )
        self.assertFalse(screen.dismiss_light_notices(None, payment))
        self.assertEqual(tapped, ['닫기'])

    def test_placeholder_list_row_parses_without_a_real_name(self) -> None:
        root = ET.fromstring(LIST_ROW_XML)
        rows = parse_list_rows(root)
        self.assertEqual(len(rows), 1)
        self.assertIn('고객', rows[0]['title'])
        self.assertEqual(rows[0]['statusLabel'], '기한 만료')
        self.assertNotIn('010', rows[0]['rawContentDesc'])
