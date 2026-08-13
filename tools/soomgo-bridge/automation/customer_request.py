"""숨고 채팅방 — 고객명·고객 요청 모달 파싱"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from automation.overlay_modals import dismiss_blocking_overlays
from automation.selectors import SOOMGO_DISPLAY_NAME_JS
from automation.soomgo_text_filters import (
    filter_soomgo_memo_lines,
    has_meaningful_request_fields,
    is_garbage_request_extract,
    is_plausible_soomgo_region,
    is_soomgo_boilerplate_line,
)

logger = logging.getLogger(__name__)

REQUEST_MODAL_DELAY = 0.45
REQUEST_MODAL_READY_TIMEOUT = 5.0
REQUEST_MODAL_POLL_SEC = 0.08
REQUEST_MODAL_OPEN_WAIT_SEC = 3.2
REQUEST_MODAL_RETRY_WAIT_SEC = 2.0
REQUEST_MODAL_EXTRACT_SETTLE_SEC = 0.35

_DATE_RE = re.compile(r'(\d{4}-\d{2}-\d{2})')
_PYEONG_ANSWER_RE = re.compile(r'(\d{1,4})\s*평')
_COUNT_ANSWER_RE = re.compile(r'(\d{1,2})')


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
  var best = null;
  var bestScore = -1;
  var selectors = '[role="dialog"], [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"], [class*="sheet"], [class*="Sheet"], [class*="panel"], [class*="Panel"], aside, section';
  var roots = document.querySelectorAll(selectors);
  for (var i = 0; i < roots.length; i++) {
    var el = roots[i];
    if (!visible(el)) continue;
    var t = (el.innerText || el.textContent || '');
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
var pyeong = null;
var dateM = text.match(/\\d{4}-\\d{2}-\\d{2}/);
if (dateM) preferredDate = dateM[0];
var pyeongM = text.match(/(\\d{1,4})\\s*평/);
if (pyeongM) pyeong = pyeongM[1];
return { customerName: customerName, region: region, preferredDate: preferredDate, pyeong: pyeong, pairs: pairs, rawText: text };
"""

_IS_REQUEST_MODAL_OPEN_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 80 || r.height < 80) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
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
  if (r.width < 80 || r.height < 80) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
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
        if '서비스' in q and '원하' in q:
            result['serviceType'] = a
        elif '건물' in q:
            result['buildingType'] = a
        elif '방 개수' in q:
            result['roomCount'] = a
        elif '화장실' in q:
            result['bathroomCount'] = a
        elif '베란다 개수' in q:
            result['verandaCount'] = a
        elif '공간' in q and '항목' in q:
            result['spaceItems'] = a
        elif '추가' in q and '서비스' in q:
            result['extraServices'] = a
        elif '평수' in q or '공급면적' in q:
            pm = _PYEONG_ANSWER_RE.search(a)
            result['pyeong'] = pm.group(1) if pm else a.replace('평', '').strip()
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
            elif _DATE_RE.search(a) and not result.get('preferredDate'):
                dm = _DATE_RE.search(a)
                if dm:
                    result['preferredDate'] = dm.group(1)

    if memo_lines:
        result['requestMemo'] = '\n\n'.join(filter_soomgo_memo_lines(memo_lines))[:3000]

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
                dm = _DATE_RE.search(a)
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
        if not self._modal_ready_light():
            return False
        data = self.extract_request_modal()
        return bool(data and has_meaningful_request_fields(data))

    def wait_for_request_modal_ready(self, timeout: float = REQUEST_MODAL_READY_TIMEOUT) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            if not self.is_request_modal_open():
                time.sleep(REQUEST_MODAL_POLL_SEC)
                continue
            if self._modal_has_content():
                return True
            if self._modal_ready_light():
                time.sleep(REQUEST_MODAL_EXTRACT_SETTLE_SEC)
                if self._modal_has_content():
                    return True
            time.sleep(REQUEST_MODAL_POLL_SEC)
        return self._modal_has_content()

    def _try_open_via_script(self, script: str, wait_timeout: float) -> bool:
        try:
            clicked = self.driver.execute_script(script)
        except Exception as e:
            logger.debug('try_open script failed: %s', e)
            return False
        if not clicked:
            return False
        time.sleep(self.delay * 0.35)
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
        time.sleep(REQUEST_MODAL_EXTRACT_SETTLE_SEC)
        data = self.extract_request_modal() or {}
        data = self._merge_header_name(data, header_name)
        if has_meaningful_request_fields(data):
            return data
        time.sleep(self.delay * 0.25)
        retry = self.extract_request_modal() or {}
        retry = self._merge_header_name(retry, header_name)
        if has_meaningful_request_fields(retry):
            return retry
        return data

    def extract_request_modal(self) -> dict[str, Any] | None:
        try:
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
            if is_garbage_request_extract(parsed):
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
        if not has_meaningful_request_fields(data):
            logger.warning('customer request extract empty/garbage; header=%s', header_name)
            data = self._merge_header_name({}, header_name)

        self.close_request_modal()
        time.sleep(self.delay * 0.12)
        if self.is_request_modal_open():
            self.close_request_modal()
        return data
