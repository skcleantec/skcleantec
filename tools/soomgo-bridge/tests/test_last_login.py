"""숨고 마지막 로그인 계정 키 비교·저장"""
from __future__ import annotations

import pathlib
import tempfile
import unittest

from automation.last_login import (
    account_key,
    last_login_path,
    read_saved_key,
    session_matches_saved,
    write_saved_key,
)


class LastLoginKeyTests(unittest.TestCase):
    def test_email_key_is_lowercased(self) -> None:
        self.assertEqual(account_key('email', ' Tanaclean@Soomgo.com '), 'email:tanaclean@soomgo.com')

    def test_kakao_without_email(self) -> None:
        self.assertEqual(account_key('kakao', '  '), 'kakao:')

    def test_kakao_with_email(self) -> None:
        self.assertEqual(account_key('kakao', 'A@B.c'), 'kakao:a@b.c')

    def test_unknown_mode_falls_back_to_email(self) -> None:
        self.assertEqual(account_key('sms', 'a@b.c'), 'email:a@b.c')

    def test_reuse_only_when_saved_key_matches(self) -> None:
        self.assertTrue(session_matches_saved('email:a@b.c', 'email:a@b.c'))
        self.assertFalse(session_matches_saved('email:sk@b.c', 'email:a@b.c'))
        self.assertFalse(session_matches_saved(None, 'email:a@b.c'))
        self.assertFalse(session_matches_saved('', 'kakao:'))

    def test_save_and_read_beside_profile_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            profile = pathlib.Path(tmp) / 'chrome-profile'
            profile.mkdir()
            path = last_login_path(profile)
            self.assertEqual(path.name, 'soomgo-last-login.json')
            self.assertEqual(path.parent, pathlib.Path(tmp))
            self.assertIsNone(read_saved_key(path))
            write_saved_key(path, 'email:tana@example.com')
            self.assertEqual(read_saved_key(path), 'email:tana@example.com')

    def test_broken_file_is_missing_key(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / 'soomgo-last-login.json'
            path.write_text('{', encoding='utf-8')
            self.assertIsNone(read_saved_key(path))


if __name__ == '__main__':
    unittest.main()
