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
var clicked = false;
var selectors = [
  'button[aria-label*="전화"]',
  'button[aria-label*="통화"]',
  'a[aria-label*="전화"]',
  '[class*="phone"] button',
  'header button',
  'button'
];
for (var s = 0; s < selectors.length && !clicked; s++) {
  var nodes = document.querySelectorAll(selectors[s]);
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (!el || !el.offsetParent) continue;
    var label = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim();
    var hasPhoneIcon = !!el.querySelector('svg, img, [class*="phone"], [class*="Phone"]');
    if (label.includes('전화') || label.includes('통화') || hasPhoneIcon) {
      if (label.includes('안심번호')) continue;
      el.click();
      clicked = true;
      break;
    }
  }
}
return clicked;
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
            clicked = self.driver.execute_script(_OPEN_MODAL_JS)
            if clicked:
                time.sleep(self.delay)
                return self.is_call_modal_open()
            for selector in [
                "button[class*='phone']",
                "[data-testid*='phone']",
                "img[alt*='전화']",
            ]:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed():
                        elem.click()
                        time.sleep(self.delay)
                        if self.is_call_modal_open():
                            return True
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
