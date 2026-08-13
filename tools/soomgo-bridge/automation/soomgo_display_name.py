"""숨고 닉네임·고객명 판별 — 한글·영문·한자(외자) 허용 (브릿지 JS 단일 소스)"""

from __future__ import annotations

import re

SOOMGO_DISPLAY_NAME_MIN_LEN = 2
SOOMGO_DISPLAY_NAME_MAX_LEN = 16

_INVALID_EXACT = re.compile(r'^(고객|익명|상대방)$')
_NAME_BODY = re.compile(
    rf'^[\uAC00-\uD7A3A-Za-z0-9\u4E00-\u9FFF\s\-\'\.·]{{{SOOMGO_DISPLAY_NAME_MIN_LEN},{SOOMGO_DISPLAY_NAME_MAX_LEN}}}$',
)
_HAS_NAME_CHAR = re.compile(r'[\uAC00-\uD7A3A-Za-z\u4E00-\u9FFF]')

# customer_request·chat_list_watcher 등 브라우저 execute_script 에 공통 삽입
SOOMGO_DISPLAY_NAME_JS = """
function normalizeSoomgoDisplayNameLine(t) {
  if (!t) return '';
  return t.split('\\n')[0].replace(/\\s+/g, ' ').trim();
}
function isRejectedSoomgoDisplayNameLine(t) {
  if (!t) return true;
  if (/^(고객|익명|상대방)$/.test(t)) return true;
  if (t === '접속 중' || t.indexOf('채팅') >= 0 || t === '고객 요청' || t === '요청 상세') return true;
  if (t.indexOf('시간') >= 0 && t.indexOf('전') >= 0) return true;
  if (/청소업체/.test(t) && (/[•·]/.test(t) || /[시군구읍면]/.test(t))) return true;
  if (/^(이사\\/입주|입주\\/이사)/.test(t) && (/[•·]/.test(t) || /[시군구읍면]/.test(t))) return true;
  return false;
}
function isSoomgoDisplayName(t) {
  t = normalizeSoomgoDisplayNameLine(t);
  if (isRejectedSoomgoDisplayNameLine(t)) return false;
  if (t.length < 2 || t.length > 16) return false;
  if (/^\\d{5,12}$/.test(t)) return true;
  if (!/[\\uAC00-\\uD7A3A-Za-z\\u4E00-\\u9FFF]/.test(t)) return false;
  return /^[\\uAC00-\\uD7A3A-Za-z0-9\\u4E00-\\u9FFF\\s\\-'.·]{2,16}$/.test(t);
}
function isName(t) {
  return isSoomgoDisplayName(t);
}
var SOOMGO_NAME_CAPTURE = '([\\uAC00-\\uD7A3A-Za-z\\u4E00-\\u9FFF][\\uAC00-\\uD7A3A-Za-z0-9\\u4E00-\\u9FFF\\s\\-'.·]{1,11})';
"""


def normalize_soomgo_display_name_line(raw: str | None) -> str:
    if not raw:
        return ''
    return raw.split('\n', 1)[0].strip()


def is_rejected_soomgo_display_name_line(text: str) -> bool:
    t = text.strip()
    if not t:
        return True
    if _INVALID_EXACT.match(t):
        return True
    if t == '접속 중' or '채팅' in t or t in ('고객 요청', '요청 상세'):
        return True
    if '시간' in t and '전' in t:
        return True
    if '청소업체' in t and (re.search(r'[•·]', t) or re.search(r'[시군구읍면]', t)):
        return True
    if re.match(r'^(이사/입주|입주/이사)', t) and (
        re.search(r'[•·]', t) or re.search(r'[시군구읍면]', t)
    ):
        return True
    return False


def is_soomgo_display_name(raw: str | None) -> bool:
    t = normalize_soomgo_display_name_line(raw)
    if is_rejected_soomgo_display_name_line(t):
        return False
    if len(t) < SOOMGO_DISPLAY_NAME_MIN_LEN or len(t) > SOOMGO_DISPLAY_NAME_MAX_LEN:
        return False
    if re.fullmatch(r'\d{5,12}', t):
        return True
    if not _HAS_NAME_CHAR.search(t):
        return False
    return bool(_NAME_BODY.fullmatch(t))
