"""숨고 안심번호 통화 모달 — 열기·추출·버튼 클릭 감시"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from selenium.webdriver.common.by import By

from automation.customer_request import REQUEST_MODAL_DELAY
from automation.overlay_modals import dismiss_blocking_overlays

logger = logging.getLogger(__name__)

_SAFE_PHONE_RE = re.compile(r'050\d[-\s]?\d{3,4}[-\s]?\d{4}')

_INSTALL_WATCHER_JS = """
if (!window.__soomgoBridgeCallWatch) {
  window.__soomgoBridgeCallWatch = true;
  window.__soomgoBridgePendingCall = null;
  document.addEventListener('click', function(e) {
    var node = e.target;
    if (!node || !node.closest) return;
    var btn = node.closest('button, a, [role="button"]') || node;
    var text = (btn.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text.includes('안심번호로 통화하기')) return;
    var root = btn.closest('[role="dialog"]')
      || btn.closest('[class*="modal"]')
      || btn.closest('[class*="Modal"]')
      || document.body;
    var bodyText = (root.innerText || root.textContent || '');
    var m = bodyText.match(/050\\d[-\\s]?\\d{3,4}[-\\s]?\\d{4}/);
    if (!m) return;
    window.__soomgoBridgePendingCall = { phone: m[0], at: Date.now() };
  }, true);
}
return true;
"""

_SCAN_VISIBLE_PHONE_JS = """
var re = /050\\d[-\\s]?\\d{3,4}[-\\s]?\\d{4}/;
var dialogs = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"]');
for (var i = 0; i < dialogs.length; i++) {
  var t = dialogs[i].innerText || dialogs[i].textContent || '';
  if ((t.indexOf('안심번호') >= 0 || t.indexOf('숨고전화') >= 0) && re.test(t)) {
    var m = t.match(re);
    if (m) return m[0];
  }
}
return null;
"""

_OPEN_MODAL_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 16 || r.height < 16) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
}
function hasPhoneIcon(el) {
  if (!el) return false;
  if (el.querySelector('svg, img, [class*="phone"], [class*="Phone"], [class*="call"], [class*="Call"]')) return true;
  var label = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '') + ' ' + (el.getAttribute('title') || '')).trim();
  return /전화|통화|call/i.test(label);
}
function scorePhoneButton(el) {
  if (!visible(el)) return -1;
  var r = el.getBoundingClientRect();
  if (r.top > 140) return -1;
  var vw = window.innerWidth || 1200;
  var score = 0;
  if (r.right > vw * 0.72) score += 40;
  if (r.top < 90) score += 20;
  if (hasPhoneIcon(el)) score += 50;
  var label = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim();
  if (/전화|통화/i.test(label)) score += 30;
  if (/안심번호|채팅|메시지|더보기|설정/i.test(label)) score -= 80;
  if (el.closest('footer, [class*="composer"], [class*="input"]')) score -= 100;
  return score;
}
var best = null;
var bestScore = -1;
var nodes = document.querySelectorAll('header button, header a, [class*="header"] button, [class*="Header"] button, [class*="toolbar"] button, button, a[role="button"], [role="button"]');
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  var sc = scorePhoneButton(el);
  if (sc > bestScore) { bestScore = sc; best = el; }
}
if (best && bestScore >= 30) {
  best.click();
  return true;
}
return false;
"""

_EXTRACT_MODAL_PHONE_JS = """
function visibleText(el) {
  if (!el) return '';
  var style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return '';
  return (el.innerText || el.textContent || '').trim();
}
var chunks = [];
var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="overlay"], [class*="Overlay"]');
for (var i = 0; i < roots.length; i++) {
  var t = visibleText(roots[i]);
  if (t && (t.indexOf('숨고전화') >= 0 || t.indexOf('안심번호') >= 0 || /050\\d/.test(t))) chunks.push(t);
}
var all = document.querySelectorAll('button, p, span, div, h1, h2, h3, strong');
for (var j = 0; j < all.length; j++) {
  var el = all[j];
  var t2 = visibleText(el);
  if (!t2 || t2.length > 120) continue;
  if (/050\\d[-\\s]?\\d{3,4}[-\\s]?\\d{4}/.test(t2)) chunks.push(t2);
}
if (!chunks.length) {
  var body = (document.body.innerText || '');
  if (body.indexOf('숨고전화') >= 0 || body.indexOf('안심번호로 통화하기') >= 0) chunks.push(body);
}
return chunks.join('\\n');
"""

_CLOSE_CALL_MODAL_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
function findCallModal() {
  var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="overlay"], [class*="Overlay"], [class*="sheet"], [class*="Sheet"]');
  for (var i = 0; i < roots.length; i++) {
    var t = (roots[i].innerText || '');
    if (t.indexOf('숨고전화') >= 0 || t.indexOf('안심번호로 통화') >= 0 || /050\\d/.test(t)) return roots[i];
  }
  var body = (document.body.innerText || '');
  if (body.indexOf('숨고전화로 통화') >= 0 || body.indexOf('안심번호로 통화하기') >= 0) return document.body;
  return null;
}
function normLabel(el) {
  return ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '') + ' ' + (el.getAttribute('title') || '')).replace(/\\s+/g, ' ').trim();
}
var modal = findCallModal();
if (!modal) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  return 'escape';
}
var modalRect = modal.getBoundingClientRect();
var nodes = modal.querySelectorAll('button, [role="button"], a, span, p, div');
var cancelBest = null;
var cancelScore = -1;
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  if (!visible(el)) continue;
  var label = normLabel(el);
  if (!label || label.length > 24) continue;
  if (label !== '취소' && !/^취소$/i.test(label)) continue;
  var r = el.getBoundingClientRect();
  var score = 100;
  if (r.bottom >= modalRect.bottom - 140) score += 60;
  if (r.top >= modalRect.top + 80) score += 20;
  if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') score += 25;
  if (score > cancelScore) { cancelScore = score; cancelBest = el; }
}
if (cancelBest && cancelScore >= 100) {
  cancelBest.click();
  return 'cancel';
}
var best = null;
var bestScore = -1;
var buttons = modal.querySelectorAll('button, [role="button"], a, span, p');
for (var j = 0; j < buttons.length; j++) {
  var btn = buttons[j];
  if (!visible(btn)) continue;
  var lbl = normLabel(btn);
  var br = btn.getBoundingClientRect();
  var sc = 0;
  if (/^취소$/i.test(lbl)) sc += 90;
  if (/닫기|close/i.test(lbl)) sc += 40;
  if (/안심번호|통화하기/i.test(lbl)) sc -= 200;
  if (br.bottom >= modalRect.bottom - 120) sc += 30;
  if (br.top <= modalRect.top + 80 && br.right >= modalRect.right - 80) sc += 15;
  if (sc > bestScore) { bestScore = sc; best = btn; }
}
if (best && bestScore >= 40) {
  best.click();
  return 'fallback';
}
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
return 'escape';
"""

_IS_PHONE_CONSULT_MODAL_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="sheet"], [class*="Sheet"], [class*="overlay"], [class*="Overlay"]');
for (var i = 0; i < roots.length; i++) {
  if (!visible(roots[i])) continue;
  var t = (roots[i].innerText || roots[i].textContent || '');
  if (t.indexOf('전화상담') >= 0 && (t.indexOf('요청') >= 0 || t.indexOf('승인') >= 0)) return true;
}
return false;
"""

_CLICK_PHONE_CONSULT_REQUEST_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 16 || r.height < 16) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
function findConsultModal() {
  var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="sheet"], [class*="Sheet"], [class*="overlay"], [class*="Overlay"]');
  for (var i = 0; i < roots.length; i++) {
    if (!visible(roots[i])) continue;
    var t = (roots[i].innerText || roots[i].textContent || '');
    if (t.indexOf('전화상담') >= 0 && (t.indexOf('요청') >= 0 || t.indexOf('승인') >= 0)) return roots[i];
  }
  return null;
}
var modal = findConsultModal();
if (!modal) return false;
var nodes = modal.querySelectorAll('button, a, [role="button"]');
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  if (!visible(el)) continue;
  var label = (el.textContent || '').replace(/\\s+/g, ' ').trim();
  if (label.indexOf('전화상담 요청하기') >= 0) {
    el.click();
    return true;
  }
}
return false;
"""

_CLOSE_PHONE_CONSULT_MODAL_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
}
function findConsultModal() {
  var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="sheet"], [class*="Sheet"], [class*="overlay"], [class*="Overlay"]');
  for (var i = 0; i < roots.length; i++) {
    var t = (roots[i].innerText || roots[i].textContent || '');
    if (t.indexOf('전화상담') >= 0 && (t.indexOf('요청') >= 0 || t.indexOf('승인') >= 0)) return roots[i];
  }
  return null;
}
function normLabel(el) {
  return ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '') + ' ' + (el.getAttribute('title') || '')).replace(/\\s+/g, ' ').trim();
}
var modal = findConsultModal();
if (!modal) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  return 'escape';
}
var nodes = modal.querySelectorAll('button, a, [role="button"], span, p');
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  if (!visible(el)) continue;
  var label = normLabel(el);
  if (/^취소$/i.test(label) || label.indexOf('닫기') >= 0) {
    el.click();
    return 'cancel';
  }
}
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
return 'escape';
"""


def format_safe_phone(raw: str) -> str:
    digits = re.sub(r'\D', '', raw)
    if len(digits) == 11 and digits.startswith('050'):
        return f'{digits[:4]}-{digits[4:8]}-{digits[8:]}'
    if len(digits) == 12 and digits.startswith('050'):
        return f'{digits[:4]}-{digits[4:7]}-{digits[7:]}'
    return raw.strip()


def extract_phone_from_text(text: str) -> str | None:
    for m in _SAFE_PHONE_RE.finditer(text):
        formatted = format_safe_phone(m.group(0))
        if len(re.sub(r'\D', '', formatted)) >= 10:
            return formatted
    return None


class CallModalManager:
    def __init__(self, driver, delay: float = REQUEST_MODAL_DELAY):
        self.driver = driver
        self.delay = delay
        self._watcher_installed = False

    def install_call_button_watcher(self) -> bool:
        try:
            ok = self.driver.execute_script(_INSTALL_WATCHER_JS)
            self._watcher_installed = bool(ok)
            return self._watcher_installed
        except Exception as e:
            logger.error('install_call_button_watcher: %s', e)
            return False

    def poll_pending_call(self) -> dict[str, Any] | None:
        try:
            raw = self.driver.execute_script('return window.__soomgoBridgePendingCall || null;')
            if not raw or not isinstance(raw, dict):
                return None
            phone_raw = str(raw.get('phone', '')).strip()
            at = raw.get('at')
            phone = extract_phone_from_text(phone_raw) or format_safe_phone(phone_raw)
            digits = re.sub(r'\D', '', phone)
            if len(digits) < 10:
                return None
            return {'phone': phone, 'at': int(at) if at is not None else int(time.time() * 1000)}
        except Exception as e:
            logger.debug('poll_pending_call: %s', e)
            return None

    def clear_pending_call(self) -> None:
        try:
            self.driver.execute_script('window.__soomgoBridgePendingCall = null;')
        except Exception:
            pass

    def is_call_modal_open(self) -> bool:
        try:
            text = self.driver.execute_script(_EXTRACT_MODAL_PHONE_JS)
            if not isinstance(text, str):
                return False
            return '안심번호' in text or '숨고전화' in text
        except Exception:
            return False

    def open_call_modal(self) -> bool:
        dismiss_blocking_overlays(self.driver, self.delay * 0.25, max_rounds=2)
        if self.is_call_modal_open():
            return True
        try:
            for attempt in range(3):
                clicked = self.driver.execute_script(_OPEN_MODAL_JS)
                if clicked:
                    time.sleep(self.delay * 0.35)
                    if self.is_call_modal_open():
                        return True
                for selector in [
                    "button[class*='phone']",
                    "[data-testid*='phone']",
                    "img[alt*='전화']",
                    "header button",
                ]:
                    for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                        if not elem.is_displayed():
                            continue
                        try:
                            rect = elem.rect
                            if rect.get('y', 999) > 160:
                                continue
                        except Exception:
                            pass
                        elem.click()
                        time.sleep(self.delay * 0.3)
                        if self.is_call_modal_open():
                            return True
                time.sleep(self.delay * 0.2)
            return self.is_call_modal_open()
        except Exception as e:
            logger.error('open_call_modal: %s', e)
            return False

    def extract_call_number_from_modal(self) -> str | None:
        try:
            text = self.driver.execute_script(_EXTRACT_MODAL_PHONE_JS)
            if not isinstance(text, str):
                return None
            return extract_phone_from_text(text)
        except Exception as e:
            logger.error('extract_call_number_from_modal: %s', e)
            return None

    def close_call_modal(self) -> bool:
        try:
            if not self.is_call_modal_open():
                return True
            for _ in range(3):
                result = self.driver.execute_script(_CLOSE_CALL_MODAL_JS)
                time.sleep(self.delay * 0.22)
                if not self.is_call_modal_open():
                    logger.debug('close_call_modal via %s', result)
                    return True
            return not self.is_call_modal_open()
        except Exception as e:
            logger.debug('close_call_modal: %s', e)
            try:
                self.driver.execute_script(
                    "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));"
                )
            except Exception:
                pass
            return False

    def peek_safe_phone_without_modal(self) -> str | None:
        """이미 열린 통화 모달에서만 번호 스캔 (클릭 없음)."""
        try:
            if not self.is_call_modal_open():
                return None
            return self.extract_call_number_from_modal()
        except Exception as e:
            logger.debug('peek_safe_phone_without_modal: %s', e)
            return None

    def is_phone_consult_modal_open(self) -> bool:
        try:
            return bool(self.driver.execute_script(_IS_PHONE_CONSULT_MODAL_JS))
        except Exception:
            return False

    def close_phone_consult_modal(self) -> bool:
        try:
            if not self.is_phone_consult_modal_open():
                return True
            for _ in range(3):
                self.driver.execute_script(_CLOSE_PHONE_CONSULT_MODAL_JS)
                time.sleep(self.delay * 0.2)
                if not self.is_phone_consult_modal_open():
                    return True
            return not self.is_phone_consult_modal_open()
        except Exception as e:
            logger.debug('close_phone_consult_modal: %s', e)
            return False

    def request_phone_consultation(self) -> str:
        """전화 아이콘 → 전화상담 요청하기 → 닫기. requested | already_open | failed | skipped."""
        try:
            dismiss_blocking_overlays(self.driver, self.delay * 0.15, max_rounds=1)
            if self.is_phone_consult_modal_open():
                clicked = self.driver.execute_script(_CLICK_PHONE_CONSULT_REQUEST_JS)
                time.sleep(self.delay * 0.35)
                self.close_phone_consult_modal()
                return 'requested' if clicked else 'failed'
            if not self.open_call_modal():
                return 'failed'
            time.sleep(self.delay * 0.25)
            if self.is_call_modal_open() and not self.is_phone_consult_modal_open():
                self.close_call_modal()
                return 'skipped'
            if not self.is_phone_consult_modal_open():
                return 'failed'
            clicked = self.driver.execute_script(_CLICK_PHONE_CONSULT_REQUEST_JS)
            time.sleep(self.delay * 0.35)
            self.close_phone_consult_modal()
            time.sleep(self.delay * 0.12)
            if self.is_phone_consult_modal_open():
                self.close_phone_consult_modal()
            return 'requested' if clicked else 'failed'
        except Exception as e:
            logger.error('request_phone_consultation: %s', e)
            self.close_phone_consult_modal()
            self.close_call_modal()
            return 'failed'

    def try_extract_safe_phone(self, known_phone: str | None = None) -> str | None:
        """전화 모달 열기 → 050 추출 → 취소로 채팅방 복귀."""
        if known_phone:
            digits = re.sub(r'\D', '', known_phone)
            if len(digits) >= 10:
                return format_safe_phone(known_phone)
        try:
            peeked = self.peek_safe_phone_without_modal()
            if peeked:
                return peeked
            dismiss_blocking_overlays(self.driver, self.delay * 0.15, max_rounds=1)
            opened = self.open_call_modal()
            if not opened:
                return None
            time.sleep(self.delay * 0.15)
            phone = self.extract_call_number_from_modal()
            self.close_call_modal()
            time.sleep(self.delay * 0.1)
            if self.is_call_modal_open():
                self.close_call_modal()
            if phone and re.sub(r'\D', '', phone).startswith('050'):
                return phone
            if phone:
                return phone
            return None
        except Exception as e:
            logger.error('try_extract_safe_phone: %s', e)
            self.close_call_modal()
            return None
