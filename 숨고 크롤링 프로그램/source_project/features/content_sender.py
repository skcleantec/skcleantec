"""채팅방 내 이미지·텍스트 순차 전송 공통 로직"""

import os
import re
import time
from typing import Callable, Dict, List, Optional

from automation.chat_room import ChatRoomManager, _should_use_cdp_input
from automation.selectors import SYSTEM_MESSAGES

IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.bmp')
SEND_ORDER_MAX_ATTEMPTS = 3


def normalize_message_for_send(text: str) -> str:
    """숨고 입력창용 — 마크다운 볼드(**) 등은 표시되지 않으므로 제거"""
    cleaned = re.sub(r'\*\*([^*]+)\*\*', r'\1', text or '')
    return cleaned.strip()


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


def get_last_send_order_text(
    texts: Dict[str, str], send_order: List[str]
) -> Optional[tuple[str, str]]:
    for item_name in reversed(send_order):
        if not item_name.startswith('텍스트'):
            continue
        text_content = texts.get(item_name, '').strip()
        if text_content:
            return item_name, text_content
    return None


def _send_order_text(
    chat_room: ChatRoomManager,
    item_name: str,
    send_body: str,
    log: Callable[[str], None],
) -> bool:
    """짧은 글: send_message / 긴·다줄: CDP 순차 전송 우선"""
    log(f'{item_name} 전송 시도 ({len(send_body)}자)...')

    if _should_use_cdp_input(send_body):
        log(f'{item_name} CDP 입력 방식 ({send_body.count(chr(10)) + 1}줄)')
        if chat_room.send_message_sequential(
            send_body, max_attempts=SEND_ORDER_MAX_ATTEMPTS
        ):
            return True
        log(f'{item_name} CDP 순차 전송 실패 — 일반 방식 재시도')

    return chat_room.send_message(send_body, max_attempts=SEND_ORDER_MAX_ATTEMPTS)


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
        sent_any = False
        for item_name in send_order:
            if item_name.startswith('이미지폴더'):
                try:
                    folder_num = int(item_name.replace('이미지폴더', ''))
                except ValueError:
                    log(f'잘못된 이미지 폴더 이름: {item_name}')
                    success = False
                    continue

                images = get_folder_images(images_folder, folder_num)
                if test_mode:
                    log(f'[테스트] {item_name} 전송 예정: {len(images)}장')
                    if images:
                        sent_any = True
                    continue
                if not images:
                    log(f'{item_name} 이미지 없음 — 실패')
                    success = False
                    continue
                if not chat_room.upload_images(images):
                    log(f'이미지 폴더{folder_num} 업로드 실패')
                    success = False
                else:
                    sent_any = True
                time.sleep(delay)
                continue

            if not item_name.startswith('텍스트'):
                continue

            text_content = texts.get(item_name, '').strip()
            if not text_content:
                log(f'{item_name} 내용 없음 — 건너뜀')
                continue

            send_body = normalize_message_for_send(text_content)
            if test_mode:
                preview = send_body[:30] + '...' if len(send_body) > 30 else send_body
                log(f'[테스트] {item_name} 전송 예정: "{preview}"')
                sent_any = True
                continue

            sent_ok = _send_order_text(chat_room, item_name, send_body, log)
            if not sent_ok:
                log(
                    f'{item_name} 전송 실패 ({len(send_body)}자, '
                    f'최대 {SEND_ORDER_MAX_ATTEMPTS}회 시도)'
                )
                success = False
            else:
                log(f'{item_name} 전송 완료 ({len(send_body)}자)')
                sent_any = True

            extra = min(3.0, len(send_body) / 350.0)
            time.sleep(max(1.0, delay * 0.6) + extra)

        if not test_mode and not sent_any:
            log('전송된 항목 없음 — 처리 실패')
            return False

        return success
    except Exception as e:
        log(f'채팅방 내용 전송 오류: {e}')
        return False
