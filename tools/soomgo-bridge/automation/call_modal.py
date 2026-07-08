"""숨고 안심번호 통화 모달 — 열기·추출·버튼 클릭 감시"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from selenium.webdriver.common.by import By

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
  return st.display !== 'none' && st.visibility !== 'hidden';
}
function findCallModal() {
  var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="overlay"], [class*="Overlay"]');
  for (var i = 0; i < roots.length; i++) {
    var t = (roots[i].innerText || '');
    if (t.indexOf('안심번호') >= 0 || t.indexOf('숨고전화') >= 0 || /050\\d/.test(t)) return roots[i];
  }
  return null;
}
var modal = findCallModal();
if (!modal) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  return true;
}
var modalRect = modal.getBoundingClientRect();
var best = null;
var bestScore = -1;
var buttons = modal.querySelectorAll('button, [role="button"], a');
for (var i = 0; i < buttons.length; i++) {
  var btn = buttons[i];
  if (!visible(btn)) continue;
  var r = btn.getBoundingClientRect();
  var label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '')).trim();
  var score = 0;
  if (r.top <= modalRect.top + 80) score += 25;
  if (r.right >= modalRect.right - 80) score += 35;
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
    def __init__(self, driver, delay: float = 1.2):
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
        if self.is_call_modal_open():
            return True
        try:
            for attempt in range(3):
                clicked = self.driver.execute_script(_OPEN_MODAL_JS)
                if clicked:
                    time.sleep(self.delay)
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
                        time.sleep(self.delay * 0.6)
                        if self.is_call_modal_open():
                            return True
                time.sleep(self.delay * 0.4)
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
            self.driver.execute_script(_CLOSE_CALL_MODAL_JS)
            time.sleep(self.delay * 0.35)
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

    def try_extract_safe_phone(self) -> str | None:
        """전화 모달 열기 → 050 안심번호 추출 → 없으면 모달 닫고 None (채팅방 유지)."""
        try:
            opened = self.open_call_modal()
            if not opened:
                return None
            time.sleep(self.delay * 0.45)
            phone = self.extract_call_number_from_modal()
            self.close_call_modal()
            time.sleep(self.delay * 0.25)
            if phone and re.sub(r'\D', '', phone).startswith('050'):
                return phone
            if phone:
                return phone
            return None
        except Exception as e:
            logger.error('try_extract_safe_phone: %s', e)
            self.close_call_modal()
            return None
