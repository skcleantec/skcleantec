"""숨고 Chrome 창 — 화면 우측(최소 폭) 배치"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

SOOMGO_SPLIT_MIN_WIDTH = 420


def _split_widths(bounds: dict[str, Any] | None, screen_width: int) -> tuple[int, int]:
    """CRM·숨고 가로 폭 (crm_w, soomgo_w)."""
    if bounds:
        crm_w = int(bounds.get('crmWidth', 0) or 0)
        soomgo_w = int(bounds.get('soomgoWidth', 0) or 0)
        if crm_w > 0 and soomgo_w > 0 and crm_w + soomgo_w <= screen_width + 4:
            return crm_w, soomgo_w

    soomgo_w = max(SOOMGO_SPLIT_MIN_WIDTH, min(520, screen_width // 5))
    crm_w = max(640, screen_width - soomgo_w)
    if crm_w + soomgo_w > screen_width:
        crm_w = max(640, screen_width - soomgo_w)
    return crm_w, soomgo_w


def arrange_soomgo_right_half(driver, bounds: dict[str, Any] | None = None) -> bool:
    """CRM이 전달한 avail 영역 기준 — 좌 CRM(넓게) · 우 숨고(최소 폭)."""
    try:
        if bounds:
            left = int(bounds.get('availLeft', bounds.get('left', 0)))
            top = int(bounds.get('availTop', bounds.get('top', 0)))
            width = int(bounds.get('availWidth', bounds.get('width', 1920)))
            height = int(bounds.get('availHeight', bounds.get('height', 1080)))
        else:
            left, top, width, height = 0, 0, 1920, 1080

        crm_w, soomgo_w = _split_widths(bounds, width)
        x = left + crm_w
        y = top
        w = max(SOOMGO_SPLIT_MIN_WIDTH, soomgo_w)
        h = max(480, height)
        driver.set_window_rect(x=x, y=y, width=w, height=h)
        return True
    except Exception as e:
        logger.warning('arrange_soomgo_right_half: %s', e)
        return False
