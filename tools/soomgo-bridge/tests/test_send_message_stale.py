"""메시지 전송 중 입력창이 다시 그려져도 같은 글을 다시 보내지 않는다."""
from __future__ import annotations

import unittest

from selenium.common.exceptions import StaleElementReferenceException

import automation.chat_room as chat_room
from automation.chat_room import (
    SEND_UNCONFIRMED_MESSAGE,
    ChatRoomManager,
    _SEND_MESSAGE_JS,
)


class InputElem:
    def __init__(self, value: str = '', stale_reads: int = 0):
        self.value = value
        self.text = ''
        self.stale_reads = stale_reads
        self.clicks = 0
        self.rect = {'x': 0, 'y': 400, 'width': 200, 'height': 40}

    def is_displayed(self) -> bool:
        return True

    def get_attribute(self, name: str):
        if name == 'value' and self.stale_reads > 0:
            self.stale_reads -= 1
            raise StaleElementReferenceException('input redrawn')
        if name == 'value':
            return self.value
        return ''

    def click(self) -> None:
        self.clicks += 1

    def send_keys(self, *_args) -> None:
        return None


class FakeDriver:
    def __init__(self, input_elem: InputElem, *, fail_first_script: bool = False, bubbles: list[str] | None = None):
        self.input_elem = input_elem
        self.fail_first_script = fail_first_script
        self.bubbles = bubbles or []
        self.send_calls = 0
        self.scripts: list[str] = []

    def execute_script(self, script, *_args):
        self.scripts.append(script)
        if self.fail_first_script:
            self.fail_first_script = False
            raise StaleElementReferenceException('before send')
        if script == _SEND_MESSAGE_JS:
            self.send_calls += 1
            return {'ok': True}
        if isinstance(script, str) and 'textAlign' in script:
            return list(self.bubbles)
        return None

    def find_elements(self, _by, selector: str):
        if 'textarea[name="message-input"]' in selector:
            return [self.input_elem]
        return []


class SendMessageStaleTests(unittest.TestCase):
    def setUp(self) -> None:
        self._pause = chat_room.STALE_RETRY_PAUSE_SEC
        chat_room.STALE_RETRY_PAUSE_SEC = 0

    def tearDown(self) -> None:
        chat_room.STALE_RETRY_PAUSE_SEC = self._pause

    def test_stale_after_send_is_success_when_input_is_empty(self) -> None:
        driver = FakeDriver(InputElem(value='', stale_reads=2))
        ok, err = ChatRoomManager(driver, delay=0).send_message('안녕하세요')
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(driver.send_calls, 1)

    def test_stale_before_send_retries_once(self) -> None:
        driver = FakeDriver(InputElem(value=''), fail_first_script=True)
        ok, err = ChatRoomManager(driver, delay=0).send_message('안녕하세요')
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(driver.send_calls, 1)

    def test_uncertain_after_send_does_not_resend(self) -> None:
        driver = FakeDriver(InputElem(value='안녕하세요', stale_reads=99), bubbles=['다른 말'])
        ok, err = ChatRoomManager(driver, delay=0).send_message('안녕하세요')
        self.assertFalse(ok)
        self.assertEqual(err, SEND_UNCONFIRMED_MESSAGE)
        self.assertNotIn('stale element', err or '')
        self.assertEqual(driver.send_calls, 1)


if __name__ == '__main__':
    unittest.main()
