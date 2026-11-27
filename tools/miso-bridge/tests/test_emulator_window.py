"""가상폰 창은 같은 핸들을 한 번만 최소화하고, 연 뒤에는 숨기지 않는다."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import desktop.config as config
import desktop.emulator_window as window
import desktop.single_instance as single


class EmulatorWindowPolicyTest(unittest.TestCase):
    def setUp(self) -> None:
        window.reset_emulator_window_state()
        self._hwnd = 42
        self._iconic = False
        self._minimized: list[int] = []
        self._restored: list[int] = []
        window._find_hwnd = lambda: self._hwnd  # type: ignore[method-assign]
        window._is_iconic = lambda hwnd: self._iconic  # type: ignore[method-assign]
        window._show_window = self._record_minimize  # type: ignore[method-assign]
        window._restore_and_focus = self._record_restore  # type: ignore[method-assign]

    def _record_minimize(self, hwnd: int, cmd: int) -> None:
        self.assertEqual(cmd, window.SW_MINIMIZE)
        self._minimized.append(hwnd)

    def _record_restore(self, hwnd: int, anchor=None) -> None:
        self._restored.append(hwnd)

    def test_same_hwnd_minimized_once(self) -> None:
        self.assertEqual(window.sync_emulator_visibility(), 'minimize')
        self.assertEqual(window.sync_emulator_visibility(), 'leave')
        self.assertEqual(self._minimized, [42])

    def test_user_opened_is_not_minimized(self) -> None:
        window.mark_user_opened()
        self.assertEqual(window.sync_emulator_visibility(), 'leave')
        self.assertEqual(self._minimized, [])

    def test_taskbar_restore_is_not_minimized_again(self) -> None:
        self._iconic = True
        self.assertEqual(window.sync_emulator_visibility(), 'minimize')
        self._iconic = False
        self.assertEqual(window.sync_emulator_visibility(), 'leave')
        self.assertEqual(window.sync_emulator_visibility(), 'leave')
        self.assertEqual(self._minimized, [42])

    def test_bring_to_front_counts_as_user_opened(self) -> None:
        ok, _message = window.bring_emulator_to_front(None)
        self.assertTrue(ok)
        self.assertEqual(window.sync_emulator_visibility(), 'leave')
        self.assertEqual(self._minimized, [])

    def test_always_visible_is_not_minimized(self) -> None:
        self.assertEqual(window.sync_emulator_visibility(always_visible=True), 'leave')
        self.assertEqual(self._minimized, [])

    def test_human_stages_show_instead_of_minimize(self) -> None:
        for stage in ('no_miso', 'miso_logged_out'):
            window.reset_emulator_window_state()
            self._minimized.clear()
            self._restored.clear()
            action = window.sync_emulator_visibility(setup_stage=stage)
            self.assertEqual(action, 'show', stage)
            self.assertEqual(self._minimized, [], stage)
            self.assertEqual(self._restored, [42], stage)
            self.assertEqual(window.sync_emulator_visibility(setup_stage=stage), 'leave')
            self.assertEqual(self._minimized, [], stage)

    def test_automation_does_not_touch_window(self) -> None:
        action = window.sync_emulator_visibility(automation_active=True, setup_stage='no_miso')
        self.assertEqual(action, 'leave')
        self.assertEqual(self._minimized, [])
        self.assertEqual(self._restored, [])

    def test_install_reveal_shows_window(self) -> None:
        action = window.sync_emulator_visibility(install_reveal=True)
        self.assertEqual(action, 'show')
        self.assertEqual(self._minimized, [])
        self.assertEqual(self._restored, [42])


class EmulatorShowRequestTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._root = Path(self._tmp.name)
        self._orig_app = config.APP_DATA_DIR
        self._orig_config = config.CONFIG_PATH
        config.APP_DATA_DIR = self._root
        config.CONFIG_PATH = self._root / 'config.json'

    def tearDown(self) -> None:
        config.APP_DATA_DIR = self._orig_app
        config.CONFIG_PATH = self._orig_config
        self._tmp.cleanup()

    def test_show_request_is_handed_to_tray(self) -> None:
        status, body = single.emulator_show_response(online=True)
        self.assertEqual(status, 200)
        self.assertTrue(body['ok'])
        self.assertTrue((self._root / 'show.emulator').is_file())
        self.assertTrue(single.consume_show_emulator_request())
        self.assertFalse(single.consume_show_emulator_request())

    def test_show_request_when_emulator_off(self) -> None:
        status, body = single.emulator_show_response(online=False)
        self.assertEqual(status, 503)
        self.assertFalse(body['ok'])
        self.assertEqual(body['error'], '가상폰이 켜진 뒤에 화면을 볼 수 있습니다.')
        self.assertFalse((self._root / 'show.emulator').exists())

    def test_always_visible_persists_in_config(self) -> None:
        self.assertFalse(config.emulator_always_visible())
        config.set_emulator_always_visible(True)
        saved = json.loads(config.CONFIG_PATH.read_text(encoding='utf-8'))
        self.assertTrue(saved['emulatorAlwaysVisible'])
        self.assertTrue(config.emulator_always_visible())
        config.set_emulator_always_visible(False)
        self.assertFalse(config.emulator_always_visible())


if __name__ == '__main__':
    unittest.main()
