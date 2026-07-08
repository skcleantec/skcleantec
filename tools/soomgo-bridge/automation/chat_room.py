"""채팅방 읽기·메시지 전송·필드 파싱"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from automation.selectors import URLS

logger = logging.getLogger(__name__)

_PHONE_RE = re.compile(r'01[016789][-\s]?\d{3,4}[-\s]?\d{4}')
_PYEONG_RE = re.compile(r'(\d{1,4})\s*평')
_ADDRESS_HINT = re.compile(r'[가-힣]{2,}(?:시|군|구|동|로|길|아파트|APT|apt|빌라|타운)')

_INPUT_JS = """
const elem = arguments[0];
const message = arguments[1];
if (elem.tagName.toLowerCase() === 'textarea' || elem.tagName.toLowerCase() === 'input') {
    elem.value = message;
    elem.dispatchEvent(new Event('input', { bubbles: true }));
    elem.dispatchEvent(new Event('change', { bubbles: true }));
} else if (elem.hasAttribute('contenteditable') || elem.getAttribute('role') === 'textbox') {
    elem.focus();
    elem.textContent = message;
    elem.dispatchEvent(new Event('input', { bubbles: true }));
    elem.dispatchEvent(new Event('change', { bubbles: true }));
}
"""

_SEND_MESSAGE_JS = """
var message = arguments[0];
function isVisible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 20 || r.height < 8) return false;
  var st = window.getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
}
document.querySelectorAll('.quick-message-tooltip, [class*="tooltip"]').forEach(function(t) {
  try { t.style.display = 'none'; } catch (e) {}
});
function setInputValue(el, text) {
  el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.value = text;
  } else {
    el.textContent = text;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
var input = document.querySelector('textarea[name="message-input"], textarea.message-input');
if (!input || !isVisible(input)) {
  var inputs = document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], div[role="textbox"]');
  var bestBottom = -1;
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    if (!isVisible(el)) continue;
    var r = el.getBoundingClientRect();
    if (r.bottom >= bestBottom) {
      bestBottom = r.bottom;
      input = el;
    }
  }
}
if (!input) return { ok: false, reason: 'input_not_found' };
setInputValue(input, message);
var root = input.closest('form, footer, [class*="chat"], [class*="Chat"], [class*="composer"], [class*="input"]') || input.parentElement || document;
var buttons = root.querySelectorAll('button, [role="button"], img.btn-submit, .btn-submit');
var sendBtn = null;
for (var j = 0; j < buttons.length; j++) {
  var btn = buttons[j];
  if (!isVisible(btn)) continue;
  var label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '') + ' ' + (btn.getAttribute('alt') || '')).trim();
  if (/전송|보내기|submit|send/i.test(label) || btn.className.indexOf('submit') >= 0) {
    sendBtn = btn;
    break;
  }
}
if (!sendBtn) {
  var allBtns = document.querySelectorAll('button, [role="button"]');
  for (var k = allBtns.length - 1; k >= 0; k--) {
    var b = allBtns[k];
    if (!isVisible(b)) continue;
    var br = b.getBoundingClientRect();
    var ir = input.getBoundingClientRect();
    if (Math.abs(br.bottom - ir.bottom) < 80 && br.left >= ir.left - 40) {
      sendBtn = b;
      break;
    }
  }
}
if (sendBtn) {
  sendBtn.click();
  return { ok: true, reason: 'clicked' };
}
try {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  return { ok: true, reason: 'enter' };
} catch (e) {
  return { ok: false, reason: 'send_button_not_found' };
}
"""


def _digits_phone(raw: str) -> str:
    digits = re.sub(r'\D', '', raw)
    if len(digits) >= 10 and digits.startswith('01'):
        if len(digits) == 10:
            return f'{digits[:3]}-{digits[3:6]}-{digits[6:]}'
        if len(digits) == 11:
            return f'{digits[:3]}-{digits[3:7]}-{digits[7:]}'
    return digits


def parse_fields_from_texts(texts: list[str]) -> dict[str, Any]:
    joined = '\n'.join(t for t in texts if t)
    phone = None
    for m in _PHONE_RE.finditer(joined):
        phone = _digits_phone(m.group(0))
        if len(re.sub(r'\D', '', phone)) >= 10:
            break

    pyeong = None
    pm = _PYEONG_RE.search(joined)
    if pm:
        pyeong = pm.group(1)

    address = None
    for line in texts:
        if _ADDRESS_HINT.search(line) and len(line) >= 6:
            address = line.strip()[:200]
            break

    memo_lines = [t.strip() for t in texts if t.strip() and len(t.strip()) > 2]
    memo = '\n'.join(memo_lines[-8:])[:2000] if memo_lines else None

    return {
        'phone': phone,
        'pyeong': pyeong,
        'address': address,
        'memo': memo,
    }


class ChatRoomManager:
    def __init__(self, driver, delay: float = 1.2):
        self.driver = driver
        self.delay = delay

    def is_in_chat_room(self) -> bool:
        try:
            url = self.driver.current_url
            return '/pro/chats/' in url and url.rstrip('/').split('/pro/chats/')[-1].split('?')[0].isdigit()
        except Exception:
            return False

    def get_current_chat_id(self) -> str | None:
        try:
            m = re.search(r'/pro/chats/(\d+)', self.driver.current_url)
            return m.group(1) if m else None
        except Exception:
            return None

    def get_nickname(self) -> str | None:
        try:
            name = self.driver.execute_script("""
                var selectors = ['h1','h2','h3','header h2','header h3','[class*="nickname"]','[class*="user-name"]'];
                for (var i = 0; i < selectors.length; i++) {
                    var el = document.querySelector(selectors[i]);
                    if (!el) continue;
                    var t = (el.textContent || '').trim();
                    if (t && t.length < 40 && !t.includes('채팅')) return t;
                }
                return null;
            """)
            return name if isinstance(name, str) and name.strip() else None
        except Exception:
            return None

    def get_customer_messages(self) -> list[str]:
        try:
            result = self.driver.execute_script("""
                var msgs = [];
                var allLi = document.querySelectorAll('li');
                for (var i = 0; i < allLi.length; i++) {
                    var li = allLi[i];
                    var style = window.getComputedStyle(li);
                    if (style.textAlign === 'right') continue;
                    var text = (li.textContent || '')
                        .replace(/오전|오후|안읽음|읽음/g, '').trim();
                    if (text.length > 1) msgs.push(text);
                }
                return msgs;
            """)
            if not isinstance(result, list):
                return []
            return [str(x).strip() for x in result if str(x).strip()]
        except Exception as e:
            logger.error('get_customer_messages: %s', e)
            return []

    def extract_current_chat(self) -> dict[str, Any]:
        chat_id = self.get_current_chat_id()
        nickname = self.get_nickname()
        customer_messages = self.get_customer_messages()
        parsed = parse_fields_from_texts(customer_messages)
        last_message = customer_messages[-1] if customer_messages else None
        return {
            'chatId': chat_id,
            'nickname': nickname,
            'phone': parsed.get('phone'),
            'address': parsed.get('address'),
            'pyeong': parsed.get('pyeong'),
            'memo': parsed.get('memo'),
            'lastMessage': last_message,
            'customerMessages': customer_messages[-12:],
            'currentUrl': self.driver.current_url,
        }

    def send_message(self, message: str) -> tuple[bool, str | None]:
        try:
            result = self.driver.execute_script(_SEND_MESSAGE_JS, message)
            if isinstance(result, dict) and result.get('ok'):
                time.sleep(self.delay)
                return True, None

            reason = result.get('reason') if isinstance(result, dict) else 'unknown'
            logger.warning('send_message js failed: %s', reason)

            input_elem = None
            for selector in ['textarea', "[contenteditable='true']", "div[role='textbox']"]:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed() and input_elem is None:
                        input_elem = elem
                if input_elem:
                    break
            if not input_elem:
                return False, '채팅 입력창을 찾지 못했습니다. 숨고 채팅방을 연 상태인지 확인해 주세요.'

            self.driver.execute_script(
                "document.querySelectorAll('.quick-message-tooltip,[class*=\"tooltip\"]').forEach(function(t){t.style.display='none';});"
            )
            self.driver.execute_script(_INPUT_JS, input_elem, message)
            time.sleep(self.delay * 0.4)

            send_btn = None
            for selector in ['.btn-submit', 'img.btn-submit', "button[type='submit']", 'button']:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if not elem.is_displayed() or send_btn is not None:
                        continue
                    label = (elem.get_attribute('aria-label') or '') + (elem.text or '')
                    if '전송' in label or '보내기' in label or selector != 'button':
                        send_btn = elem
                if send_btn:
                    break

            if send_btn:
                send_btn.click()
            else:
                input_elem.send_keys(Keys.RETURN)

            time.sleep(self.delay)
            return True, None
        except Exception as e:
            logger.error('send_message: %s', e)
            return False, f'메시지 전송 중 오류: {e}'

    def open_chat_list(self) -> bool:
        try:
            self.driver.get(URLS['CHAT_LIST'])
            time.sleep(self.delay * 2)
            return True
        except Exception:
            return False
