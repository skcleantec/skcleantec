"""채팅 목록 — 검색으로 방 입장 (세션 유지)."""
from __future__ import annotations

import logging
import time

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from automation.chat_navigation import (
    is_in_chat_room_url,
    is_login_url,
    is_on_chat_list_url,
    verify_chat_room_shell,
)
from automation.overlay_modals import dismiss_blocking_overlays
from automation.selectors import CHAT_LIST, URLS

logger = logging.getLogger(__name__)

_JS_FIND_SEARCH_INPUT = """
return (function() {
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }
  var selectors = [
    'input[type="search"]',
    'input[placeholder*="검색"]',
    'input[aria-label*="검색"]',
    'input[name*="search"]'
  ];
  for (var s = 0; s < selectors.length; s++) {
    var nodes = document.querySelectorAll(selectors[s]);
    for (var i = 0; i < nodes.length; i++) {
      if (visible(nodes[i])) return nodes[i];
    }
  }
  return null;
})();
"""

_JS_SET_SEARCH_VALUE = """
return (function(query) {
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }
  var selectors = [
    'input[type="search"]',
    'input[placeholder*="검색"]',
    'input[aria-label*="검색"]',
    'input[name*="search"]'
  ];
  var input = null;
  for (var s = 0; s < selectors.length; s++) {
    var nodes = document.querySelectorAll(selectors[s]);
    for (var i = 0; i < nodes.length; i++) {
      if (visible(nodes[i])) { input = nodes[i]; break; }
    }
    if (input) break;
  }
  if (!input) return false;
  input.focus();
  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  if (setter && setter.set) {
    setter.set.call(input, query);
  } else {
    input.value = query;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})(arguments[0]);
"""

_JS_CLEAR_SEARCH = """
return (function() {
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }
  var selectors = [
    'input[type="search"]',
    'input[placeholder*="검색"]',
    'input[aria-label*="검색"]'
  ];
  for (var s = 0; s < selectors.length; s++) {
    var nodes = document.querySelectorAll(selectors[s]);
    for (var i = 0; i < nodes.length; i++) {
      var input = nodes[i];
      if (!visible(input)) continue;
      input.focus();
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (setter && setter.set) setter.set.call(input, '');
      else input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
})();
"""

_JS_CLICK_CHAT_BY_ID = """
return (function(chatId) {
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }
  var id = String(chatId || '');
  var links = document.querySelectorAll('a[href*="/pro/chats/"]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.getAttribute('href') || a.href || '';
    if (href.indexOf('/pro/chats/' + id) < 0) continue;
    if (!visible(a)) continue;
    try {
      a.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch (e) {
      a.scrollIntoView(true);
    }
    a.click();
    return 'click';
  }
  return '';
})(arguments[0]);
"""

_SCROLL_LIST_TO_CHAT_JS = """
return (function(chatId) {
  var id = String(chatId || '');
  var links = document.querySelectorAll('a[href*="/pro/chats/"]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.getAttribute('href') || a.href || '';
    if (href.indexOf('/pro/chats/' + id) < 0) continue;
    try {
      a.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch (e) {
      a.scrollIntoView(true);
    }
    return true;
  }
  return false;
})(arguments[0]);
"""

_JS_IS_WITHDRAWN_ON_LIST = """
return (function(chatId) {
  var id = String(chatId || '');
  var links = document.querySelectorAll('a[href*="/pro/chats/"]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.getAttribute('href') || a.href || '';
    if (href.indexOf('/pro/chats/' + id) < 0) continue;
    var row = a.closest('li');
    if (!row) {
      var p = a.parentElement;
      for (var d = 0; d < 6 && p; d++) {
        if (p.tagName === 'LI') { row = p; break; }
        p = p.parentElement;
      }
    }
    var text = row ? (row.textContent || '') : (a.textContent || '');
    if (text.indexOf('탈퇴한 고객') >= 0) return true;
    if (text.indexOf('상대방이 채팅방을 나갔습니다') >= 0) return true;
  }
  return false;
})(arguments[0]);
"""


class ChatListSearchHelper:
    """목록 검색·클릭으로 채팅방 입장."""

    def __init__(self, driver, delay: float = 1.0):
        self.driver = driver
        self.delay = delay

    def ensure_on_chat_list(self) -> bool:
        if is_on_chat_list_url(self.driver.current_url) and not is_login_url(self.driver.current_url):
            dismiss_blocking_overlays(self.driver, self.delay * 0.2, max_rounds=2)
            return True
        return False

    def clear_search(self) -> None:
        try:
            self.driver.execute_script(_JS_CLEAR_SEARCH)
            time.sleep(self.delay * 0.25)
        except Exception as e:
            logger.debug('clear_search: %s', e)

    def _wait_list_ready(self, timeout: float = 10) -> bool:
        try:
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((
                    By.CSS_SELECTOR,
                    CHAT_LIST['PAGE_READY_INDICATOR'],
                ))
            )
            return True
        except Exception:
            return False

    def _search_query_for(self, nickname: str, chat_id: str) -> str:
        name = (nickname or '').strip()
        if name and not name.startswith('ID:'):
            return name[:40]
        return str(chat_id)

    def _click_chat_link(self, chat_id: str) -> bool:
        via = self.driver.execute_script(_JS_CLICK_CHAT_BY_ID, chat_id) or ''
        if via:
            time.sleep(self.delay * 0.55)
            return is_in_chat_room_url(self.driver.current_url)
        return False

    def _room_shell_ok(self) -> bool:
        shell = verify_chat_room_shell(self.driver)
        if shell.get('leaveOnly') or shell.get('withdrawn'):
            return True
        if shell.get('emptyShell'):
            return False
        return bool(shell.get('ok') or shell.get('hasMsgItems'))

    def is_withdrawn_on_list(self, chat_id: str) -> bool:
        """목록·검색 결과 — 탈퇴·상대방 나감."""
        try:
            return bool(self.driver.execute_script(_JS_IS_WITHDRAWN_ON_LIST, chat_id))
        except Exception as e:
            logger.debug('is_withdrawn_on_list: %s', e)
            return False

    def open_chat_by_search(self, chat_id: str, nickname: str = '', *, log=None) -> bool:
        """검색창 → 이름 입력 → chat_id 링크 클릭."""
        if is_login_url(self.driver.current_url):
            return False
        if not self.ensure_on_chat_list():
            return False

        query = self._search_query_for(nickname, chat_id)
        if not query:
            return False

        try:
            self.clear_search()
            has_input = self.driver.execute_script(_JS_FIND_SEARCH_INPUT)
            if not has_input:
                if log:
                    log('  [입장] 검색창 없음 — 목록 클릭 시도')
                return False

            ok = self.driver.execute_script(_JS_SET_SEARCH_VALUE, query)
            if not ok:
                return False
            time.sleep(self.delay * 0.65)
            self._wait_list_ready(timeout=8)

            if self._click_chat_link(chat_id) and self._room_shell_ok():
                if log:
                    log(f'  [입장] 검색 "{query}"')
                return True

            if log:
                log(f'  [입장] 검색 "{query}" — 결과 없음/불일치')
            self.clear_search()
            return False
        except Exception as e:
            logger.debug('open_chat_by_search: %s', e)
            self.clear_search()
            return False

    def open_chat_by_list_link(self, chat_id: str, *, log=None) -> bool:
        """목록에서 chat_id 링크 scroll + click."""
        if is_login_url(self.driver.current_url):
            return False
        if not self.ensure_on_chat_list():
            return False
        try:
            self.clear_search()
            self.driver.execute_script(_SCROLL_LIST_TO_CHAT_JS, chat_id)
            time.sleep(self.delay * 0.3)
            if self._click_chat_link(chat_id) and self._room_shell_ok():
                if log:
                    log('  [입장] 목록 링크 클릭')
                return True
        except Exception as e:
            logger.debug('open_chat_by_list_link: %s', e)
        return False

    def open_chat_by_spa_assign(self, chat_id: str, *, log=None) -> bool:
        if is_login_url(self.driver.current_url):
            return False
        try:
            if not self.ensure_on_chat_list():
                self.driver.execute_script(
                    'window.location.assign(arguments[0]);',
                    URLS['CHAT_LIST'],
                )
                time.sleep(self.delay * 0.7)
            url = URLS['CHAT_ROOM'].format(chat_id=chat_id)
            self.driver.execute_script('window.location.assign(arguments[0]);', url)
            time.sleep(self.delay * 0.75)
            if is_in_chat_room_url(self.driver.current_url) and self._room_shell_ok():
                if log:
                    log('  [입장] SPA 이동')
                return True
        except Exception as e:
            logger.debug('open_chat_by_spa_assign: %s', e)
        return False

    def open_chat(
        self,
        chat_id: str,
        nickname: str = '',
        *,
        log=None,
    ) -> bool:
        """검색 → 목록 클릭 → SPA assign 순."""
        if self.open_chat_by_search(chat_id, nickname, log=log):
            return True
        if self.open_chat_by_list_link(chat_id, log=log):
            return True
        return self.open_chat_by_spa_assign(chat_id, log=log)

    def return_to_list_spa(self, *, log=None) -> bool:
        """방 → 목록. history.back / SPA assign (driver.get 금지)."""
        from automation.chat_navigation import return_to_chat_list_session_safe

        ok = return_to_chat_list_session_safe(
            self.driver, self.delay, log=log, allow_full_get=False,
        )
        if ok:
            self.clear_search()
            return True
        return False
