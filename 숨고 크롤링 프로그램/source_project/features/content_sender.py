"""채팅방 내 이미지·텍스트 순차 전송 공통 로직"""

import os
import re
import time
from typing import Callable, Dict, List, Optional

from automation.chat_room import ChatRoomManager
from automation.selectors import SYSTEM_MESSAGES

IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.bmp')


def normalize_hired_me_marker(text: str) -> str:
    """감지 문구에서 띄어쓰기 제거"""
    return re.sub(r'\s+', '', (text or '').strip())


def contains_hired_me(*texts: str, marker: str = None) -> bool:
    """띄어쓰기 무시하고 감지 문구 포함 여부 (이미 고용된 고객 배지 감지)"""
    normalized_marker = normalize_hired_me_marker(
        marker if marker is not None else SYSTEM_MESSAGES['HIRED_ME']
    )
    if not normalized_marker:
        return False
    for text in texts:
        if not text:
            continue
        if normalized_marker in normalize_hired_me_marker(text):
            return True
    return False


def contains_hired_other(*texts: str, marker: str = None) -> bool:
    """띄어쓰기 무시하고 '다른 고수 고용' 배지/시스템 문구 포함 여부"""
    normalized_marker = normalize_hired_me_marker(
        marker if marker is not None else SYSTEM_MESSAGES['HIRED_OTHER']
    )
    if not normalized_marker:
        return False
    for text in texts:
        if not text:
            continue
        normalized_text = normalize_hired_me_marker(text)
        if normalized_marker in normalized_text:
            return True
        # UI 변형: "다른 고수를 고용함" / "다른고수고용" 등
        if '다른고수' in normalized_text and '고용' in normalized_text:
            return True
    return False


def normalize_hired_me_settings(settings: dict) -> tuple[str, bool]:
    """내 고용 제외 필터 설정 정규화"""
    enabled = bool(settings.get('hired_me_enabled', True))
    filter_text = (
        settings.get('hired_me_filter_text') or SYSTEM_MESSAGES['HIRED_ME']
    ).strip() or SYSTEM_MESSAGES['HIRED_ME']
    return filter_text, enabled


def get_numeric_image_folders(images_folder: str) -> List[int]:
    if not os.path.isdir(images_folder):
        return []
    folders = []
    for name in os.listdir(images_folder):
        folder_path = os.path.join(images_folder, name)
        if os.path.isdir(folder_path) and name.isdigit():
            folders.append(int(name))
    return sorted(folders)


def get_folder_images(images_folder: str, folder_num: int) -> List[str]:
    folder_path = os.path.join(images_folder, str(folder_num))
    if not os.path.isdir(folder_path):
        return []
    images = []
    for filename in sorted(os.listdir(folder_path)):
        if filename.lower().endswith(IMAGE_EXTENSIONS):
            images.append(os.path.join(folder_path, filename))
    return images


def normalize_recontact_content(settings: dict) -> tuple[Dict[str, str], List[str]]:
    """
    재접촉 설정을 texts + send_order 형식으로 정규화.
    기존 message 단일 필드 설정과 하위 호환.
    """
    texts = dict(settings.get('texts') or {})
    send_order = list(settings.get('send_order') or [])
    legacy_message = (settings.get('message') or '').strip()

    if not texts and legacy_message:
        texts = {'텍스트1': legacy_message}

    if not texts and not send_order and legacy_message:
        texts = {'텍스트1': legacy_message}

    if not send_order and texts:
        send_order = [
            key
            for key in sorted(
                texts.keys(),
                key=lambda k: int(k.replace('텍스트', '')) if k.replace('텍스트', '').isdigit() else 0,
            )
        ]

    if not send_order and legacy_message:
        send_order = ['텍스트1']

    return texts, send_order


def normalize_hired_other_content(settings: dict) -> tuple[Dict[str, str], List[str], str, bool]:
    """다른 고수 고용 분기 설정 정규화"""
    enabled = bool(settings.get('hired_other_enabled', False))
    system_message = (
        settings.get('hired_other_system_message') or SYSTEM_MESSAGES['HIRED_OTHER']
    ).strip()

    texts = dict(settings.get('hired_other_texts') or {})
    send_order = list(settings.get('hired_other_send_order') or [])

    if not send_order and texts:
        send_order = [
            key
            for key in sorted(
                texts.keys(),
                key=lambda k: int(k.replace('텍스트', '')) if k.replace('텍스트', '').isdigit() else 0,
            )
        ]

    return texts, send_order, system_message, enabled


def has_sendable_content(
    texts: Dict[str, str],
    send_order: List[str],
    images_folder: str,
) -> bool:
    for item_name in send_order:
        if item_name.startswith('이미지폴더'):
            try:
                folder_num = int(item_name.replace('이미지폴더', ''))
            except ValueError:
                continue
            if get_folder_images(images_folder, folder_num):
                return True
        elif item_name.startswith('텍스트'):
            if texts.get(item_name, '').strip():
                return True
    return False


def process_send_order(
    chat_room: ChatRoomManager,
    texts: Dict[str, str],
    send_order: List[str],
    images_folder: str,
    delay: float,
    log: Callable[[str], None],
    test_mode: bool = False,
) -> bool:
    """전송 순서에 따라 이미지 폴더·텍스트를 순차 전송"""
    try:
        success = True
        for item_name in send_order:
            if not success and not test_mode:
                break

            if item_name.startswith('이미지폴더'):
                try:
                    folder_num = int(item_name.replace('이미지폴더', ''))
                except ValueError:
                    log(f'잘못된 이미지 폴더 이름: {item_name}')
                    continue

                images = get_folder_images(images_folder, folder_num)
                if test_mode:
                    log(f'[테스트] {item_name} 전송 예정: {len(images)}장')
                    continue
                if not images:
                    continue
                if not chat_room.upload_images(images):
                    log(f'이미지 폴더{folder_num} 업로드 실패')
                    success = False
                time.sleep(delay)
                continue

            if not item_name.startswith('텍스트'):
                continue

            text_content = texts.get(item_name, '').strip()
            if not text_content:
                continue

            if test_mode:
                preview = text_content[:30] + '...' if len(text_content) > 30 else text_content
                log(f'[테스트] {item_name} 전송 예정: "{preview}"')
                continue

            if not chat_room.send_message(text_content):
                log(f'{item_name} 전송 실패')
                success = False
            time.sleep(1)

        return success
    except Exception as e:
        log(f'채팅방 내용 전송 오류: {e}')
        return False
