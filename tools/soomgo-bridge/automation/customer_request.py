"""숨고 채팅방 — 고객명·고객 요청 모달 파싱"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from automation.overlay_modals import dismiss_blocking_overlays
from automation.selectors import SOOMGO_DISPLAY_NAME_JS
from automation.soomgo_text_filters import (
    count_clean_request_pairs,
    filter_soomgo_memo_lines,
    has_meaningful_request_fields,
    is_garbage_request_extract,
    is_plausible_soomgo_region,
    is_soomgo_boilerplate_line,
    is_soomgo_chat_scrape_memo,
    is_soomgo_sidebar_nav_memo,
)

logger = logging.getLogger(__name__)

REQUEST_MODAL_DELAY = 0.45
REQUEST_MODAL_READY_TIMEOUT = 8.0
REQUEST_MODAL_POLL_SEC = 0.1
REQUEST_MODAL_OPEN_WAIT_SEC = 4.0
REQUEST_MODAL_RETRY_WAIT_SEC = 2.5
REQUEST_MODAL_EXTRACT_SETTLE_SEC = 0.55
REQUEST_MODAL_READ_ATTEMPTS = 6

_DATE_RE = re.compile(r'(\d{4}-\d{2}-\d{2})')
_DATE_QUESTION_RE = re.compile(
    r'희망일|원하는\s*날짜|청소\s*날짜|이사\s*날짜|입주\s*날짜|날짜|언제|일정|희망\s*하|원하시는\s*날|원하는\s*날',
)
_PYEONG_ANSWER_RE = re.compile(r'(\d{1,4})\s*평')
_COUNT_ANSWER_RE = re.compile(r'(\d{1,2})')


def parse_preferred_date_from_request_texts(texts: list[str]) -> str | None:
    """고객 요청 모달 Q&A·메모에서만 희망일 추출 (채팅 타임스탬프·무관 ISO 제외)."""
    for raw in texts:
        if not raw:
            continue
        for line in str(raw).split('\n'):
            line = line.strip()
            if not line or is_soomgo_boilerplate_line(line):
                continue
            if re.match(r'^\d{1,2}:\d{2}', line):
                continue
            if not _DATE_QUESTION_RE.search(line) and '날짜' not in line and '희망' not in line:
                continue
            m = re.search(r'[:：]\s*(\d{4}-\d{2}-\d{2})', line) or _DATE_RE.search(line)
            if m:
                return m.group(1) if m.lastindex else m.group(0)
    return None


def pick_preferred_date_from_pairs(pairs: list[dict[str, str]]) -> str | None:
    for item in pairs:
        q = str(item.get('question', '')).strip()
        a = str(item.get('answer', '')).strip()
        if not q and not a:
            continue
        if not _DATE_QUESTION_RE.search(q) and not _DATE_QUESTION_RE.search(a):
            if '날짜' not in q and '희망' not in q:
                continue
        combined = f'{q} {a}'.strip()
        m = _DATE_RE.search(combined)
        if m:
            return m.group(1)
    return None


def parse_soomgo_count(raw: Any) -> int | None:
    """숨고 고객요청 답변 → 방·화장실·베란다 개수 (0~99)."""
    if raw is None:
        return None
    if isinstance(raw, int):
        return raw if 0 <= raw <= 99 else None
    s = str(raw).strip()
    if not s or re.search(r'없|무|해당\s*없|0개', s):
        return None
    m = _COUNT_ANSWER_RE.search(s)
    if not m:
        return None
    n = int(m.group(1))
    return n if 0 <= n <= 99 else None

_GET_HEADER_NAME_JS = SOOMGO_DISPLAY_NAME_JS + """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
var header = document.querySelector('header, [class*="chat-header"], [class*="ChatHeader"], [class*="room-header"]');
if (!header) {
  var leftPane = document.querySelector('[class*="chat-room"], main');
  header = leftPane || document.body;
}
var nodes = header.querySelectorAll('button, a, [role="button"], h1, h2, h3, h4, span, div, p');
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  if (!visible(el)) continue;
  var t = (el.textContent || '').trim();
  if (!isSoomgoDisplayName(t)) continue;
  var r = el.getBoundingClientRect();
  if (r.top > 220) continue;
  return normalizeSoomgoDisplayNameLine(t);
}
return null;
"""

_OPEN_PROFILE_REQUEST_MODAL_JS = SOOMGO_DISPLAY_NAME_JS + """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
var best = null;
var bestScore = -1;
var buttons = document.querySelectorAll('button[aria-label*="프로필 보기"], button[aria-label*="프로필"]');
for (var i = 0; i < buttons.length; i++) {
  var btn = buttons[i];
  if (!visible(btn)) continue;
  var aria = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '')).replace(/\\s+/g, ' ').trim();
  if (aria.indexOf('프로필') < 0) continue;
  var r = btn.getBoundingClientRect();
  var score = 100;
  if (r.top < 180) score += 40;
  if (r.left < 420) score += 30;
  if (score > bestScore) { bestScore = score; best = btn; }
}
if (best && bestScore >= 100) {
  best.click();
  return true;
}
return false;
"""

_OPEN_CUSTOMER_REQUEST_VIEW_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
var nodes = document.querySelectorAll('button, a, [role="button"], span, div');
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  if (!visible(el)) continue;
  var label = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).replace(/\\s+/g, ' ').trim();
  if (label === '고객 요청 보기') {
    (el.closest('button, a, [role="button"]') || el).click();
    return true;
  }
  if (label.indexOf('고객 요청') >= 0 && label.indexOf('보기') >= 0 && label.length < 24) {
    (el.closest('button, a, [role="button"]') || el).click();
    return true;
  }
}
return false;
"""

_OPEN_INLINE_REQUEST_VIEW_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
var best = null;
var bestScore = -1;
var nodes = document.querySelectorAll('button, a, [role="button"], span, div');
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  if (!visible(el)) continue;
  var label = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).replace(/\\s+/g, ' ').trim();
  if (label.indexOf('전체보기') < 0) continue;
  var host = el.closest('div, section, article, li, main') || el;
  var hostText = (host.innerText || host.textContent || '').replace(/\\s+/g, ' ').trim();
  var score = 0;
  if (/요청서|고객\\s*요청|요청\\s*상세/.test(hostText)) score += 90;
  if (hostText.indexOf('평') >= 0 || hostText.indexOf('방') >= 0) score += 40;
  var r = el.getBoundingClientRect();
  if (r.top > 120 && r.top < 720) score += 25;
  if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') score += 20;
  if (score > bestScore) { bestScore = score; best = el; }
}
if (best && bestScore >= 70) {
  var target = best.closest('button, a, [role="button"]') || best;
  target.click();
  return true;
}
return false;
"""

_CLICK_REQUEST_DETAIL_TAB_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
var tabs = document.querySelectorAll('button, a, [role="tab"], [role="button"], span, div');
for (var i = 0; i < tabs.length; i++) {
  var el = tabs[i];
  if (!visible(el)) continue;
  var t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
  if (t !== '요청 상세' && t !== '고객 요청') continue;
  var r = el.getBoundingClientRect();
  if (r.top > 260) continue;
  var target = el.closest('button, a, [role="tab"], [role="button"]') || el;
  target.click();
  return true;
}
return false;
"""

_OPEN_REQUEST_MODAL_JS = SOOMGO_DISPLAY_NAME_JS + """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
function scoreNameClick(el) {
  if (!visible(el)) return -1;
  var t = (el.textContent || '').trim();
  var first = t.split('\\n')[0].trim();
  if (!isSoomgoDisplayName(first)) return -1;
  var r = el.getBoundingClientRect();
  var score = 0;
  if (r.top < 130) score += 60;
  if (r.left < 420) score += 50;
  if (r.width < 280 && r.height < 80) score += 20;
  if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') score += 35;
  if (t.indexOf('접속') >= 0 || t.indexOf('전') >= 0) score += 15;
  if (el.closest('header, [class*="header"], [class*="Header"], [class*="chat-header"], [class*="ChatHeader"]')) score += 25;
  return score;
}
var scopes = document.querySelectorAll('header, [class*="chat-header"], [class*="ChatHeader"], [class*="room-header"], main');
var best = null;
var bestScore = -1;
for (var s = 0; s < scopes.length; s++) {
  var scope = scopes[s];
  var nodes = scope.querySelectorAll('button, a, [role="button"], h1, h2, h3, h4, span, div, p');
  for (var i = 0; i < nodes.length; i++) {
    var sc = scoreNameClick(nodes[i]);
    if (sc > bestScore) { bestScore = sc; best = nodes[i]; }
  }
}
if (best && bestScore >= 50) {
  var target = best.closest('button, a, [role="button"]') || best;
  target.click();
  return true;
}
var viewNodes = document.querySelectorAll('button, a, [role="button"]');
for (var v = 0; v < viewNodes.length; v++) {
  var btn = viewNodes[v];
  if (!visible(btn)) continue;
  var label = (btn.textContent || '').trim();
  if (label.indexOf('고객 요청') >= 0 && (label.indexOf('보기') >= 0 || label === '고객 요청')) {
    btn.click();
    return true;
  }
}
return false;
"""

_EXTRACT_BV_REQUEST_MODAL_JS = SOOMGO_DISPLAY_NAME_JS + """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
function isPlausibleRegion(line) {
  if (!line || line.length < 4 || line.length > 40) return false;
  return /[가-힣]+(?:시|군|구)/.test(line);
}
function findModalBody() {
  var candidates = document.querySelectorAll(
    '.modal.show .modal-body, [id*="BV_modal_body"], .modal-body'
  );
  for (var i = 0; i < candidates.length; i++) {
    var body = candidates[i];
    if (!visible(body)) continue;
    if (body.querySelector('li[data-name="request-item"], [data-type="request"] li[data-name="request-item"]')) {
      return body;
    }
    if (body.querySelector('.content-modal-body [data-type="request"], .request-view [data-type="request"]')) {
      return body;
    }
  }
  return null;
}
var body = findModalBody();
if (!body) return null;
var requestRoot = body.querySelector('[data-type="request"]');
if (!requestRoot || !visible(requestRoot)) {
  requestRoot = body.querySelector('.request-view [data-type="request"]');
}
if (!requestRoot || !visible(requestRoot)) return null;
var requestSection = requestRoot;
function isDateQuestion(text) {
  if (!text) return false;
  return /날짜|희망|원하는|언제|일정|청소.*날|입주.*날|이사.*날/.test(text);
}
function pickIsoFromDateContext(text) {
  if (!text || !isDateQuestion(text)) return null;
  var iso = text.match(/(\\d{4}-\\d{2}-\\d{2})/);
  return iso ? iso[1] : null;
}
function pushPair(q, a) {
  q = (q || '').replace(/\\s+/g, ' ').trim();
  a = (a || '').replace(/\\s+/g, ' ').trim();
  if (!a || (q && q === a)) return;
  pairs.push({ question: q, answer: a });
}
function readRowPair(row) {
  if (!row || !visible(row)) return null;
  var labelEl = row.querySelector('dt, th, [class*="label"], [class*="question"], .col:first-child, :scope > div:first-child');
  var valueEl = row.querySelector('dd, td, [class*="value"], [class*="answer"], .col:last-child, :scope > div:last-child');
  if (labelEl && valueEl && labelEl !== valueEl) {
    return { q: (labelEl.textContent || '').replace(/\\s+/g, ' ').trim(), a: (valueEl.textContent || '').replace(/\\s+/g, ' ').trim() };
  }
  var kids = [];
  for (var c = 0; c < row.children.length; c++) {
    if (visible(row.children[c])) kids.push(row.children[c]);
  }
  if (kids.length >= 2) {
    return {
      q: (kids[0].textContent || '').replace(/\\s+/g, ' ').trim(),
      a: (kids[kids.length - 1].textContent || '').replace(/\\s+/g, ' ').trim()
    };
  }
  return null;
}

var userBlock = body.querySelector('[data-type="user"]');
var customerName = null;
var region = null;
if (userBlock) {
  var nameEl = userBlock.querySelector('[data-type="user-info"] h4, h4.headline2, h4');
  if (nameEl) {
    var nm = normalizeSoomgoDisplayNameLine(nameEl.textContent || '');
    if (isSoomgoDisplayName(nm)) customerName = nm;
  }
  var regionEls = userBlock.querySelectorAll('h6, [data-type="user-info"] h6');
  for (var re = 0; re < regionEls.length; re++) {
    var rl = (regionEls[re].textContent || '').replace(/\\s+/g, ' ').trim();
    if (!rl || rl.indexOf('청소업체') >= 0 || rl.indexOf('이사') >= 0 && rl.indexOf('입주') >= 0) continue;
    if (!region && isPlausibleRegion(rl)) region = rl;
  }
  if (!customerName || !region) {
    var userLines = (userBlock.innerText || '').split('\\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
    for (var u = 0; u < userLines.length; u++) {
      var ul = userLines[u];
      if (!customerName && isSoomgoDisplayName(ul)) customerName = normalizeSoomgoDisplayNameLine(ul);
      if (!region && isPlausibleRegion(ul)) region = ul;
    }
  }
}

var pairs = [];
var requestItems = requestRoot.querySelectorAll('li[data-name="request-item"]');
for (var ri = 0; ri < requestItems.length; ri++) {
  var item = requestItems[ri];
  if (!visible(item)) continue;
  var qEl = item.querySelector('[data-name="question"], p[data-name="question"]');
  var aEl = item.querySelector('[data-name="answer"], p[data-name="answer"]');
  if (qEl && aEl) {
    pushPair(qEl.textContent, aEl.textContent);
  }
}
if (pairs.length === 0) {
  var lines = (requestSection.innerText || '').split('\\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
  var pendingQ = null;
  for (var j = 0; j < lines.length; j++) {
    var line = lines[j];
    if (line === '요청 상세' || line === '고객 요청') continue;
    if (/[?？]$/.test(line) || line.indexOf('몇') >= 0 || line.indexOf('원하') >= 0 || line.indexOf('어떤') >= 0) {
      pendingQ = line;
    } else if (pendingQ) {
      pairs.push({ question: pendingQ, answer: line });
      pendingQ = null;
    } else if (/입주|이사|아파트|빌라|\\d+\\s*평|\\d+개/.test(line)) {
      pairs.push({ question: '', answer: line });
    }
  }
}

var requestText = (requestRoot.innerText || requestRoot.textContent || '').trim();
var text = (body.innerText || body.textContent || '').trim();
var preferredDate = null;
for (var pi = 0; pi < pairs.length; pi++) {
  var pd = pickIsoFromDateContext((pairs[pi].question || '') + ' ' + (pairs[pi].answer || ''));
  if (pd) { preferredDate = pd; break; }
}
if (!preferredDate) {
  var reqLines = requestText.split('\\n');
  for (var rl = 0; rl < reqLines.length; rl++) {
    var pd2 = pickIsoFromDateContext(reqLines[rl]);
    if (pd2) { preferredDate = pd2; break; }
  }
}
var pyeong = null;
var pyeongM = requestText.match(/(\\d{1,4})\\s*평(?:형|수)?/);
if (pyeongM) pyeong = pyeongM[1];

if (pairs.length === 0 && !pyeong && !region && !customerName && !preferredDate) return null;
return {
  customerName: customerName,
  region: region,
  preferredDate: preferredDate,
  pyeong: pyeong,
  pairs: pairs,
  rawText: text,
  source: 'bv-modal'
};
"""

_EXTRACT_REQUEST_MODAL_JS = SOOMGO_DISPLAY_NAME_JS + """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
function isBoilerplateLine(line) {
  if (!line) return true;
  if (line === '고객 요청' || line === '고객 요청 보기' || line === '요청 상세') return true;
  if (line === '알림 끄기' || line === '신고하기' || line.indexOf('채팅방 나가기') >= 0) return true;
  if (line === '프로필 관리' || line === '받은 견적' || line === '마이페이지') return true;
  if (line === '전체보기' || line === '고용 요청' || line === '숨고페이 요청' || line === '일정 등록') return true;
  if (line.indexOf('고객님이 견적') >= 0) return true;
  if (/^\\d{4}년\\s*\\d{1,2}월\\s*\\d{1,2}일/.test(line)) return true;
  if (line.indexOf('브레이브모바일') >= 0 || line.indexOf('통신판매중개자') >= 0) return true;
  if (line.indexOf('100% 사기') >= 0 || line.indexOf('전자세금계산서') >= 0) return true;
  if (line.indexOf('거래당사자') >= 0 && line.length > 40) return true;
  return false;
}
function hasRequestContentSignals(text) {
  if (!text) return false;
  if (text.indexOf('?') >= 0 || text.indexOf('？') >= 0) return true;
  if (/\\d{1,4}\\s*평/.test(text)) return true;
  if (/방\\s*개수|화장실|베란다/.test(text)) return true;
  if (/[가-힣]+(?:시|군|구)/.test(text) && text.indexOf('마이페이지') < 0) return true;
  return false;
}
function isSidebarDrawer(text) {
  if (!text) return false;
  return text.indexOf('프로필 관리') >= 0 && text.indexOf('마이페이지') >= 0 && !hasRequestContentSignals(text);
}
function isPlausibleRegion(line) {
  if (!line || line.length < 4 || line.length > 40) return false;
  if (isBoilerplateLine(line)) return false;
  if (/브레이브|통신판매|사기|기관|주식|거래당|세금계산서/.test(line)) return false;
  return /[가-힣]+(?:시|군|구)/.test(line);
}
function isQuestion(line) {
  if (!line || isBoilerplateLine(line)) return false;
  return /[?？]$/.test(line)
    || line.indexOf('선택해') >= 0
    || line.indexOf('입력해') >= 0
    || line.indexOf('알려주세요') >= 0
    || line.indexOf('원하시나요') >= 0
    || line.indexOf('원하세요') >= 0
    || line.indexOf('어떤') >= 0
    || line.indexOf('몇') >= 0
    || line.indexOf('있나요') >= 0
    || line.indexOf('있어요') >= 0 && line.indexOf('날짜') >= 0;
}
function findRequestModal() {
  var bvBody = document.querySelector('.modal.show .modal-body [data-type="request"], .modal-body.content-modal-body [data-type="request"]');
  if (bvBody && visible(bvBody.closest('.modal-body') || bvBody)) {
    return bvBody.closest('.modal-body, .content-modal-body, .request-view, [role="dialog"]') || bvBody;
  }
  var best = null;
  var bestScore = -1;
  var selectors = '[role="dialog"], .modal.show, [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"], [class*="sheet"], [class*="Sheet"], [class*="panel"], [class*="Panel"], aside, section';
  var roots = document.querySelectorAll(selectors);
  for (var i = 0; i < roots.length; i++) {
    var el = roots[i];
    if (!visible(el)) continue;
    var t = (el.innerText || el.textContent || '');
    if (el.querySelector('[data-type="request"]') && visible(el.querySelector('[data-type="request"]'))) {
      return el.querySelector('.modal-body, .content-modal-body, .request-view, [role="dialog"]') || el;
    }
    if (t.indexOf('고객 요청') < 0 || t.indexOf('요청 상세') < 0) continue;
    if (isSidebarDrawer(t)) continue;
    if (!hasRequestContentSignals(t)) continue;
    if (t.indexOf('숨고전화') >= 0 || t.indexOf('안심번호로 통화') >= 0) continue;
    if (t.indexOf('브레이브모바일') >= 0 && t.indexOf('?') < 0 && t.indexOf('평') < 0) continue;
    var score = 0;
    if (el.getAttribute('role') === 'dialog') score += 80;
    var cls = (el.className || '').toString();
    if (/modal|drawer|sheet|panel/i.test(cls)) score += 40;
    var r = el.getBoundingClientRect();
    var area = r.width * r.height;
    if (area > 80000) score -= 30;
    if (area < 120000) score += 20;
    if (t.indexOf('?') >= 0 || t.indexOf('평') >= 0 || /\\d{4}-\\d{2}-\\d{2}/.test(t)) score += 35;
    if (score > bestScore) { bestScore = score; best = el; }
  }
  return bestScore >= 20 ? best : null;
}
var modal = findRequestModal();
if (!modal) return null;
var text = (modal.innerText || modal.textContent || '').trim();
var lines = text.split('\\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
var pairs = [];
var pendingQ = null;
var inDetail = false;
for (var j = 0; j < lines.length; j++) {
  var line = lines[j];
  if (isBoilerplateLine(line)) continue;
  if (line === '요청 상세') { inDetail = true; continue; }
  if (line === '고객 요청' || line.indexOf('인터넷') >= 0) continue;
  if (isQuestion(line)) {
    pendingQ = line;
  } else if (pendingQ) {
    if (!isBoilerplateLine(line)) pairs.push({ question: pendingQ, answer: line });
    pendingQ = null;
  } else if (inDetail && line.length > 0 && line.length < 80 && !isBoilerplateLine(line)) {
    pairs.push({ question: '', answer: line });
  }
}
var customerName = null;
var region = null;
var skipWords = ['고객 요청', '요청 상세', '인터넷', '선택', '입력', '알려', '이사/입주', '청소업체'];
for (var k = 0; k < Math.min(lines.length, 24); k++) {
  var cand = lines[k];
  if (isBoilerplateLine(cand)) continue;
  if (skipWords.some(function(w){ return cand.indexOf(w) >= 0; })) continue;
  if (!customerName && isSoomgoDisplayName(cand)) customerName = normalizeSoomgoDisplayNameLine(cand);
  if (!region && isPlausibleRegion(cand)) region = cand;
}
var preferredDate = null;
for (var pi = 0; pi < pairs.length; pi++) {
  var pq = pairs[pi].question || '';
  var pa = pairs[pi].answer || '';
  if (!/날짜|희망|원하는|언제|일정/.test(pq) && !/날짜|희망|원하는|언제|일정/.test(pa)) continue;
  var dm = (pq + ' ' + pa).match(/(\\d{4}-\\d{2}-\\d{2})/);
  if (dm) { preferredDate = dm[1]; break; }
}
var pyeong = null;
var pyeongM = text.match(/(\\d{1,4})\\s*평/);
if (pyeongM) pyeong = pyeongM[1];
return { customerName: customerName, region: region, preferredDate: preferredDate, pyeong: pyeong, pairs: pairs, rawText: text };
"""

_IS_REQUEST_MODAL_OPEN_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
var bvReq = document.querySelector(
  '.modal.show li[data-name="request-item"], ' +
  '[id*="BV_modal_body"] li[data-name="request-item"], ' +
  '.content-modal-body [data-type="request"] li[data-name="request-item"]'
);
if (bvReq && visible(bvReq)) return true;
function hasRequestContentSignals(text) {
  if (!text) return false;
  if (text.indexOf('?') >= 0 || text.indexOf('？') >= 0) return true;
  if (/\\d{1,4}\\s*평/.test(text)) return true;
  if (/방\\s*개수|화장실|베란다/.test(text)) return true;
  if (/[가-힣]+(?:시|군|구)/.test(text) && text.indexOf('마이페이지') < 0) return true;
  return false;
}
function isSidebarDrawer(text) {
  if (!text) return false;
  return text.indexOf('프로필 관리') >= 0 && text.indexOf('마이페이지') >= 0 && !hasRequestContentSignals(text);
}
var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"], [class*="sheet"], [class*="Sheet"], aside, section, div');
for (var i = 0; i < roots.length; i++) {
  if (!visible(roots[i])) continue;
  var t = (roots[i].innerText || '');
  if (t.indexOf('고객 요청') >= 0 && t.indexOf('요청 상세') >= 0 && !isSidebarDrawer(t) && hasRequestContentSignals(t)) return true;
}
return false;
"""

_MODAL_READY_LIGHT_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
var bvReq = document.querySelector(
  '.modal.show li[data-name="request-item"], ' +
  '[id*="BV_modal_body"] li[data-name="request-item"], ' +
  '.content-modal-body [data-type="request"] li[data-name="request-item"]'
);
if (bvReq && visible(bvReq)) return true;
function hasRequestContentSignals(text) {
  if (!text) return false;
  if (text.indexOf('?') >= 0 || text.indexOf('？') >= 0) return true;
  if (/\\d{1,4}\\s*평/.test(text)) return true;
  if (/방\\s*개수|화장실|베란다/.test(text)) return true;
  if (/[가-힣]+(?:시|군|구)/.test(text) && text.indexOf('마이페이지') < 0) return true;
  return false;
}
function isSidebarDrawer(text) {
  if (!text) return false;
  return text.indexOf('프로필 관리') >= 0 && text.indexOf('마이페이지') >= 0 && !hasRequestContentSignals(text);
}
var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"], [class*="sheet"], [class*="Sheet"], aside, section, div');
for (var i = 0; i < roots.length; i++) {
  if (!visible(roots[i])) continue;
  var t = (roots[i].innerText || '');
  if (t.indexOf('고객 요청') >= 0 && t.indexOf('요청 상세') >= 0 && t.length > 72 && !isSidebarDrawer(t) && hasRequestContentSignals(t)) return true;
}
return false;
"""

_CLOSE_REQUEST_MODAL_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
function findRequestModal() {
  var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"]');
  for (var i = 0; i < roots.length; i++) {
    var t = (roots[i].innerText || '');
    if (t.indexOf('고객 요청') >= 0 || t.indexOf('요청 상세') >= 0) return roots[i];
  }
  return null;
}
var modal = findRequestModal();
if (!modal) return false;
var modalRect = modal.getBoundingClientRect();
var best = null;
var bestScore = -1;
var buttons = modal.querySelectorAll('button, [role="button"], a');
for (var i = 0; i < buttons.length; i++) {
  var btn = buttons[i];
  if (!visible(btn)) continue;
  var r = btn.getBoundingClientRect();
  var label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '') + ' ' + (btn.getAttribute('title') || '')).trim();
  var score = 0;
  if (r.top <= modalRect.top + 72) score += 25;
  if (r.right >= modalRect.right - 72) score += 35;
  if (/닫기|close|취소/i.test(label)) score += 50;
  if (label === '' || label === '×' || label === '✕' || label === 'X') score += 30;
  if (btn.querySelector('svg, img')) score += 15;
  if (score > bestScore) { bestScore = score; best = btn; }
}
if (best && bestScore >= 35) {
  best.click();
  return true;
}
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
return true;
"""


def is_request_extract_complete(data: dict | None) -> bool:
    """모달 Q&A·핵심 필드가 실제로 채워졌는지 — 평수 regex만으로는 True가 되지 않게."""
    if not data:
        return False
    pairs = count_clean_request_pairs(data)
    if pairs >= 2:
        return True
    if pairs >= 1 and any(
        data.get(key) for key in ('pyeong', 'roomCount', 'serviceType', 'preferredDate', 'region', 'buildingType')
    ):
        return True
    if data.get('customerName') and data.get('region') and data.get('pyeong'):
        return True
    if pairs >= 1 and data.get('customerName'):
        return True
    return False


def merge_request_payload(base: dict[str, Any], newer: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in newer.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        if key == 'requestPairs' and isinstance(value, list):
            if count_clean_request_pairs({'requestPairs': value}) >= count_clean_request_pairs(out):
                out[key] = value
            continue
        out[key] = value
    return out


def build_request_memo_from_payload(data: dict[str, Any] | None) -> str | None:
    if not data:
        return None
    memo = str(data.get('requestMemo') or '').strip()
    if memo and not is_soomgo_sidebar_nav_memo(memo) and not is_soomgo_chat_scrape_memo(memo):
        return memo
    pairs = data.get('requestPairs')
    if not isinstance(pairs, list):
        return None
    lines: list[str] = []
    for item in pairs:
        if not isinstance(item, dict):
            continue
        q = str(item.get('question', '')).strip()
        a = str(item.get('answer', '')).strip()
        if not a or is_soomgo_boilerplate_line(a):
            continue
        if q and is_soomgo_boilerplate_line(q):
            continue
        lines.append(f'{q}\n{a}' if q else a)
    filtered = filter_soomgo_memo_lines(lines)
    if not filtered:
        return None
    return '\n\n'.join(filtered)[:3000]


def _parse_request_pairs(pairs: list[dict[str, str]]) -> dict[str, Any]:
    result: dict[str, Any] = {
        'serviceType': None,
        'buildingType': None,
        'roomCount': None,
        'bathroomCount': None,
        'verandaCount': None,
        'spaceItems': None,
        'extraServices': None,
        'pyeong': None,
        'preferredDate': None,
        'region': None,
        'inquiryNote': None,
        'requestMemo': None,
    }
    memo_lines: list[str] = []

    for item in pairs:
        q = str(item.get('question', '')).strip()
        a = str(item.get('answer', '')).strip()
        if not a or is_soomgo_boilerplate_line(a):
            continue
        if q and is_soomgo_boilerplate_line(q):
            continue
        if q:
            memo_lines.append(f'{q}\n{a}')
        else:
            memo_lines.append(a)
        if '서비스' in q and ('원하' in q or '종류' in q):
            result['serviceType'] = a
        elif '건물' in q or '주거' in q:
            result['buildingType'] = a
        elif '방 개수' in q or (q.endswith('방') and '화' not in q):
            result['roomCount'] = a
        elif '화장실' in q:
            result['bathroomCount'] = a
        elif '베란다' in q:
            result['verandaCount'] = a
        elif '공간' in q and ('항목' in q or '카테고리' in q):
            result['spaceItems'] = a
        elif '추가' in q and '서비스' in q:
            result['extraServices'] = a
        elif '평수' in q or '공급면적' in q or '평형' in q or ('평' in q and '희망' not in q):
            pm = _PYEONG_ANSWER_RE.search(a)
            result['pyeong'] = pm.group(1) if pm else a.replace('평', '').replace('형', '').strip()
        elif '희망일' in q or '날짜' in q or '원하는 날짜' in q:
            combined = f'{q} {a}'.strip()
            dm = _DATE_RE.search(combined)
            result['preferredDate'] = dm.group(1) if dm else (a or None)
        elif ('날짜' in q or '희망' in q) and not result.get('preferredDate'):
            dm = _DATE_RE.search(q)
            if dm:
                result['preferredDate'] = dm.group(1)
        elif '지역' in q or '주소' in q or '위치' in q or '어디' in q or '거주' in q:
            if is_plausible_soomgo_region(a):
                result['region'] = a
        elif '문의' in q:
            result['inquiryNote'] = a
        elif not q:
            if re.search(r'입주|이사', a) and not result.get('serviceType'):
                result['serviceType'] = a
            elif re.search(r'아파트|빌라|주택|오피스', a) and not result.get('buildingType'):
                result['buildingType'] = a
            elif _PYEONG_ANSWER_RE.search(a) and not result.get('pyeong'):
                pm = _PYEONG_ANSWER_RE.search(a)
                if pm:
                    result['pyeong'] = pm.group(1)

    pair_date = pick_preferred_date_from_pairs(pairs)
    if pair_date and not result.get('preferredDate'):
        result['preferredDate'] = pair_date

    if memo_lines:
        result['requestMemo'] = '\n\n'.join(filter_soomgo_memo_lines(memo_lines))[:3000]
    elif pairs:
        built = build_request_memo_from_payload({'requestPairs': pairs})
        if built:
            result['requestMemo'] = built

    if not result.get('region'):
        for item in pairs:
            a = str(item.get('answer', '')).strip()
            if not a or is_soomgo_boilerplate_line(a):
                continue
            if is_plausible_soomgo_region(a):
                result['region'] = a
                break
            if not result.get('serviceType') and re.search(r'입주|이사|청소', a):
                result['serviceType'] = a
            if not result.get('preferredDate'):
                q = str(item.get('question', '')).strip()
                if _DATE_QUESTION_RE.search(q) or '날짜' in q or '희망' in q:
                    dm = _DATE_RE.search(a) or _DATE_RE.search(q)
                    if dm:
                        result['preferredDate'] = dm.group(1)
            if not result.get('pyeong'):
                pm = _PYEONG_ANSWER_RE.search(a)
                if pm:
                    result['pyeong'] = pm.group(1)
    return result


class CustomerRequestManager:
    def __init__(self, driver, delay: float = REQUEST_MODAL_DELAY):
        self.driver = driver
        self.delay = delay

    def _modal_ready_light(self) -> bool:
        try:
            return bool(self.driver.execute_script(_MODAL_READY_LIGHT_JS))
        except Exception:
            return False

    def _modal_has_content(self) -> bool:
        if not self.is_request_modal_open():
            return False
        data = self.extract_request_modal()
        return bool(data and is_request_extract_complete(data))

    def wait_for_request_modal_ready(self, timeout: float = REQUEST_MODAL_READY_TIMEOUT) -> bool:
        deadline = time.time() + timeout
        stable_hits = 0
        last_pair_count = -1
        while time.time() < deadline:
            if not self.is_request_modal_open():
                time.sleep(REQUEST_MODAL_POLL_SEC)
                stable_hits = 0
                continue
            data = self.extract_request_modal() or {}
            pair_count = count_clean_request_pairs(data)
            if is_request_extract_complete(data):
                if pair_count == last_pair_count and pair_count > 0:
                    stable_hits += 1
                else:
                    stable_hits = 1
                last_pair_count = pair_count
                if stable_hits >= 2:
                    return True
                time.sleep(REQUEST_MODAL_EXTRACT_SETTLE_SEC)
            else:
                stable_hits = 0
                last_pair_count = -1
                time.sleep(REQUEST_MODAL_POLL_SEC)
        data = self.extract_request_modal() or {}
        return is_request_extract_complete(data)

    def _try_open_via_script(self, script: str, wait_timeout: float) -> bool:
        try:
            clicked = self.driver.execute_script(script)
        except Exception as e:
            logger.debug('try_open script failed: %s', e)
            return False
        if not clicked:
            return False
        time.sleep(self.delay * 0.35)
        try:
            bv_open = bool(
                self.driver.execute_script(
                    'return !!document.querySelector(\'.modal.show [data-type="request"], '
                    '.modal-body.content-modal-body [data-type="request"]\');'
                )
            )
        except Exception:
            bv_open = False
        if not bv_open:
            self.driver.execute_script(_CLICK_REQUEST_DETAIL_TAB_JS)
            time.sleep(self.delay * 0.25)
        return self.wait_for_request_modal_ready(timeout=wait_timeout)

    def is_request_modal_open(self) -> bool:
        try:
            return bool(self.driver.execute_script(_IS_REQUEST_MODAL_OPEN_JS))
        except Exception:
            return False

    def get_header_customer_name(self) -> str | None:
        try:
            name = self.driver.execute_script(_GET_HEADER_NAME_JS)
            if isinstance(name, str) and name.strip():
                return name.strip()
        except Exception as e:
            logger.debug('get_header_customer_name: %s', e)
        return None

    def open_request_modal(self) -> bool:
        dismiss_blocking_overlays(self.driver, self.delay * 0.25, max_rounds=2)
        if self._modal_has_content():
            return True

        strategies: tuple[tuple[str, str, float], ...] = (
            ('profile_button', _OPEN_PROFILE_REQUEST_MODAL_JS, REQUEST_MODAL_OPEN_WAIT_SEC),
            ('customer_request_view', _OPEN_CUSTOMER_REQUEST_VIEW_JS, REQUEST_MODAL_OPEN_WAIT_SEC),
            ('inline_view', _OPEN_INLINE_REQUEST_VIEW_JS, REQUEST_MODAL_OPEN_WAIT_SEC),
            ('header_name', _OPEN_REQUEST_MODAL_JS, REQUEST_MODAL_OPEN_WAIT_SEC),
        )

        for name, script, wait_timeout in strategies:
            dismiss_blocking_overlays(self.driver, self.delay * 0.2, max_rounds=2)
            if self._try_open_via_script(script, wait_timeout):
                logger.info('open_request_modal ok via %s', name)
                return True
            if self.is_request_modal_open() and not self._modal_has_content():
                self.close_request_modal()
                time.sleep(self.delay * 0.2)

        try:
            dismiss_blocking_overlays(self.driver, self.delay * 0.2, max_rounds=2)
            clicked = self.driver.execute_script(_OPEN_REQUEST_MODAL_JS)
            if clicked:
                time.sleep(self.delay * 0.35)
                self.driver.execute_script(_CLICK_REQUEST_DETAIL_TAB_JS)
                time.sleep(self.delay * 0.25)
                if self.wait_for_request_modal_ready(timeout=REQUEST_MODAL_RETRY_WAIT_SEC):
                    return True
        except Exception as e:
            logger.error('open_request_modal fallback: %s', e)

        return self._modal_has_content()

    def _merge_header_name(self, data: dict[str, Any], header_name: str | None) -> dict[str, Any]:
        if not header_name:
            return data
        if not data.get('customerName'):
            data['customerName'] = header_name
        else:
            data['customerName'] = str(data.get('customerName') or header_name).strip() or header_name
        return data

    def _read_request_payload(self, header_name: str | None) -> dict[str, Any]:
        best: dict[str, Any] = {}
        for attempt in range(REQUEST_MODAL_READ_ATTEMPTS):
            if attempt == 0:
                time.sleep(REQUEST_MODAL_EXTRACT_SETTLE_SEC)
            else:
                time.sleep(0.45)
            if not self.is_request_modal_open():
                break
            data = self.extract_request_modal() or {}
            data = self._merge_header_name(data, header_name)
            best = merge_request_payload(best, data)
            memo = build_request_memo_from_payload(best)
            if memo:
                best['requestMemo'] = memo
            if is_request_extract_complete(best):
                logger.info(
                    'request payload ready attempt=%s pairs=%s',
                    attempt + 1,
                    count_clean_request_pairs(best),
                )
                return best
        if best:
            memo = build_request_memo_from_payload(best)
            if memo:
                best['requestMemo'] = memo
        return merge_request_payload({}, self._merge_header_name(best, header_name))

    def extract_request_modal(self) -> dict[str, Any] | None:
        try:
            raw = self.driver.execute_script(_EXTRACT_BV_REQUEST_MODAL_JS)
            if not raw or not isinstance(raw, dict):
                raw = self.driver.execute_script(_EXTRACT_REQUEST_MODAL_JS)
            if not raw or not isinstance(raw, dict):
                return None
            pairs = raw.get('pairs') if isinstance(raw.get('pairs'), list) else []
            parsed = _parse_request_pairs(pairs)
            customer_name = raw.get('customerName')
            if isinstance(customer_name, str) and customer_name.strip():
                parsed['customerName'] = customer_name.strip()
            region = raw.get('region')
            if isinstance(region, str) and region.strip() and not parsed.get('region'):
                cleaned = region.strip()
                if is_plausible_soomgo_region(cleaned):
                    parsed['region'] = cleaned
            pref = raw.get('preferredDate')
            if isinstance(pref, str) and pref.strip() and not parsed.get('preferredDate'):
                parsed['preferredDate'] = pref.strip()
            py = raw.get('pyeong')
            if py and not parsed.get('pyeong'):
                parsed['pyeong'] = str(py)
            parsed['requestPairs'] = pairs
            parsed['requestRawText'] = str(raw.get('rawText', ''))[:4000]
            if not parsed.get('preferredDate'):
                pair_date = pick_preferred_date_from_pairs(pairs)
                if pair_date:
                    parsed['preferredDate'] = pair_date
            if is_garbage_request_extract(parsed):
                if has_meaningful_request_fields(parsed) or parsed.get('customerName') or parsed.get('pyeong'):
                    logger.warning('keeping partial request extract despite garbage filter')
                else:
                    return None
            return parsed
        except Exception as e:
            logger.error('extract_request_modal: %s', e)
            return None

    def close_request_modal(self) -> bool:
        try:
            if not self.is_request_modal_open():
                return True
            for _ in range(2):
                self.driver.execute_script(_CLOSE_REQUEST_MODAL_JS)
                time.sleep(self.delay * 0.22)
                if not self.is_request_modal_open():
                    return True
            self.driver.execute_script(
                "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));"
            )
            time.sleep(self.delay * 0.18)
            return not self.is_request_modal_open()
        except Exception as e:
            logger.debug('close_request_modal: %s', e)
            return False

    def extract_customer_request(self) -> dict[str, Any]:
        """순차: 전체보기/이름 클릭 → 요청 상세 대기 → 파싱 → 닫기."""
        empty: dict[str, Any] = {}
        dismiss_blocking_overlays(self.driver, self.delay * 0.25, max_rounds=2)

        try:
            from automation.call_modal import CallModalManager

            call_mgr = CallModalManager(self.driver, self.delay)
            if call_mgr.is_call_modal_open():
                call_mgr.close_call_modal()
                time.sleep(self.delay * 0.18)
        except Exception:
            pass

        header_name = self.get_header_customer_name()
        if header_name:
            empty['customerName'] = header_name

        self.close_request_modal()
        time.sleep(self.delay * 0.15)

        if not self.open_request_modal():
            logger.warning('open_request_modal failed; header=%s', header_name)
            return empty

        if not self.wait_for_request_modal_ready(timeout=REQUEST_MODAL_READY_TIMEOUT):
            logger.warning('customer request modal content not ready; header=%s', header_name)

        data = self._read_request_payload(header_name)
        if not data.get('customerName') and header_name:
            data = self._merge_header_name(data, header_name)
        if not is_request_extract_complete(data):
            logger.warning(
                'customer request extract incomplete; header=%s pairs=%s',
                header_name,
                count_clean_request_pairs(data),
            )

        self.close_request_modal()
        time.sleep(self.delay * 0.12)
        if self.is_request_modal_open():
            self.close_request_modal()
        return data
