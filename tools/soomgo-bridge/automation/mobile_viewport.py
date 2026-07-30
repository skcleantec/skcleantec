"""하위 호환 — mobile_viewport 는 window_layout 로 통합됨."""
from automation.window_layout import (  # noqa: F401
    MOBILE_DEVICE_SCALE,
    MOBILE_USER_AGENT,
    MOBILE_VIEWPORT_HEIGHT,
    MOBILE_VIEWPORT_WIDTH,
    apply_mobile_viewport,
)
