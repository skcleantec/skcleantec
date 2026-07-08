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
} else if (elem.hasAttribute('contenteditable')) {
    elem.textContent = message;
}
elem.dispatchEvent(new Event('input', { bubbles: true }));
elem.dispatchEvent(new Event('change', { bubbles: true }));
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

    def send_message(self, message: str) -> bool:
        try:
            input_elem = None
            for selector in ['textarea', "[contenteditable='true']", "div[role='textbox']"]:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed() and input_elem is None:
                        input_elem = elem
                if input_elem:
                    break
            if not input_elem:
                return False

            input_elem.click()
            time.sleep(self.delay * 0.3)
            try:
                input_elem.clear()
            except Exception:
                pass
            self.driver.execute_script(_INPUT_JS, input_elem, message)
            time.sleep(self.delay * 0.4)

            send_btn = None
            for selector in ['.btn-submit', 'img.btn-submit', "button[type='submit']"]:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed() and send_btn is None:
                        send_btn = elem
                if send_btn:
                    break

            if send_btn:
                send_btn.click()
            else:
                input_elem.send_keys(Keys.RETURN)

            time.sleep(self.delay)
            return True
        except Exception as e:
            logger.error('send_message: %s', e)
            return False

    def open_chat_list(self) -> bool:
        try:
            self.driver.get(URLS['CHAT_LIST'])
            time.sleep(self.delay * 2)
            return True
        except Exception:
            return False
