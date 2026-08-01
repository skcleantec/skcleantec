"""숨고 Chrome 창 — 화면 우측(최소 폭) 배치 + 모바일 viewport (CDP)"""
from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# Windows Chrome 탭·주소창 (outer rect → inner viewport 차이)
_CHROME_UI_HEIGHT_FALLBACK = 96

SOOMGO_SPLIT_MIN_WIDTH = 420

MOBILE_VIEWPORT_WIDTH = 390
MOBILE_VIEWPORT_HEIGHT = 844
MOBILE_DEVICE_SCALE = 2

MOBILE_USER_AGENT = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 '
    'Mobile/15E148 Safari/604.1'
)


def read_viewport_content_size(driver) -> tuple[int, int]:
    """CDP 뷰포트는 Chrome 툴바 밖 콘텐츠 영역 크기여야 한다 (outer rect 사용 시 하단 채팅 입력 잘림)."""
    try:
        size = driver.execute_script('return { w: window.innerWidth, h: window.innerHeight };')
        if isinstance(size, dict):
            w = int(size.get('w') or 0)
            h = int(size.get('h') or 0)
            if w >= SOOMGO_SPLIT_MIN_WIDTH and h >= 200:
                return w, h
    except Exception:
        pass
    rect = driver.get_window_rect()
    w = max(SOOMGO_SPLIT_MIN_WIDTH, int(rect.get('width', MOBILE_VIEWPORT_WIDTH)))
    h = max(480, int(rect.get('height', MOBILE_VIEWPORT_HEIGHT)) - _CHROME_UI_HEIGHT_FALLBACK)
    return w, h


def apply_mobile_viewport(driver, width: int | None = None, height: int | None = None) -> bool:
    """창 크기에 맞춰 모바일 레이아웃을 렌더링 — 좌우·하단 회색 여백 방지."""
    try:
        if width is None or height is None:
            width, height = read_viewport_content_size(driver)
        width = max(SOOMGO_SPLIT_MIN_WIDTH, int(width))
        height = max(480, int(height))

        driver.execute_cdp_cmd(
            'Emulation.setDeviceMetricsOverride',
            {
                'width': width,
                'height': height,
                'deviceScaleFactor': 1,
                'mobile': True,
            },
        )
        driver.execute_cdp_cmd(
            'Emulation.setUserAgentOverride',
            {
                'userAgent': MOBILE_USER_AGENT,
                'platform': 'iPhone',
            },
        )
        driver.execute_cdp_cmd(
            'Emulation.setTouchEmulationEnabled',
            {'enabled': True},
        )
        return True
    except Exception as e:
        logger.warning('apply_mobile_viewport: %s', e)
        return False


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
        if bounds and bounds.get('soomgoLeft') is not None:
            x = int(bounds['soomgoLeft'])
        else:
            x = left + crm_w
        y = top
        w = max(SOOMGO_SPLIT_MIN_WIDTH, int(bounds.get('soomgoWidth', soomgo_w) if bounds else soomgo_w))
        h = max(480, height)
        driver.set_window_rect(x=x, y=y, width=w, height=h)
        time.sleep(0.08)
        apply_mobile_viewport(driver)
        return True
    except Exception as e:
        logger.warning('arrange_soomgo_right_half: %s', e)
        return False
