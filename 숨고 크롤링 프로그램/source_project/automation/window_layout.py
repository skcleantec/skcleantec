"""숨고 Chrome — 좁은 창 + CDP 모바일 viewport (창을 키워도 모바일 UI 유지)."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Windows Chrome 탭·주소창 — layout height = outer height − offset
_CHROME_UI_HEIGHT_OFFSET = 88

SOOMGO_WINDOW_WIDTH = 480
SOOMGO_WINDOW_HEIGHT = 920
SOOMGO_MIN_WIDTH = 420
# 창을 키워도 숨고는 이 폭 기준 모바일 UI (PC 레이아웃 방지)
MAX_SOOMGO_MOBILE_LAYOUT_WIDTH = 520

MOBILE_USER_AGENT = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 '
    'Mobile/15E148 Safari/604.1'
)


def viewport_metrics_from_outer(outer_width: int, outer_height: int) -> tuple[int, int]:
    """Chrome outer 창 크기 → CDP layout viewport (가로는 모바일 상한 적용)."""
    width = max(
        SOOMGO_MIN_WIDTH,
        min(int(outer_width), MAX_SOOMGO_MOBILE_LAYOUT_WIDTH),
    )
    height = max(480, int(outer_height) - _CHROME_UI_HEIGHT_OFFSET)
    return width, height


def read_viewport_metrics_from_driver(driver) -> tuple[int, int]:
    rect = driver.get_window_rect()
    return viewport_metrics_from_outer(
        int(rect.get('width', SOOMGO_WINDOW_WIDTH)),
        int(rect.get('height', SOOMGO_WINDOW_HEIGHT)),
    )


def apply_mobile_viewport(driver, width: int | None = None, height: int | None = None) -> bool:
    """창 크기에 맞춰 숨고 모바일 레이아웃 강제."""
    try:
        if width is None or height is None:
            layout_w, layout_h = read_viewport_metrics_from_driver(driver)
        else:
            layout_w, layout_h = viewport_metrics_from_outer(int(width), int(height))

        try:
            driver.execute_cdp_cmd('Emulation.clearDeviceMetricsOverride', {})
        except Exception:
            pass

        driver.execute_cdp_cmd(
            'Emulation.setDeviceMetricsOverride',
            {
                'width': layout_w,
                'height': layout_h,
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


def ensure_soomgo_mobile_layout(driver) -> bool:
    """페이지 이동 후에도 모바일 viewport 재적용."""
    return apply_mobile_viewport(driver)


def arrange_soomgo_window(driver) -> bool:
    """기본 좁은 창 크기 + 모바일 viewport."""
    try:
        driver.set_window_rect(
            x=80,
            y=40,
            width=SOOMGO_WINDOW_WIDTH,
            height=SOOMGO_WINDOW_HEIGHT,
        )
        return apply_mobile_viewport(driver, width=SOOMGO_WINDOW_WIDTH, height=SOOMGO_WINDOW_HEIGHT)
    except Exception as e:
        logger.warning('arrange_soomgo_window: %s', e)
        return False
