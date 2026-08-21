"""
채팅방 내 동작 모듈
- 메시지 전송
- 이미지 업로드
- 즐겨찾기 추가
- 뒤로가기
"""
import base64
import logging
import os
import re
import subprocess
import sys
import time
from typing import List, Optional

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from automation.selectors import URLS

logger = logging.getLogger(__name__)

_INPUT_JS = """
const elem = arguments[0];
const message = arguments[1];
elem.focus();
const tag = elem.tagName.toLowerCase();
const isEditable = elem.isContentEditable || elem.getAttribute('contenteditable') === 'true';
if (tag === 'textarea' || tag === 'input') {
    elem.value = '';
    elem.value = message;
} else if (isEditable) {
    elem.textContent = '';
    elem.innerHTML = '';
    if (document.execCommand) {
        document.execCommand('insertText', false, message);
    } else {
        elem.textContent = message;
    }
}
elem.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
elem.dispatchEvent(new Event('change', { bubbles: true }));
return (elem.value || elem.textContent || '').length;
"""

_CHUNK_INPUT_JS = """
const elem = arguments[0];
const message = arguments[1];
const chunkSize = arguments[2] || 280;
elem.focus();
const tag = elem.tagName.toLowerCase();
const isEditable = elem.isContentEditable || elem.getAttribute('contenteditable') === 'true';
if (tag === 'textarea' || tag === 'input') {
    elem.value = '';
} else if (isEditable) {
    elem.textContent = '';
    elem.innerHTML = '';
}
for (let i = 0; i < message.length; i += chunkSize) {
    const part = message.slice(i, i + chunkSize);
    if (document.execCommand) {
        document.execCommand('insertText', false, part);
    } else if (tag === 'textarea' || tag === 'input') {
        elem.value += part;
    } else {
        elem.textContent += part;
    }
}
elem.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message.slice(0, 200) }));
elem.dispatchEvent(new Event('change', { bubbles: true }));
return (elem.value || elem.textContent || '').length;
"""

_CLEAR_INPUT_JS = """
const elem = arguments[0];
elem.focus();
const tag = elem.tagName.toLowerCase();
const isEditable = elem.isContentEditable || elem.getAttribute('contenteditable') === 'true';
if (tag === 'textarea' || tag === 'input') {
    elem.value = '';
} else if (isEditable) {
    elem.textContent = '';
    elem.innerHTML = '';
}
elem.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
"""

_FAVORITE_JS = """
var container = document.querySelector('.quick-btn-container.right-align');
if (!container) return { status: 'error', message: 'container not found' };
var buttons = container.querySelectorAll('button');
for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    var svg = btn.querySelector('svg');
    if (!svg) continue;
    var path = svg.querySelector('path');
    if (!path) continue;
    var d = path.getAttribute('d') || '';
    if (d.includes('5.21522') || d.includes('8.72728') || d.includes('M9.52438')) {
        var svgClass = svg.className.baseVal || '';
        var isFavorited = svgClass.includes('purple');
        if (isFavorited) return { status: 'already_favorited', svgClass: svgClass };
        btn.click();
        return { status: 'clicked', svgClass: svgClass };
    }
}
var allSvgs = document.querySelectorAll('svg.prisma-icon');
for (var j = 0; j < allSvgs.length; j++) {
    var svg = allSvgs[j];
    var path = svg.querySelector('path');
    if (!path) continue;
    var d = path.getAttribute('d') || '';
    if (d.includes('5.21522') || d.includes('8.72728') || d.includes('M9.52438')) {
        var svgClass = svg.className.baseVal || '';
        if (svgClass.includes('purple')) return { status: 'already_favorited', svgClass: svgClass };
        var btn = svg.closest('button');
        if (btn) { btn.click(); return { status: 'clicked', svgClass: svgClass }; }
    }
}
return { status: 'not_found', message: 'heart button not found' };
"""

_SEND_BUTTON_SELECTORS = [
    '.btn-submit',
    'img.btn-submit',
    "button[type='submit']",
    "[class*='send']",
]


def _should_use_cdp_input(message: str) -> bool:
    """React contenteditable — 긴 글·여러 줄은 CDP Input.insertText 권장"""
    text = (message or '').strip()
    if not text:
        return False
    if len(text) >= 150:
        return True
    return text.count('\n') >= 2


def _copy_text_to_clipboard(text: str) -> bool:
    """Windows 클립보드 복사 — Tk() 중복 생성 없이 PowerShell 사용"""
    try:
        payload = base64.b64encode((text or '').encode('utf-16-le')).decode('ascii')
        script = (
            f"$t = [System.Text.Encoding]::Unicode.GetString("
            f"[Convert]::FromBase64String('{payload}')); "
            f"Set-Clipboard -Value $t"
        )
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        result = subprocess.run(
            ['powershell', '-NoProfile', '-STA', '-Command', script],
            capture_output=True,
            timeout=12,
            creationflags=flags,
        )
        return result.returncode == 0
    except Exception as exc:
        logger.warning(f'[클립보드] 복사 실패: {exc}')
        return False


def _min_acceptable_input_length(expected: int, relaxed: bool = False) -> int:
    """입력 길이 검증 — 짧은 메시지에 max(20) 하한을 두면 18자 등이 항상 실패함"""
    if relaxed:
        if expected <= 30:
            return max(1, expected - 4)
        if expected > 500:
            return max(12, int(expected * 0.55))
        return max(8, int(expected * 0.65))
    if expected <= 30:
        return max(1, expected - 2)
    if expected > 500:
        return max(20, int(expected * 0.85))
    return max(20, int(expected * 0.92))


def _normalize_message_signature(message: str, max_len: int = 40) -> str:
    compact = re.sub(r'\s+', ' ', (message or '').strip())
    return compact[:max_len]


def _plain_match_key(message: str, max_len: int = 24) -> str:
    """이모지·특수문자 제거 후 비교용 키 (숨고 DOM 표시와 입력문 차이 보정)"""
    compact = re.sub(r'\s+', ' ', (message or '').strip())
    plain = re.sub(r'[^\w\s가-힣\.]', '', compact)
    return plain[:max_len]


def _tail_match_key(message: str, max_len: int = 30) -> str:
    compact = re.sub(r'\s+', ' ', (message or '').strip())
    plain = re.sub(r'[^\w\s가-힣\.]', '', compact)
    if not plain:
        return ''
    return plain[-max_len:]


def _message_fully_present_in(haystack: str, message: str) -> bool:
    """단일 말풍선 안에서 이미 전송됨 판정 (짧은 메시지용)"""
    target = (haystack or '').strip()
    if not target:
        return False
    if len((message or '').strip()) >= 80:
        return False
    return _message_matches_any_static(target, message)


def _long_message_present_in_recent(messages: List[str], message: str) -> bool:
    """긴 본문 — 최근 말풍선들(분할 전송)에서 앞·뒤 시그니처 확인

    연락처만 같다고 동일 메시지로 보지 않는다 (텍스트11·12와 15처럼
    같은 번호를 쓰는 다른 본문이 연속 전송되는 경우가 많음).
    """
    head = _plain_match_key(message, 40)
    tail = _tail_match_key(message, 40)
    if len(head) < 12 and len(tail) < 12:
        return False

    def _plain(text: str) -> str:
        return re.sub(r'[^\w\s가-힣\.]', '', re.sub(r'\s+', ' ', (text or '').strip()))

    plains = [_plain(item) for item in messages if item]
    combined = ' '.join(plains)

    head_ok = len(head) >= 12 and head in combined
    tail_ok = len(tail) >= 12 and tail in combined
    return head_ok and tail_ok


def _message_matches_any_static(haystack: str, message: str) -> bool:
    target = (haystack or '').strip()
    if not target:
        return False
    for key in _message_match_keys(message):
        if key in target or target.startswith(key[: min(20, len(key))]):
            return True
    return False


def _message_match_keys(message: str) -> List[str]:
    keys: List[str] = []
    raw = (message or '').strip()
    if not raw:
        return keys
    compact = re.sub(r'\s+', ' ', raw)
    keys.append(compact[:40])
    keys.append(compact[:20])
    first_line = raw.splitlines()[0].strip()
    if first_line:
        first_compact = re.sub(r'\s+', ' ', first_line)
        keys.append(first_compact[:40])
        keys.append(first_compact[:20])
    plain = _plain_match_key(compact, 30)
    if len(plain) >= 8:
        keys.append(plain)
    # dedupe preserve order
    seen = set()
    out: List[str] = []
    for k in keys:
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


class ChatRoomManager:
    """채팅방 내 동작 관리 클래스"""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay

    def _find_message_input(self):
        input_selectors = [
            'textarea',
            "[contenteditable='true']",
            "input[placeholder*='메시지']",
            '.message-input textarea',
            "div[role='textbox']",
        ]
        for selector in input_selectors:
            try:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed():
                        logger.info(f'[메시지 전송] 입력 필드 발견: {selector}')
                        return elem
            except Exception as e:
                logger.debug(f"[메시지 전송] 셀렉터 '{selector}' 검색 실패: {e}")
        return None

    def _find_send_button(self):
        for selector in _SEND_BUTTON_SELECTORS:
            for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                if elem.is_displayed():
                    return elem
        return None

    def _click_send_button(self) -> bool:
        send_btn = self._find_send_button()
        if send_btn:
            send_btn.click()
            logger.info('[전송] 전송 버튼 클릭 완료')
            return True
        logger.warning('[전송] 전송 버튼 못찾음, Enter 키로 전송 시도')
        return False

    def _composer_has_text(self) -> bool:
        try:
            return bool(
                self.driver.execute_script(
                    """
                    const input = document.querySelector(
                        "textarea, [contenteditable='true'], div[role='textbox']"
                    );
                    if (!input) return false;
                    return ((input.value || input.textContent || '').trim().length > 0);
                    """
                )
            )
        except Exception:
            return False

    def _message_matches_any(self, haystack: str, message: str) -> bool:
        return _message_matches_any_static(haystack, message)

    def _scroll_chat_to_bottom(self) -> None:
        try:
            self.driver.execute_script(
                """
                const selectors = [
                    '.chat-messages',
                    '[class*="ChatMessage"]',
                    '[class*="message-list"]',
                    'main',
                ];
                for (const sel of selectors) {
                    document.querySelectorAll(sel).forEach((el) => {
                        if (el.scrollHeight > el.clientHeight + 4) {
                            el.scrollTop = el.scrollHeight;
                        }
                    });
                }
                window.scrollTo(0, document.body.scrollHeight);
                """
            )
            time.sleep(0.35)
        except Exception:
            pass

    def _recent_scan_count(self, message: str) -> int:
        length = len((message or '').strip())
        if length >= 500:
            return 32
        if length >= 80:
            return 20
        return 10

    def _delivery_detected_since(self, message: str, before_count: int) -> bool:
        """전송 직후 — 본문 매칭 또는 (건수 증가+입력창 비움)으로 성공 판정"""
        if self._message_already_sent(message):
            return True
        cap = 1200 if len((message or '').strip()) >= 80 else 500
        messages = self.get_my_sent_messages(limit_per_message=cap)
        if len(messages) <= before_count:
            return False
        if not self._composer_has_text():
            logger.info('[메시지 전송] 건수 증가 + 입력창 비움 — 전송 성공으로 간주')
            return True
        return self._message_already_sent(message)

    def message_is_delivered(self, message: str) -> bool:
        """채팅 목록에 본문이 반영됐는지 확인 (마지막 점검용)"""
        if not (message or '').strip():
            return True
        self._scroll_chat_to_bottom()
        return self._message_already_sent(message, recent_count=self._recent_scan_count(message))

    def _try_flush_composer_send(self, message: str) -> bool:
        """입력창에 남은 본문만 전송 버튼으로 밀어넣기"""
        if not self._composer_has_text():
            return False
        before_count = len(self.get_my_sent_messages())
        input_elem = self._find_message_input()
        if input_elem:
            try:
                input_elem.click()
            except Exception:
                pass
        time.sleep(0.3)
        if not self._click_send_button() and input_elem:
            try:
                input_elem.send_keys(Keys.RETURN)
            except Exception:
                pass
        wait_timeout = max(12.0, min(35.0, 8.0 + len(message) / 80.0))
        return self._wait_for_outgoing_message(
            message, before_count=before_count, timeout=wait_timeout
        )

    def ensure_message_delivered(
        self, message: str, max_rounds: int = 1, max_attempts: Optional[int] = None
    ) -> bool:
        """마지막 점검 — 미전송 시 1회만 재전송 (중복 방지)"""
        if not (message or '').strip():
            return True

        attempts = 1 if max_attempts is None else max(1, min(int(max_attempts), 1))
        rounds = max(1, min(int(max_rounds), 1))

        for round_idx in range(1, rounds + 1):
            self._wait_for_composer_idle(timeout=12.0)
            self._scroll_chat_to_bottom()
            if self.message_is_delivered(message):
                logger.info(f'[마지막 점검] 채팅 반영 확인 (라운드 {round_idx})')
                return True

            if self._composer_has_text() and self._try_flush_composer_send(message):
                time.sleep(max(1.0, self.delay))
                if self.message_is_delivered(message):
                    logger.info('[마지막 점검] 입력창 잔여 본문 전송 후 확인')
                    return True

            logger.warning(f'[마지막 점검] 재전송 1회 시도 ({round_idx}/{rounds})')
            if self.send_message(message, max_attempts=attempts):
                time.sleep(max(1.5, min(6.0, len(message) / 350.0)))
                if self.message_is_delivered(message):
                    return True

        self._clear_composer()
        return self.message_is_delivered(message)

    def _message_already_sent(self, message: str, recent_count: int = 8) -> bool:
        self._scroll_chat_to_bottom()
        scan = max(recent_count, self._recent_scan_count(message))
        cap = 1200 if len((message or '').strip()) >= 80 else 800
        messages = self.get_my_sent_messages(limit_per_message=cap)
        recent = messages[-scan:]
        if len((message or '').strip()) >= 80:
            return _long_message_present_in_recent(recent, message)
        for item in recent:
            if _message_fully_present_in(item, message):
                return True
        return False

    def _get_composer_text_length(self) -> int:
        try:
            length = self.driver.execute_script(
                """
                const input = document.querySelector(
                    "textarea, [contenteditable='true'], div[role='textbox']"
                );
                if (!input) return 0;
                return (input.value || input.textContent || '').length;
                """
            )
            return int(length or 0)
        except Exception:
            return 0

    def _clear_composer(self) -> None:
        input_elem = self._find_message_input()
        if not input_elem:
            return
        try:
            input_elem.clear()
        except Exception:
            pass
        try:
            self.driver.execute_script(_CLEAR_INPUT_JS, input_elem)
        except Exception:
            pass

    def _cdp_insert_text(self, text: str) -> None:
        if text:
            self.driver.execute_cdp_cmd('Input.insertText', {'text': text})

    def _composer_newline(self, input_elem) -> None:
        """채팅 입력창 줄바꿈 — Enter 단독은 전송, Shift+Enter만 줄바꿈"""
        try:
            self.driver.execute_cdp_cmd(
                'Input.dispatchKeyEvent',
                {
                    'type': 'keyDown',
                    'key': 'Enter',
                    'code': 'Enter',
                    'windowsVirtualKeyCode': 13,
                    'nativeVirtualKeyCode': 13,
                    'modifiers': 8,
                },
            )
            self.driver.execute_cdp_cmd(
                'Input.dispatchKeyEvent',
                {
                    'type': 'keyUp',
                    'key': 'Enter',
                    'code': 'Enter',
                    'windowsVirtualKeyCode': 13,
                    'nativeVirtualKeyCode': 13,
                    'modifiers': 8,
                },
            )
        except Exception:
            ActionChains(self.driver).click(input_elem).key_down(Keys.SHIFT).send_keys(
                Keys.ENTER
            ).key_up(Keys.SHIFT).perform()

    def _clear_composer_keyboard(self, input_elem) -> None:
        input_elem.click()
        time.sleep(0.15)
        try:
            self.driver.execute_script('arguments[0].focus();', input_elem)
        except Exception:
            pass
        ActionChains(self.driver).click(input_elem).key_down(Keys.CONTROL).send_keys(
            'a'
        ).key_up(Keys.CONTROL).send_keys(Keys.BACKSPACE).perform()
        time.sleep(0.15)

    def _input_message_via_cdp(self, input_elem, message: str) -> bool:
        """Chrome CDP Input.insertText — React contenteditable (줄 단위 + Shift+Enter)"""
        try:
            self._clear_composer_keyboard(input_elem)
            lines = message.split('\n')
            for idx, line in enumerate(lines):
                if line:
                    self._cdp_insert_text(line)
                    time.sleep(0.04)
                if idx < len(lines) - 1:
                    self._composer_newline(input_elem)
                    time.sleep(0.08)

            time.sleep(0.3)
            plain_len = len(re.sub(r'\s+', '', message))
            inserted = self._get_composer_text_length()
            min_ok = max(10, int(plain_len * 0.15))
            if inserted >= min_ok:
                logger.info(f'[CDP 입력] 완료 ({inserted}자, 기준 {min_ok}+)')
                return True
            logger.warning(
                f'[CDP 입력] 길이 부족 ({inserted}/{plain_len}, 기준 {min_ok}+)'
            )
            return False
        except Exception as exc:
            logger.error(f'[CDP 입력] 실패: {type(exc).__name__}: {exc}')
            return False

    def _input_message_to_composer(
        self, input_elem, message: str, relaxed: bool = False
    ) -> bool:
        """입력창에 전체 본문이 들어갔는지 확인하며 입력 (긴 글은 분할 insertText)"""
        expected = len(message)
        min_ok = _min_acceptable_input_length(expected, relaxed=relaxed)

        self.driver.execute_script(_CLEAR_INPUT_JS, input_elem)
        time.sleep(0.15)

        if _should_use_cdp_input(message):
            if self._input_message_via_cdp(input_elem, message):
                return True
            logger.warning('[메시지 전송] CDP 입력 실패 — JS 입력으로 전환')

        if expected <= 200:
            inserted = self.driver.execute_script(_INPUT_JS, input_elem, message)
        else:
            chunk_size = 150 if expected > 500 else 220
            inserted = self.driver.execute_script(
                _CHUNK_INPUT_JS, input_elem, message, chunk_size
            )

        try:
            inserted_len = int(inserted or 0)
        except (TypeError, ValueError):
            inserted_len = self._get_composer_text_length()

        if inserted_len >= min_ok:
            return True

        logger.warning(
            f'[메시지 전송] 입력 길이 부족 ({inserted_len}/{expected}) — 재입력 시도'
        )
        self.driver.execute_script(_CLEAR_INPUT_JS, input_elem)
        time.sleep(0.15)
        inserted = self.driver.execute_script(_CHUNK_INPUT_JS, input_elem, message, 150)
        try:
            inserted_len = int(inserted or 0)
        except (TypeError, ValueError):
            inserted_len = self._get_composer_text_length()
        return inserted_len >= min_ok

    def _paste_message_to_composer(self, input_elem, message: str) -> bool:
        """클립보드 붙여넣기(Ctrl+V) — 긴 글·이모지 본문에 JS 입력보다 안정적"""
        expected = len(message)
        min_ok = max(8, int(expected * 0.25)) if expected > 40 else max(1, expected - 5)

        self.driver.execute_script(_CLEAR_INPUT_JS, input_elem)
        time.sleep(0.15)
        input_elem.click()
        time.sleep(0.2)

        pasted = False
        if _copy_text_to_clipboard(message):
            try:
                ActionChains(self.driver).click(input_elem).perform()
                time.sleep(0.1)
                ActionChains(self.driver).key_down(Keys.CONTROL).send_keys('a').key_up(
                    Keys.CONTROL
                ).perform()
                time.sleep(0.08)
                ActionChains(self.driver).click(input_elem).key_down(Keys.CONTROL).send_keys(
                    'v'
                ).key_up(Keys.CONTROL).perform()
                time.sleep(0.35)
                pasted = self._get_composer_text_length() >= min_ok
            except Exception as exc:
                logger.warning(f'[붙여넣기] Ctrl+V 실패: {exc}')

        if pasted:
            logger.info(
                f'[붙여넣기] 완료 ({self._get_composer_text_length()}/{expected}자)'
            )
            return True

        logger.warning('[붙여넣기] 클립보드 방식 실패 — JS 입력으로 재시도')
        return self._input_message_to_composer(input_elem, message, relaxed=True)

    def _wait_for_outgoing_message(
        self, message: str, before_count: int, timeout: float = 12.0
    ) -> bool:
        signature = _normalize_message_signature(message)
        if not signature:
            time.sleep(self.delay * 0.5)
            return True

        deadline = time.time() + timeout
        per_cap = 1200 if len(message) >= 80 else 500
        recent_window = 12 if len(message) >= 80 else 5
        while time.time() < deadline:
            self._scroll_chat_to_bottom()
            messages = self.get_my_sent_messages(limit_per_message=per_cap)
            if len(messages) > before_count:
                for recent in messages[-recent_window:]:
                    if self._message_matches_any(recent, message):
                        logger.info(
                            f'[메시지 전송] 채팅 반영 확인: {signature[:20]}...'
                        )
                        return True
                if len(message) > 300:
                    for _ in range(8):
                        if not self._composer_has_text():
                            break
                        time.sleep(0.5)
                if not self._composer_has_text():
                    logger.info(
                        '[메시지 전송] 채팅 건수 증가 + 입력창 비움 — 전송 성공으로 간주'
                    )
                    return True
                if self._message_already_sent(message, recent_count=self._recent_scan_count(message)):
                    logger.info(
                        '[메시지 전송] 채팅 건수 증가 + 본문 확인 — 전송 성공으로 간주'
                    )
                    return True
            for recent in messages[-recent_window:]:
                if self._message_matches_any(recent, message):
                    logger.info(f'[메시지 전송] 채팅 반영 확인: {signature[:20]}...')
                    return True
            if not self._composer_has_text() and self._message_already_sent(message):
                logger.info('[메시지 전송] 입력창 비움 + 동일 본문 존재 — 전송 성공으로 간주')
                return True
            time.sleep(0.5)

        if self._message_already_sent(message):
            logger.info('[메시지 전송] 검증 타임아웃이나 채팅에 본문 존재 — 성공 처리')
            return True

        logger.warning(f'[메시지 전송] 채팅 반영 확인 실패: {signature[:20]}...')
        return False

    def _wait_for_composer_idle(self, timeout: float = 8.0) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                pending = self.driver.execute_script("""
                    const input = document.querySelector(
                        "textarea, [contenteditable='true'], div[role='textbox']"
                    );
                    if (!input) return false;
                    const text = (input.value || input.textContent || '').trim();
                    const uploading = !!document.querySelector(
                        "[class*='upload'], [class*='preview'], [class*='attachment']"
                    );
                    return text.length > 0 || uploading;
                """)
                if not pending:
                    return
            except Exception:
                return
            time.sleep(0.4)

    def _resolve_max_attempts(self, message: str, max_attempts: Optional[int]) -> int:
        if max_attempts is not None and max_attempts > 0:
            return max_attempts
        return 2 if len(message) > 300 else 1

    def send_message_sequential(self, message: str, max_attempts: int = 3) -> bool:
        """순차 전송(이모지·재접촉) — CDP 입력 + 전송 + 대기 (DOM 말풍선 검증 없음)"""
        if not (message or '').strip():
            return True

        if self._message_already_sent(message):
            logger.info(
                f'[순차 전송] 동일 본문이 이미 채팅에 있음 — 스킵 ({len(message)}자)'
            )
            return True

        attempts = max(1, int(max_attempts))
        use_cdp = _should_use_cdp_input(message)
        wait_after_send = max(2.2, min(6.0, 1.8 + len(message) / 100.0))

        try:
            for attempt in range(1, attempts + 1):
                self._wait_for_composer_idle(timeout=12.0)
                input_elem = self._find_message_input()
                if not input_elem:
                    logger.error(
                        f'[순차 전송] 입력 필드 없음 ({attempt}/{attempts})'
                    )
                    time.sleep(self.delay)
                    continue

                input_ok = False
                if use_cdp:
                    input_ok = self._input_message_via_cdp(input_elem, message)
                if not input_ok:
                    input_ok = self._input_message_to_composer(
                        input_elem, message, relaxed=True
                    )

                if not input_ok:
                    logger.warning(
                        f'[순차 전송] 입력 실패 ({attempt}/{attempts}, {len(message)}자)'
                    )
                    self._clear_composer()
                    time.sleep(self.delay)
                    continue

                time.sleep(0.45)
                if not self._click_send_button():
                    try:
                        input_elem.send_keys(Keys.RETURN)
                    except Exception:
                        pass

                logger.info(
                    f'[순차 전송] 전송 후 {wait_after_send:.1f}초 대기 '
                    f'({len(message)}자, {attempt}/{attempts})'
                )
                time.sleep(wait_after_send)

                remaining = self._get_composer_text_length()
                if remaining <= max(12, int(len(message) * 0.1)):
                    logger.info(f'[순차 전송] 완료 ({len(message)}자)')
                    return True

                if attempt < attempts:
                    logger.warning(
                        f'[순차 전송] 입력창 잔류({remaining}자) — 재시도'
                    )
                    self._clear_composer()
                    time.sleep(self.delay)
                    continue

                logger.warning(
                    f'[순차 전송] 입력창 잔류({remaining}자) — 최종 실패 ({len(message)}자)'
                )
                self._clear_composer()
                return False

            logger.error(
                f'[순차 전송] 실패 ({attempts}회, {len(message)}자)'
            )
            self._clear_composer()
            return False
        except Exception as e:
            logger.error(f'[순차 전송] 예외: {type(e).__name__}: {e}')
            self._clear_composer()
            return False

    def send_message_paste(self, message: str, max_attempts: int = 3) -> bool:
        """긴 글 보조 — 붙여넣기 → 전송 → 대기 (DOM 반영 검증 없음)"""
        if not (message or '').strip():
            return True

        attempts = max(1, int(max_attempts))
        wait_after_send = max(2.5, min(6.0, 2.0 + len(message) / 100.0))

        try:
            for attempt in range(1, attempts + 1):
                self._wait_for_composer_idle(timeout=12.0)
                input_elem = self._find_message_input()
                if not input_elem:
                    logger.error(
                        f'[붙여넣기 전송] 입력 필드 없음 ({attempt}/{attempts})'
                    )
                    time.sleep(self.delay)
                    continue

                if not self._paste_message_to_composer(input_elem, message):
                    if not self._input_message_to_composer(
                        input_elem, message, relaxed=True
                    ):
                        logger.warning(
                            f'[붙여넣기 전송] 입력 실패 ({attempt}/{attempts})'
                        )
                        self._clear_composer()
                        time.sleep(self.delay)
                        continue

                time.sleep(0.45)
                if not self._click_send_button():
                    try:
                        input_elem.send_keys(Keys.RETURN)
                    except Exception:
                        pass

                logger.info(
                    f'[붙여넣기 전송] {wait_after_send:.1f}초 대기 '
                    f'({len(message)}자, {attempt}/{attempts})'
                )
                time.sleep(wait_after_send)

                if self._get_composer_text_length() <= max(
                    12, int(len(message) * 0.12)
                ):
                    return True

                if attempt < attempts:
                    self._clear_composer()
                    time.sleep(self.delay)
                    continue

                self._clear_composer()
                return True

            return False
        except Exception as e:
            logger.error(f'[붙여넣기 전송] 예외: {type(e).__name__}: {e}')
            self._clear_composer()
            return False

    def send_message(self, message: str, max_attempts: Optional[int] = None) -> bool:
        """메시지 전송 (입력·전송·채팅 반영까지 확인)"""
        if not (message or '').strip():
            return True

        if self._message_already_sent(message):
            logger.info(
                f'[메시지 전송] 동일 본문이 이미 채팅에 있음 — 스킵 ({len(message)}자)'
            )
            return True

        attempts = self._resolve_max_attempts(message, max_attempts)

        try:
            logger.info(f'[메시지 전송] 현재 URL: {self.driver.current_url}')
            self._wait_for_composer_idle()

            for attempt in range(1, attempts + 1):
                before_count = len(self.get_my_sent_messages())
                if self._message_already_sent(message):
                    logger.info('[메시지 전송] 전송 직전 동일 본문 확인 — 스킵')
                    return True

                input_elem = self._find_message_input()
                if not input_elem:
                    logger.error('[메시지 전송 실패] 입력 필드를 찾을 수 없습니다.')
                    return False

                input_elem.click()
                time.sleep(self.delay * 0.3)
                try:
                    input_elem.clear()
                except Exception:
                    pass

                if not self._input_message_to_composer(input_elem, message):
                    logger.warning(
                        f'[메시지 전송] 입력창에 본문이 충분히 들어가지 않음 '
                        f'({attempt}/{attempts})'
                    )
                    if self._message_already_sent(message):
                        return True
                    time.sleep(self.delay)
                    continue

                logger.info(
                    f'[메시지 전송] 메시지 입력 완료 ({len(message)}자, 시도 {attempt}/{attempts}): '
                    f'{message[:30]}...'
                )
                time.sleep(self.delay * (1.2 if len(message) > 400 else 0.5))

                if self._click_send_button():
                    pass
                else:
                    input_elem.send_keys(Keys.RETURN)

                if len(message) > 500:
                    wait_timeout = max(20.0, min(45.0, 12.0 + len(message) / 60.0))
                else:
                    wait_timeout = max(8.0, min(20.0, 6.0 + len(message) / 120.0))
                if self._wait_for_outgoing_message(
                    message, before_count=before_count, timeout=wait_timeout
                ):
                    time.sleep(max(0.8, self.delay * 0.4))
                    return True

                if self._delivery_detected_since(message, before_count):
                    logger.info('[메시지 전송] 재시도 전 전송 반영 확인 — 성공 처리')
                    return True

                if attempt < attempts:
                    grace = max(2.0, min(10.0, len(message) / 120.0))
                    logger.info(
                        f'[메시지 전송] 반영 대기 {grace:.1f}초 후 재확인 ({attempt}/{attempts})'
                    )
                    time.sleep(grace)
                    if self._message_already_sent(
                        message, recent_count=self._recent_scan_count(message)
                    ):
                        logger.info('[메시지 전송] 대기 후 채팅 반영 확인 — 성공 처리')
                        return True
                    if self._delivery_detected_since(message, before_count):
                        logger.info('[메시지 전송] 대기 후 건수/입력창 확인 — 성공 처리')
                        return True

                if self._message_already_sent(message):
                    logger.info('[메시지 전송] 재시도 전 채팅에 본문 확인 — 성공 처리')
                    return True

                logger.warning(
                    f'[메시지 전송] 반영 확인 실패 — 재시도 ({attempt}/{attempts})'
                )
                if self._composer_has_text():
                    self.driver.execute_script(_CLEAR_INPUT_JS, input_elem)
                time.sleep(self.delay)

            if self._message_already_sent(message):
                logger.info('[메시지 전송] 최종 확인: 채팅에 본문 존재 — 성공 처리')
                return True

            self._clear_composer()
            logger.error('[메시지 전송 실패] 전송 후 채팅에 메시지가 보이지 않습니다.')
            return False
        except Exception as e:
            logger.error(f'[메시지 전송 실패] 예외 발생: {type(e).__name__}: {e}')
            return False

    def upload_images(self, image_paths: List[str]) -> bool:
        """이미지 업로드 후 전송 버튼까지 클릭"""
        try:
            if self._composer_has_text():
                logger.warning(
                    '[이미지 업로드] 입력창에 미전송 텍스트가 남아 있어 비운 뒤 진행합니다.'
                )
                self._clear_composer()
                time.sleep(0.3)

            logger.info(f'[이미지 업로드] 시작: {len(image_paths)}개 파일')
            valid_paths = [
                os.path.abspath(path)
                for path in image_paths
                if path and os.path.exists(path)
            ]
            if not valid_paths:
                logger.error('[이미지 업로드 실패] 업로드할 유효한 이미지가 없습니다.')
                return False

            file_input_selectors = [
                "input[type='file']",
                'input.file-input-hidden',
                "input[accept*='image']",
            ]
            file_input = None
            for selector in file_input_selectors:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    file_input = elements[0]
                    break

            if not file_input:
                attach_selectors = [
                    "img[alt*='파일 첨부']",
                    "button[aria-label*='파일']",
                    "[class*='attach']",
                ]
                for selector in attach_selectors:
                    try:
                        elem = self.driver.find_element(By.CSS_SELECTOR, selector)
                        elem.click()
                        time.sleep(self.delay * 0.5)
                        break
                    except Exception:
                        continue
                for selector in file_input_selectors:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        file_input = elements[0]
                        break

            if not file_input:
                logger.error('[이미지 업로드 실패] 파일 입력 필드를 찾을 수 없습니다.')
                return False

            before_count = len(self.get_my_sent_messages())
            file_input.send_keys('\n'.join(valid_paths))
            time.sleep(self.delay * 1.5)

            if not self._click_send_button():
                input_elem = self._find_message_input()
                if input_elem:
                    input_elem.send_keys(Keys.RETURN)

            deadline = time.time() + max(12.0, self.delay * 6)
            while time.time() < deadline:
                self._wait_for_composer_idle(timeout=1.0)
                if len(self.get_my_sent_messages()) > before_count:
                    logger.info(f'[이미지 업로드] 전송 완료: {len(valid_paths)}개')
                    time.sleep(self.delay * 0.5)
                    return True
                if not self._find_send_button():
                    logger.info(f'[이미지 업로드] 전송 완료(버튼 없음): {len(valid_paths)}개')
                    time.sleep(self.delay * 0.5)
                    return True
                time.sleep(0.5)

            logger.warning('[이미지 업로드] 전송 확인 실패 — 업로드 미완료로 처리')
            time.sleep(self.delay)
            return False
        except Exception as e:
            logger.error(f'[이미지 업로드 실패] 예외 발생: {type(e).__name__}: {e}')
            return False

    def toggle_favorite(self) -> bool:
        """즐겨찾기 추가 (이미 즐겨찾기된 경우 스킵)"""
        try:
            result = self.driver.execute_script(_FAVORITE_JS)
            if not result:
                logger.warning('[즐겨찾기] JavaScript 실행 결과 없음')
                return False

            status = result.get('status', 'unknown')
            if status == 'already_favorited':
                logger.info(f"[즐겨찾기] 이미 즐겨찾기됨 (스킵): {result.get('svgClass')}")
                return True
            if status == 'clicked':
                logger.info(f"[즐겨찾기] 버튼 클릭 완료: {result.get('svgClass')}")
                time.sleep(self.delay * 0.5)
                return True
            if status == 'not_found':
                logger.warning(f"[즐겨찾기] 버튼을 찾을 수 없음: {result.get('message')}")
                return False

            logger.warning(f'[즐겨찾기] 예상치 못한 상태: {result}')
            return False
        except Exception as e:
            logger.error(f'[즐겨찾기 실패] 예외 발생: {type(e).__name__}: {e}')
            return False

    def go_back(self) -> bool:
        """채팅 목록으로 돌아가기"""
        try:
            back_selectors = [
                "button[aria-label*='뒤로']",
                "a[href='/pro/chats']",
                "[class*='back'] button",
            ]
            back_btn = None
            for selector in back_selectors:
                for elem in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if elem.is_displayed():
                        back_btn = elem
                        break
                if back_btn:
                    break

            if back_btn:
                back_btn.click()
            else:
                self.driver.get(URLS['CHAT_LIST'])

            time.sleep(self.delay)
            logger.info('채팅 목록으로 돌아가기 완료')
            return True
        except Exception as e:
            logger.error(f'뒤로가기 오류: {e}')
            try:
                self.driver.get(URLS['CHAT_LIST'])
                time.sleep(self.delay)
                return True
            except Exception:
                return False

    def is_in_chat_room(self) -> bool:
        try:
            current_url = self.driver.current_url
            return '/pro/chats/' in current_url or 'from=chatroom' in current_url
        except Exception:
            return False

    def get_current_chat_id(self) -> Optional[str]:
        try:
            match = re.search(r'/pro/chats/(\d+)', self.driver.current_url)
            return match.group(1) if match else None
        except Exception:
            return None

    def get_my_sent_messages(self, limit_per_message: int = 100) -> List[str]:
        """채팅방 내 내가 보낸 메시지 텍스트 목록 반환"""
        try:
            cap = max(40, min(int(limit_per_message), 2000))
            result = self.driver.execute_script(
                """
                var cap = arguments[0];
                var allLi = document.querySelectorAll('li');
                var myMessages = [];
                for (var i = 0; i < allLi.length; i++) {
                    var li = allLi[i];
                    var style = window.getComputedStyle(li);
                    if (style.textAlign === 'right') {
                        var text = (li.textContent || '')
                            .replace(/오전|오후|안읽음/g, '').trim();
                        if (text.length > 0) myMessages.push(text.substring(0, cap));
                    }
                }
                return myMessages;
                """,
                cap,
            )
            messages = result if result else []
            logger.info(f'[채팅방] 내가 보낸 메시지 {len(messages)}개 확인')
            return messages
        except Exception as e:
            logger.error(f'[채팅방] 메시지 조회 오류: {e}')
            return []
