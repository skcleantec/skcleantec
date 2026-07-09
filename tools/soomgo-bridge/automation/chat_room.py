"""채팅방 읽기·메시지 전송·필드 파싱"""
from __future__ import annotations

import logging
import os
import re
import time
from typing import Any, Literal

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains

from automation.selectors import URLS
from automation.customer_request import CustomerRequestManager, REQUEST_MODAL_DELAY, parse_soomgo_count
from automation.call_modal import CallModalManager
from automation.overlay_modals import dismiss_blocking_overlays

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
function setNativeValue(el, text) {
  var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  var desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) desc.set.call(el, text);
  else el.value = text;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
document.querySelectorAll('.quick-message-tooltip, [class*="tooltip"]').forEach(function(t) {
  try { t.style.display = 'none'; } catch (e) {}
});
function setInputValue(el, text) {
  el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    setNativeValue(el, text);
  } else {
    el.textContent = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
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
  var ir = input.getBoundingClientRect();
  var best = null;
  var bestDist = 99999;
  for (var k = 0; k < allBtns.length; k++) {
    var b = allBtns[k];
    if (!isVisible(b)) continue;
    var br = b.getBoundingClientRect();
    if (br.left < ir.right - 8) continue;
    if (Math.abs(br.bottom - ir.bottom) > 72) continue;
    if (br.width < 28 || br.height < 28) continue;
    var dist = br.left - ir.right;
    if (dist < bestDist) { bestDist = dist; best = b; }
  }
  sendBtn = best;
}
if (sendBtn) {
  try {
    sendBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    sendBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    sendBtn.click();
  } catch (e) { sendBtn.click(); }
  var cleared = !input.value || input.value.trim() === '';
  if (!cleared && input.textContent != null) cleared = !input.textContent.trim();
  return { ok: true, reason: cleared ? 'clicked_cleared' : 'clicked' };
}
try {
  ['keydown','keypress','keyup'].forEach(function(type) {
    input.dispatchEvent(new KeyboardEvent(type, {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
    }));
  });
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
    def __init__(self, driver, delay: float = REQUEST_MODAL_DELAY):
        self.driver = driver
        self.delay = delay

    def _hide_tooltips(self) -> None:
        self.driver.execute_script(
            "document.querySelectorAll('.quick-message-tooltip,[class*=\"tooltip\"]').forEach(function(t){try{t.style.display='none';}catch(e){}});"
        )

    def _find_message_input(self):
        for selector in [
            'textarea[name="message-input"]',
            'textarea.message-input',
            'textarea',
            "[contenteditable='true']",
            "[contenteditable='']",
            "div[role='textbox']",
        ]:
            best = None
            best_bottom = -1
            for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                if not elem.is_displayed():
                    continue
                try:
                    bottom = elem.rect['y'] + elem.rect['height']
                    if bottom >= best_bottom:
                        best_bottom = bottom
                        best = elem
                except Exception:
                    if best is None:
                        best = elem
            if best is not None:
                return best
        return None

    def _find_send_button(self, input_elem):
        input_rect = input_elem.rect
        send_btn = None
        best_dist = 99999
        for elem in self.driver.find_elements(By.CSS_SELECTOR, 'button, [role="button"], img.btn-submit, .btn-submit'):
            if not elem.is_displayed():
                continue
            label = (elem.get_attribute('aria-label') or '') + (elem.text or '') + (elem.get_attribute('alt') or '')
            if re.search(r'전송|보내기|submit|send', label, re.I) or 'submit' in (elem.get_attribute('class') or ''):
                return elem
            try:
                r = elem.rect
                if r['x'] >= input_rect['x'] + input_rect['width'] - 24 and abs(r['y'] - input_rect['y']) < 72:
                    if r['width'] >= 28 and r['height'] >= 28:
                        dist = r['x'] - input_rect['x'] - input_rect['width']
                        if dist < best_dist:
                            best_dist = dist
                            send_btn = elem
            except Exception:
                continue
        return send_btn

    def _input_still_has_text(self, input_elem, message: str) -> bool:
        try:
            remaining = (input_elem.get_attribute('value') or input_elem.text or '').strip()
            return remaining == message.strip()
        except Exception:
            return False

    def _send_via_keyboard(self, input_elem, message: str) -> bool:
        self._hide_tooltips()
        input_elem.click()
        time.sleep(0.15)
        chains = ActionChains(self.driver)
        chains.click(input_elem)
        chains.key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL)
        chains.send_keys(Keys.DELETE)
        chains.send_keys(message)
        chains.perform()
        time.sleep(0.35)
        send_btn = self._find_send_button(input_elem)
        if send_btn:
            try:
                ActionChains(self.driver).move_to_element(send_btn).click().perform()
            except Exception:
                send_btn.click()
        else:
            input_elem.send_keys(Keys.RETURN)
        time.sleep(self.delay * 0.5)
        return not self._input_still_has_text(input_elem, message)

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
            req = CustomerRequestManager(self.driver, self.delay)
            name = req.get_header_customer_name()
            if name:
                return name
            name = self.driver.execute_script("""
                var selectors = ['h1','h2','h3','header h2','header h3','[class*="nickname"]','[class*="user-name"]'];
                for (var i = 0; i < selectors.length; i++) {
                    var el = document.querySelector(selectors[i]);
                    if (!el) continue;
                    var t = (el.textContent || '').trim().split('\\n')[0];
                    if (t && t.length < 40 && !t.includes('채팅') && t !== '접속 중') return t;
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
        """① 이름 클릭→고객요청 파싱→닫기 ② 전화→번호→취소 (순차 매크로)."""
        chat_id = self.get_current_chat_id()
        dismiss_blocking_overlays(self.driver, self.delay * 0.25, max_rounds=2)

        req_mgr = CustomerRequestManager(self.driver, self.delay)
        request_data = req_mgr.extract_customer_request()

        customer_name = (
            request_data.get('customerName')
            or self.get_nickname()
            or req_mgr.get_header_customer_name()
        )
        region = request_data.get('region')

        dismiss_blocking_overlays(self.driver, self.delay * 0.2, max_rounds=2)

        call_mgr = CallModalManager(self.driver, self.delay)
        safe_phone = call_mgr.try_extract_safe_phone()

        customer_messages = self.get_customer_messages()
        parsed = parse_fields_from_texts(customer_messages)
        if request_data.get('pyeong'):
            parsed['pyeong'] = str(request_data['pyeong'])
        if region:
            parsed['address'] = str(region)
        elif request_data.get('region'):
            parsed['address'] = str(request_data['region'])
        if request_data.get('requestMemo'):
            parsed['memo'] = str(request_data['requestMemo'])
        phone = safe_phone or parsed.get('phone')
        last_message = customer_messages[-1] if customer_messages else None

        return {
            'chatId': chat_id,
            'nickname': customer_name,
            'customerName': customer_name,
            'phone': phone,
            'safePhone': safe_phone,
            'safePhoneSkipped': safe_phone is None,
            'address': parsed.get('address'),
            'pyeong': parsed.get('pyeong'),
            'memo': parsed.get('memo'),
            'preferredDate': request_data.get('preferredDate'),
            'serviceType': request_data.get('serviceType'),
            'buildingType': request_data.get('buildingType'),
            'region': region or request_data.get('region'),
            'requestMemo': request_data.get('requestMemo'),
            'requestPairs': request_data.get('requestPairs', []),
            'roomCount': parse_soomgo_count(request_data.get('roomCount')),
            'bathroomCount': parse_soomgo_count(request_data.get('bathroomCount')),
            'balconyCount': parse_soomgo_count(request_data.get('verandaCount')),
            'lastMessage': last_message,
            'customerMessages': customer_messages[-12:],
            'currentUrl': self.driver.current_url,
        }

    def _click_attachment_and_find_file_input(self):
        input_elem = self._find_message_input()
        if input_elem:
            try:
                input_elem.click()
                time.sleep(0.2)
            except Exception:
                pass

        for selector in ['input[type="file"]', 'input[accept*="image"]']:
            for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                try:
                    if elem.is_enabled():
                        return elem
                except Exception:
                    continue

        attach_selectors = [
            'button[aria-label*="이미지"]',
            'button[aria-label*="사진"]',
            'button[aria-label*="첨부"]',
            '[class*="attach"]',
            'img[alt*="첨부"]',
            'img[alt*="이미지"]',
        ]
        for selector in attach_selectors:
            for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                if not elem.is_displayed():
                    continue
                try:
                    elem.click()
                    time.sleep(0.35)
                except Exception:
                    continue
                for file_selector in ['input[type="file"]', 'input[accept*="image"]']:
                    for file_input in self.driver.find_elements(By.CSS_SELECTOR, file_selector):
                        try:
                            if file_input.is_enabled():
                                return file_input
                        except Exception:
                            continue
        return None

    def upload_images(
        self,
        image_paths: list[str],
        mode: Literal['bundle', 'single'] = 'bundle',
    ) -> tuple[bool, str | None]:
        """채팅 입력창 포커스 → 첨부 아이콘 → file input send_keys."""
        try:
            existing = [p for p in image_paths if p and os.path.isfile(p)]
            if not existing:
                return False, '전송할 이미지 파일이 없습니다.'

            self._hide_tooltips()
            batches = [existing] if mode == 'bundle' else [[p] for p in existing]

            for batch in batches:
                file_input = self._click_attachment_and_find_file_input()
                if not file_input:
                    return False, '숨고 채팅 이미지 첨부 입력을 찾지 못했습니다.'

                abs_paths = [os.path.abspath(p) for p in batch]
                payload = '\n'.join(abs_paths)
                try:
                    file_input.send_keys(payload)
                except Exception as e:
                    logger.warning('upload_images send_keys: %s', e)
                    return False, '이미지 첨부에 실패했습니다. 채팅방 입력창을 확인해 주세요.'

                time.sleep(self.delay * 1.2)

                input_elem = self._find_message_input()
                if input_elem:
                    send_btn = self._find_send_button(input_elem)
                    if send_btn:
                        try:
                            send_btn.click()
                        except Exception:
                            pass
                        time.sleep(self.delay * 0.8)

            return True, None
        except Exception as e:
            logger.error('upload_images: %s', e)
            return False, f'이미지 전송 중 오류: {e}'

    def send_message(self, message: str) -> tuple[bool, str | None]:
        try:
            self._hide_tooltips()
            result = self.driver.execute_script(_SEND_MESSAGE_JS, message)
            if isinstance(result, dict) and result.get('ok'):
                reason = str(result.get('reason', ''))
                if reason == 'clicked_cleared':
                    time.sleep(self.delay * 0.3)
                    return True, None

            input_elem = self._find_message_input()
            if not input_elem:
                return False, '채팅 입력창을 찾지 못했습니다. 숨고 채팅방을 연 상태인지 확인해 주세요.'

            if self._send_via_keyboard(input_elem, message):
                time.sleep(self.delay * 0.3)
                return True, None

            reason = result.get('reason') if isinstance(result, dict) else 'unknown'
            logger.warning('send_message retry js after keyboard: %s', reason)
            retry = self.driver.execute_script(_SEND_MESSAGE_JS, message)
            if isinstance(retry, dict) and retry.get('ok') and retry.get('reason') == 'clicked_cleared':
                return True, None

            if not self._input_still_has_text(input_elem, message):
                return True, None

            return False, '메시지가 입력만 되고 전송되지 않았습니다. 숨고 채팅방·전송 버튼을 확인해 주세요.'
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
