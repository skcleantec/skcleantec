"""숨고 Chrome — 창 크기와 무관하게 모바일 레이아웃 유지 (CDP)"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

MOBILE_VIEWPORT_WIDTH = 390
MOBILE_VIEWPORT_HEIGHT = 844
MOBILE_DEVICE_SCALE = 2

MOBILE_USER_AGENT = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 '
    'Mobile/15E148 Safari/604.1'
)


def apply_mobile_viewport(driver) -> bool:
    """창을 넓혀도 숨고 UI가 모바일 폭으로 렌더링되게 한다."""
    try:
        driver.execute_cdp_cmd(
            'Emulation.setDeviceMetricsOverride',
            {
                'width': MOBILE_VIEWPORT_WIDTH,
                'height': MOBILE_VIEWPORT_HEIGHT,
                'deviceScaleFactor': MOBILE_DEVICE_SCALE,
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
