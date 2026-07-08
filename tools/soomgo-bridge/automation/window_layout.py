"""숨고 Chrome 창 — 화면 우측 반쪽 배치"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def arrange_soomgo_right_half(driver, bounds: dict[str, Any] | None = None) -> bool:
    """CRM이 전달한 avail 영역 기준 우측 절반으로 Chrome 창 배치."""
    try:
        if bounds:
            left = int(bounds.get('availLeft', bounds.get('left', 0)))
            top = int(bounds.get('availTop', bounds.get('top', 0)))
            width = int(bounds.get('availWidth', bounds.get('width', 1920)))
            height = int(bounds.get('availHeight', bounds.get('height', 1080)))
        else:
            left, top, width, height = 0, 0, 1920, 1080

        half = max(640, width // 2)
        x = left + half
        y = top
        w = max(640, width - half)
        h = max(480, height)
        driver.set_window_rect(x=x, y=y, width=w, height=h)
        return True
    except Exception as e:
        logger.warning('arrange_soomgo_right_half: %s', e)
        return False
