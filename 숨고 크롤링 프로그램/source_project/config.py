"""
설정 관리 모듈
- 아이디/비밀번호 저장 및 로드
- JSON 파일 기반 설정 저장
"""
import json
import os
import sys
from pathlib import Path


def _get_config_file() -> Path:
    """실행 파일 위치(EXE) 또는 소스 폴더의 config.json 경로"""
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent / 'config.json'
    return Path(__file__).parent / 'config.json'

DEFAULT_CONFIG = {
    'email': '',
    'password': '',
    'save_credentials': False,
    'delay_seconds': 1.5,
    'recontact': {
        'keyword': '',
        'message': '',
        'period': '오늘',
        'texts': {'텍스트1': ''},
        'send_order': ['텍스트1'],
        'hired_me_enabled': True,
        'hired_me_filter_text': '내 고용',
        'hired_other_enabled': False,
        'hired_other_system_message': '다른 고수를 고용함',
        'hired_other_texts': {'텍스트1': ''},
        'hired_other_send_order': ['텍스트1'],
    },
    'combined': {
        'emoji_enabled': True,
        'emoji': '',
        'emoji_images': [],
        'emoji_text1': '',
        'emoji_text2': '',
        'quote_enabled': True,
        'quote_images': [],
        'quote_text1': '',
        'interval': '1분',
    },
    'leave_hired_other': {
        'detection_text': '다른 고수를 고용함',
        'max_scrolls': 100,
    },
}


def load_config() -> dict:
    """설정 파일 로드"""
    config_file = _get_config_file()
    if not config_file.exists():
        return DEFAULT_CONFIG.copy()

    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        for key, value in DEFAULT_CONFIG.items():
            if key not in config:
                config[key] = value
        return config
    except (json.JSONDecodeError, OSError):
        return DEFAULT_CONFIG.copy()


def save_config(config: dict) -> bool:
    """설정 파일 저장"""
    try:
        with open(_get_config_file(), 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except OSError:
        return False


def get_credentials() -> tuple[str, str]:
    """저장된 로그인 정보 반환"""
    config = load_config()
    if config.get('save_credentials'):
        return (config.get('email', ''), config.get('password', ''))
    return ('', '')


def save_credentials(email: str, password: str, save: bool = True) -> None:
    """로그인 정보 저장"""
    config = load_config()
    config['save_credentials'] = save
    if save:
        config['email'] = email
        config['password'] = password
    else:
        config['email'] = ''
        config['password'] = ''
    save_config(config)