"""마지막 숨고 로그인 계정 — chrome-profile 부모 폴더의 soomgo-last-login.json"""
from __future__ import annotations

import json
import pathlib

LAST_LOGIN_FILENAME = 'soomgo-last-login.json'


def account_key(mode: str, email: str) -> str:
    """요청 계정 키. 카카오이고 이메일이 없으면 kakao:"""
    mode_norm = (mode or 'email').strip().lower()
    if mode_norm not in ('email', 'kakao'):
        mode_norm = 'email'
    email_norm = (email or '').strip().lower()
    if mode_norm == 'kakao' and not email_norm:
        return 'kakao:'
    return f'{mode_norm}:{email_norm}'


def last_login_path(profile_dir: pathlib.Path) -> pathlib.Path:
    return profile_dir.parent / LAST_LOGIN_FILENAME


def read_saved_key(path: pathlib.Path) -> str | None:
    try:
        raw = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return None
    if not isinstance(raw, dict):
        return None
    key = raw.get('key')
    if not isinstance(key, str):
        return None
    trimmed = key.strip()
    return trimmed or None


def write_saved_key(path: pathlib.Path, key: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'key': key}, ensure_ascii=False), encoding='utf-8')


def session_matches_saved(saved_key: str | None, request_key: str) -> bool:
    return bool(saved_key) and saved_key == request_key
