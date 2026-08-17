"""숨고 「다른 고수를 고용함」 배지 감지"""
from __future__ import annotations

import re

HIRED_OTHER_MARKER = '다른 고수를 고용함'

_HIRED_OTHER_JS = f"""
var SOOMGO_HIRED_OTHER_MARKER = '{HIRED_OTHER_MARKER}';
function containsSoomgoHiredOther(text) {{
  return (text || '').replace(/\\s+/g, ' ').indexOf(SOOMGO_HIRED_OTHER_MARKER) >= 0;
}}
"""


def contains_hired_other(*texts: str, marker: str = HIRED_OTHER_MARKER) -> bool:
    needle = (marker or HIRED_OTHER_MARKER).strip()
    if not needle:
        return False
    compact_needle = re.sub(r'\s+', '', needle)
    for raw in texts:
        if not raw:
            continue
        normalized = re.sub(r'\s+', ' ', str(raw)).strip()
        if needle in normalized:
            return True
        if compact_needle and compact_needle in re.sub(r'\s+', '', normalized):
            return True
    return False


def hired_other_js_helpers() -> str:
    return _HIRED_OTHER_JS
