"""숨고(Soomgo) URL·셀렉터·닉네임 판별 상수"""
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
var SOOMGO_NAME_CAPTURE = "([\\uAC00-\\uD7A3A-Za-z\\u4E00-\\u9FFF][\\uAC00-\\uD7A3A-Za-z0-9\\u4E00-\\u9FFF\\s\\-'.·]{1,11})";
"""

# call_modal·customer_request 등 — 찜(하트) 버튼 클릭 방지 (visible() 정의 후 붙여 사용)
SOOMGO_FAVORITE_GUARD_JS = """
function isFavoriteButton(el) {
  if (!el) return false;
  var label = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '') + ' ' + (el.getAttribute('title') || '')).trim();
  if (/찜|즐겨|관심|하트|favorite|like|bookmark|scrap|heart/i.test(label)) return true;
  if (el.querySelector('[class*="heart"], [class*="Heart"], [class*="favorite"], [class*="Favorite"], [class*="like"], [class*="Like"], [class*="scrap"], [class*="Scrap"], [class*="bookmark"], [class*="Bookmark"]')) return true;
  var quick = el.closest('.quick-btn-container, [class*="quick-btn"]');
  if (quick) {
    var qlist = quick.querySelectorAll('button, a[role="button"], [role="button"]');
    if (qlist.length >= 2 && qlist[qlist.length - 1] === el && !/전화|통화|call/i.test(label)) return true;
  }
  try {
    var header = el.closest('[class*="chat-header"], [class*="ChatHeader"], header, [class*="info-area"]');
    if (header && (el.querySelector('svg') || el.querySelector('img'))) {
      var er = el.getBoundingClientRect();
      if (er.width >= 8 && er.height >= 8 && er.top < 160) {
        var iconBtns = [];
        var nodes = header.querySelectorAll('button, [role="button"]');
        for (var hi = 0; hi < nodes.length; hi++) {
          var b = nodes[hi];
          var br = b.getBoundingClientRect();
          if (br.width < 8 || br.height < 8 || br.top > 160) continue;
          if (b.querySelector('svg, img')) iconBtns.push(b);
        }
        if (iconBtns.length >= 2) {
          iconBtns.sort(function(a, b) { return a.getBoundingClientRect().right - b.getBoundingClientRect().right; });
          if (iconBtns[iconBtns.length - 1] === el && !/전화|통화|call/i.test(label)) return true;
        }
      }
    }
  } catch (e) {}
  return false;
}
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


URLS = {
    'LOGIN': 'https://soomgo.com/login',
    'CHAT_LIST': 'https://soomgo.com/pro/chats',
    'CHAT_ROOM': 'https://soomgo.com/pro/chats/{chat_id}?from=chatroom',
    'PRO_HOME': 'https://soomgo.com/pro',
}

# 로그인 후 채팅이 아닌 업무 경로 (/pro·/requests 등)
NON_CHAT_SESSION_PATH_HINTS = (
    '/requests/received',
    '/requests',
    '/request/received',
    '/request',
    '/pro/requests',
    '/pro/request',
    '/pro/received',
    '/pro/quotes',
    '/pro/quote',
    '/pro/estimate',
    '/pro/incoming',
    '/pro/home',
    '/pro/dashboard',
    '/pro/main',
    '/pro/market',
    '/pro/marketplace',
    '/pro/profile',
    '/pro/settings',
    '/pro/notification',
    '/pro/notifications',
    '/pro/calendar',
    '/pro/schedule',
    '/pro/settlement',
    '/pro/payment',
    '/pro/review',
    '/pro/reviews',
    '/pro/ad',
    '/pro/ads',
    '/pro/store',
    '/pro/guide',
    '/pro/onboarding',
    '/pro/welcome',
    '/pro/feed',
)

# 하위 호환 — /pro 경로만 (navigation 내부에서 session hints 로 확장)
NON_CHAT_PRO_PATH_HINTS = NON_CHAT_SESSION_PATH_HINTS

LOGIN = {
    'EMAIL_INPUT': "input[type='email'], input[name='email'], input[placeholder*='이메일']",
    'PASSWORD_INPUT': "input[type='password'], input[name='password']",
    'LOGIN_BUTTON': "button[type='submit']",
    # 숨고 소셜 로그인 — 「카카오로 시작하기」(해시 class 대비 XPath/JS 병행)
    'KAKAO_BUTTON': (
        "button[class*='kakao'], a[href*='kakao'], "
        "button[data-provider='kakao'], a[data-provider='kakao'], "
        "button.css-1mselhc"
    ),
    'KAKAO_BUTTON_TEXT': '카카오',
    # accounts.kakao.com — 아이디·비밀번호·로그인
    'KAKAO_ID_INPUT': "input[name='loginId'], input#loginId--1, input[id^='loginId']",
    'KAKAO_PASSWORD_INPUT': "input[name='password'], input#loginPassword--2, input[id^='loginPassword'], input[type='password']",
    'KAKAO_SUBMIT_BUTTON': "button[type='submit'].btn_g, button.btn_g.highlight.submit, button[type='submit']",
}

CHAT_NAV = {
    'LINK': "a[href*='/pro/chats']",
}
