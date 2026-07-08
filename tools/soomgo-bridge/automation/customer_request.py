"""숨고 채팅방 — 고객명·고객 요청 모달 파싱"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_DATE_RE = re.compile(r'(\d{4}-\d{2}-\d{2})')
_PYEONG_ANSWER_RE = re.compile(r'(\d{1,4})\s*평')

_GET_HEADER_NAME_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
function isName(t) {
  if (!t) return false;
  t = t.split('\\n')[0].trim();
  if (t === '접속 중' || t.indexOf('채팅') >= 0) return false;
  return /^[가-힣]{2,6}$/.test(t);
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
  if (!isName(t)) continue;
  var r = el.getBoundingClientRect();
  if (r.top > 220) continue;
  return t.split('\\n')[0].trim();
}
return null;
"""

_OPEN_REQUEST_MODAL_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
function isName(t) {
  if (!t) return false;
  t = t.split('\\n')[0].trim();
  if (t === '접속 중' || t.indexOf('채팅') >= 0) return false;
  return /^[가-힣]{2,6}$/.test(t);
}
var header = document.querySelector('header, [class*="chat-header"], [class*="ChatHeader"], [class*="room-header"]');
if (!header) header = document.body;
var nodes = header.querySelectorAll('button, a, [role="button"], h1, h2, h3, h4, span, div');
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  if (!visible(el)) continue;
  var t = (el.textContent || '').trim();
  if (!isName(t)) continue;
  var r = el.getBoundingClientRect();
  if (r.top > 220) continue;
  el.click();
  return true;
}
return false;
"""

_EXTRACT_REQUEST_MODAL_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
}
function isQuestion(line) {
  if (!line) return false;
  return /[?？]$/.test(line)
    || line.indexOf('선택해') >= 0
    || line.indexOf('입력해') >= 0
    || line.indexOf('알려주세요') >= 0
    || line.indexOf('원하시나요') >= 0;
}
var modal = null;
var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"]');
for (var i = 0; i < roots.length; i++) {
  var el = roots[i];
  if (!visible(el)) continue;
  var t = (el.innerText || el.textContent || '');
  if (t.indexOf('고객 요청') >= 0 || t.indexOf('요청 상세') >= 0) {
    modal = el;
    break;
  }
}
if (!modal) return null;
var text = (modal.innerText || modal.textContent || '').trim();
var lines = text.split('\\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
var pairs = [];
var pendingQ = null;
for (var j = 0; j < lines.length; j++) {
  var line = lines[j];
  if (line === '고객 요청' || line === '요청 상세' || line.indexOf('인터넷') >= 0) continue;
  if (isQuestion(line)) {
    pendingQ = line;
  } else if (pendingQ) {
    pairs.push({ question: pendingQ, answer: line });
    pendingQ = null;
  }
}
var customerName = null;
for (var k = 0; k < Math.min(lines.length, 15); k++) {
  var cand = lines[k];
  if (/^[가-힣]{2,6}$/.test(cand) && cand !== '고객 요청' && cand !== '요청 상세') {
    customerName = cand;
    break;
  }
}
return { customerName: customerName, pairs: pairs, rawText: text };
"""

_IS_REQUEST_MODAL_OPEN_JS = """
var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"]');
for (var i = 0; i < roots.length; i++) {
  var t = (roots[i].innerText || '');
  if (t.indexOf('고객 요청') >= 0 || t.indexOf('요청 상세') >= 0) return true;
}
return false;
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
        if not q or not a:
            continue
        memo_lines.append(f'{q}\n{a}')
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
        elif '희망일' in q or '날짜' in q:
            dm = _DATE_RE.search(a)
            result['preferredDate'] = dm.group(1) if dm else a
        elif '지역' in q:
            result['region'] = a
        elif '문의' in q:
            result['inquiryNote'] = a

    if memo_lines:
        result['requestMemo'] = '\n\n'.join(memo_lines)[:3000]
    return result


class CustomerRequestManager:
    def __init__(self, driver, delay: float = 1.2):
        self.driver = driver
        self.delay = delay

    def get_header_customer_name(self) -> str | None:
        try:
            name = self.driver.execute_script(_GET_HEADER_NAME_JS)
            if isinstance(name, str) and name.strip():
                return name.strip()
        except Exception as e:
            logger.debug('get_header_customer_name: %s', e)
        return None

    def is_request_modal_open(self) -> bool:
        try:
            return bool(self.driver.execute_script(_IS_REQUEST_MODAL_OPEN_JS))
        except Exception:
            return False

    def open_request_modal(self) -> bool:
        if self.is_request_modal_open():
            return True
        try:
            clicked = self.driver.execute_script(_OPEN_REQUEST_MODAL_JS)
            if clicked:
                import time
                time.sleep(self.delay)
            return self.is_request_modal_open()
        except Exception as e:
            logger.error('open_request_modal: %s', e)
            return False

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
            parsed['requestPairs'] = pairs
            parsed['requestRawText'] = str(raw.get('rawText', ''))[:4000]
            return parsed
        except Exception as e:
            logger.error('extract_request_modal: %s', e)
            return None

    def extract_customer_request(self) -> dict[str, Any]:
        import time
        empty: dict[str, Any] = {}
        name = self.get_header_customer_name()
        if name:
            empty['customerName'] = name
        if not self.open_request_modal():
            return empty
        time.sleep(self.delay * 0.5)
        data = self.extract_request_modal() or {}
        if name and not data.get('customerName'):
            data['customerName'] = name
        return data
