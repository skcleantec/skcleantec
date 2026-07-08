"""숨고 채팅방 — 텍스트·이미지 스텝 순차 전송"""
from __future__ import annotations

import logging
import time
from typing import Any, Callable

from automation.chat_room import ChatRoomManager

logger = logging.getLogger(__name__)

STEP_DELAY_SEC = 1.0
IMAGE_STEP_DELAY_SEC = 1.5


def _normalize_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for raw in steps:
        if not isinstance(raw, dict):
            continue
        step_type = str(raw.get('type', '')).strip().lower()
        if step_type == 'text':
            text = str(raw.get('text', '')).strip()
            if text:
                normalized.append({'type': 'text', 'text': text})
            continue
        if step_type == 'images':
            urls = raw.get('urls')
            if not isinstance(urls, list):
                continue
            clean_urls = [str(u).strip() for u in urls if str(u).strip()]
            if not clean_urls:
                continue
            mode = str(raw.get('mode', 'bundle')).strip().lower()
            if mode not in ('bundle', 'single'):
                mode = 'bundle'
            normalized.append({'type': 'images', 'urls': clean_urls, 'mode': mode})
    return normalized


def run_send_sequence(
    chat_room: ChatRoomManager,
    steps: list[dict[str, Any]],
    *,
    image_paths_by_url: dict[str, str],
    delay: float = STEP_DELAY_SEC,
    log: Callable[[str], None] | None = None,
) -> tuple[bool, str | None]:
    """CRM/브릿지 JSON 스텝을 순차 실행."""
    emit = log or (lambda msg: logger.info(msg))
    ordered = _normalize_steps(steps)
    if not ordered:
        return False, '전송할 스텝이 없습니다.'

    for index, step in enumerate(ordered, start=1):
        if step['type'] == 'text':
            ok, err = chat_room.send_message(step['text'])
            if not ok:
                emit(f'스텝 {index} 텍스트 전송 실패')
                return False, err or f'스텝 {index} 텍스트 전송 실패'
            time.sleep(delay)
            continue

        mode = step.get('mode', 'bundle')
        paths: list[str] = []
        for url in step.get('urls', []):
            path = image_paths_by_url.get(url)
            if path:
                paths.append(path)
        if not paths:
            emit(f'스텝 {index} 이미지 경로 없음 — 건너뜀')
            continue

        ok, err = chat_room.upload_images(paths, mode=mode)
        if not ok:
            emit(f'스텝 {index} 이미지 전송 실패')
            return False, err or f'스텝 {index} 이미지 전송 실패'
        time.sleep(IMAGE_STEP_DELAY_SEC)

    return True, None
