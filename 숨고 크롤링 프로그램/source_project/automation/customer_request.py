"""숨고 채팅방 — 고객요청 모달에서 희망일 원문 추출 (오래된 채팅 정리용)."""
from __future__ import annotations

import logging
import re
import time
from typing import Any

logger = logging.getLogger(__name__)

REQUEST_MODAL_DELAY = 0.45
REQUEST_MODAL_OPEN_WAIT_SEC = 4.0
REQUEST_MODAL_READY_TIMEOUT = 8.0
REQUEST_MODAL_EXTRACT_SETTLE_SEC = 0.55

_DATE_RE = re.compile(r'(\d{4}-\d{2}-\d{2})')
_DATE_QUESTION_RE = re.compile(
    r'희망일|원하는\s*날짜|청소\s*날짜|이사\s*날짜|입주\s*날짜|날짜|언제|일정|희망\s*하|원하시는\s*날|원하는\s*날|청소.*희망',
)

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

_OPEN_REQUEST_MODAL_JS = SOOMGO_DISPLAY_NAME_JS + """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
function scoreNameClick(el) {
  var t = (el.textContent || '').trim();
  var first = t.split('\\n')[0].trim();
  if (!isSoomgoDisplayName(first)) return -1;
  var r = el.getBoundingClientRect();
  var score = 0;
  if (r.top < 130) score += 60;
  if (r.left < 420) score += 50;
  if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') score += 35;
  return score;
}
var scopes = document.querySelectorAll('header, [class*="chat-header"], [class*="ChatHeader"], main');
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
  (best.closest('button, a, [role="button"]') || best).click();
  return true;
}
return false;
"""

_IS_REQUEST_MODAL_OPEN_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
var items = document.querySelectorAll(
  '.modal.show li[data-name="request-item"], [id*="BV_modal_body"] li[data-name="request-item"]'
);
for (var i = 0; i < items.length; i++) {
  if (visible(items[i])) return true;
}
var roots = document.querySelectorAll('[role="dialog"], .modal.show, [class*="Modal"]');
for (var j = 0; j < roots.length; j++) {
  if (!visible(roots[j])) continue;
  var t = roots[j].innerText || '';
  if (t.indexOf('요청 상세') >= 0 && t.indexOf('?') >= 0) return true;
}
return false;
"""

_EXTRACT_BV_REQUEST_MODAL_JS = SOOMGO_DISPLAY_NAME_JS + """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.01;
}
function findRequestItems() {
  var selectors = [
    '.modal.show li[data-name="request-item"]',
    '[id*="BV_modal_body"] li[data-name="request-item"]',
    '.mobile-full-modal li[data-name="request-item"]',
    'li[data-name="request-item"]'
  ];
  for (var si = 0; si < selectors.length; si++) {
    var nodes = document.querySelectorAll(selectors[si]);
    if (nodes.length > 0) return nodes;
  }
  return document.querySelectorAll('li[data-name="request-item"]');
}
var requestItems = findRequestItems();
var body = null;
if (requestItems.length > 0) {
  body = requestItems[0].closest('.modal-body, [id*="BV_modal_body"], .modal-content') || requestItems[0].parentElement;
}
function isDateQuestion(text) {
  if (!text) return false;
  return /날짜|희망|원하는|언제|일정|청소.*날/.test(text);
}
function pushPair(q, a) {
  q = (q || '').replace(/\\s+/g, ' ').trim();
  a = (a || '').replace(/\\s+/g, ' ').trim();
  if (!a || (q && q === a)) return;
  pairs.push({ question: q, answer: a });
}
var pairs = [];
for (var ri = 0; ri < requestItems.length; ri++) {
  var item = requestItems[ri];
  var qEl = item.querySelector('[data-name="question"], p[data-name="question"]');
  var aEl = item.querySelector('[data-name="answer"], p[data-name="answer"]');
  if (qEl && aEl) {
    pushPair(qEl.textContent, aEl.textContent);
  }
}
var preferredDate = null;
for (var pi = 0; pi < pairs.length; pi++) {
  var combined = (pairs[pi].question || '') + ' ' + (pairs[pi].answer || '');
  if (!isDateQuestion(combined) && combined.indexOf('희망') < 0 && combined.indexOf('날짜') < 0) continue;
  if (pairs[pi].answer) { preferredDate = pairs[pi].answer; break; }
}
if (pairs.length === 0 && !preferredDate) return null;
return { preferredDate: preferredDate, pairs: pairs, source: 'bv-modal' };
"""

_CLOSE_REQUEST_MODAL_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
var closeBtns = document.querySelectorAll(
  '.modal.show button[aria-label*="닫"], .modal.show .close, [id*="BV_modal"] button.close, button[class*="close"]'
);
for (var i = 0; i < closeBtns.length; i++) {
  if (visible(closeBtns[i])) { closeBtns[i].click(); return 'close_button'; }
}
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
return 'escape';
"""


def pick_preferred_date_from_pairs(pairs: list[dict[str, str]]) -> str | None:
    for item in pairs:
        q = str(item.get('question', '')).strip()
        a = str(item.get('answer', '')).strip()
        if not q and not a:
            continue
        if not _DATE_QUESTION_RE.search(q) and not _DATE_QUESTION_RE.search(a):
            if '날짜' not in q and '희망' not in q:
                continue
        if a:
            return a
        m = _DATE_RE.search(q)
        if m:
            return m.group(1)
    return None


def pick_preferred_date_raw_from_request(data: dict[str, Any]) -> str | None:
    """고객요청 모달 — 희망일 원문 (ISO·한글·협의 문구 포함)."""
    pref = data.get('preferredDate')
    if isinstance(pref, str) and pref.strip():
        return pref.strip()
    pairs = data.get('requestPairs') or []
    if isinstance(pairs, list):
        for item in pairs:
            if not isinstance(item, dict):
                continue
            q = str(item.get('question', '')).strip()
            a = str(item.get('answer', '')).strip()
            if not q and not a:
                continue
            if not _DATE_QUESTION_RE.search(q) and '날짜' not in q and '희망' not in q:
                if '청소' not in q or '날짜' not in q:
                    continue
            if a:
                return a
    return pick_preferred_date_from_pairs(pairs if isinstance(pairs, list) else [])


class CustomerRequestReader:
    """채팅방에서 고객요청 모달을 열어 희망일 등을 읽는다."""

    def __init__(self, driver, delay: float = REQUEST_MODAL_DELAY):
        self.driver = driver
        self.delay = delay

    def is_request_modal_open(self) -> bool:
        try:
            return bool(self.driver.execute_script(_IS_REQUEST_MODAL_OPEN_JS))
        except Exception:
            return False

    def close_request_modal(self) -> None:
        try:
            for _ in range(4):
                if not self.is_request_modal_open():
                    return
                self.driver.execute_script(_CLOSE_REQUEST_MODAL_JS)
                time.sleep(self.delay * 0.25)
        except Exception as e:
            logger.debug('close_request_modal: %s', e)

    def open_request_modal(self) -> bool:
        self.close_request_modal()
        time.sleep(self.delay * 0.12)
        strategies = (
            _OPEN_PROFILE_REQUEST_MODAL_JS,
            _OPEN_CUSTOMER_REQUEST_VIEW_JS,
            _OPEN_REQUEST_MODAL_JS,
        )
        for script in strategies:
            try:
                clicked = self.driver.execute_script(script)
                if clicked:
                    time.sleep(self.delay * 0.4)
                deadline = time.time() + REQUEST_MODAL_OPEN_WAIT_SEC
                while time.time() < deadline:
                    if self.is_request_modal_open():
                        time.sleep(REQUEST_MODAL_EXTRACT_SETTLE_SEC)
                        return True
                    time.sleep(0.15)
            except Exception as e:
                logger.debug('open_request_modal strategy: %s', e)
        return self.is_request_modal_open()

    def extract_request_modal(self) -> dict[str, Any] | None:
        try:
            raw = self.driver.execute_script(_EXTRACT_BV_REQUEST_MODAL_JS)
            if not raw or not isinstance(raw, dict):
                return None
            pairs = raw.get('pairs') if isinstance(raw.get('pairs'), list) else []
            parsed: dict[str, Any] = {'requestPairs': pairs}
            pref = raw.get('preferredDate')
            if isinstance(pref, str) and pref.strip():
                parsed['preferredDate'] = pref.strip()
            elif pairs:
                pair_date = pick_preferred_date_from_pairs(pairs)
                if pair_date:
                    parsed['preferredDate'] = pair_date
            return parsed
        except Exception as e:
            logger.warning('extract_request_modal: %s', e)
            return None

    def extract_customer_request(self) -> dict[str, Any]:
        """고객요청 모달 열기 → 파싱 → 닫기."""
        empty: dict[str, Any] = {}
        if not self.open_request_modal():
            logger.debug('open_request_modal failed')
            return empty
        data = self.extract_request_modal() or empty
        self.close_request_modal()
        return data
