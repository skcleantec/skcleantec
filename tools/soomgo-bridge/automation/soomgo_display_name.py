"""숨고 닉네임·고객명 판별 — selectors.py 단일 소스 re-export (구 import 경로 호환)."""

from automation.selectors import (  # noqa: F401
    SOOMGO_DISPLAY_NAME_JS,
    SOOMGO_DISPLAY_NAME_MAX_LEN,
    SOOMGO_DISPLAY_NAME_MIN_LEN,
    is_rejected_soomgo_display_name_line,
    is_soomgo_display_name,
    normalize_soomgo_display_name_line,
)
