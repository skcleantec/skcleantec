"""숨고 채팅 — SPA 셸 유지하며 목록↔방 이동."""
from __future__ import annotations

import logging
import time

from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from automation.overlay_modals import dismiss_blocking_overlays
from automation.selectors import URLS
from automation.window_layout import ensure_soomgo_mobile_layout

logger = logging.getLogger(__name__)

_CHAT_LIST_READY_SELECTOR = (
    'ul.css-19wxjby > li, main ul > li, ul[class*="css-"] > li, a[href*="/pro/chats/"]'
)
_CHAT_ROOM_READY_SELECTOR = (
    '.chat-room, .chat-messages, .chat-messages-container, section.chatbody-section, '
    'textarea, [role="textbox"], [contenteditable="true"]'
)


def wait_document_usable(driver, timeout: float = 12) -> bool:
    """SPA — interactive 이상이면 진행 (complete만 기다리면 멈춤)"""
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: d.execute_script(
                "return document.readyState === 'interactive' "
                "|| document.readyState === 'complete'"
            )
        )
        return True
    except TimeoutException:
        return False


def navigate_get(driver, url: str, *, page_timeout: int = 45) -> bool:
    """driver.get + 타임아웃 시 window.stop (eager 로드·느린 리소스 대응)"""
    try:
        driver.set_page_load_timeout(page_timeout)
        driver.get(url)
        return True
    except TimeoutException:
        logger.warning('navigate_get timeout — partial load continues: %s', url)
        try:
            driver.execute_script('window.stop();')
        except Exception:
            pass
        return True
    except WebDriverException as exc:
        logger.warning('navigate_get failed: %s — %s', url, exc)
        return False


def wait_for_chat_list_elements(driver, timeout: float = 15) -> bool:
    try:
        wait_document_usable(driver, min(timeout, 8))
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, _CHAT_LIST_READY_SELECTOR))
        )
        return True
    except TimeoutException:
        return False


def wait_for_chat_room_elements(driver, timeout: float = 15) -> bool:
    try:
        wait_document_usable(driver, min(timeout, 8))
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, _CHAT_ROOM_READY_SELECTOR))
        )
        return True
    except TimeoutException:
        return False


_VERIFY_CHAT_SHELL_JS = """
return (function() {
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') >= 0.05;
  }
  function inChatPath() {
    return /\\/pro\\/chats\\/\\d+/.test(location.pathname || '');
  }

  var room = document.querySelector(
    '.chat-room, [class*="chat-room"], [chatid], section.chatbody-section'
  );
  var msgItems = document.querySelectorAll(
    '.chat-messages li, .chat-messages-container li, section.chatbody-section li, .chat-room li'
  );
  var hasMsgItems = false;
  for (var i = 0; i < msgItems.length; i++) {
    var t = (msgItems[i].textContent || '').replace(/\\s+/g, ' ').trim();
    if (t.length > 8) { hasMsgItems = true; break; }
  }

  var topClickable = document.querySelectorAll(
    'button, a, [role="button"], header button, .chat-room button'
  );
  var hasTopBack = false;
  var hasTopMenu = false;
  for (var j = 0; j < topClickable.length; j++) {
    var el = topClickable[j];
    if (!visible(el)) continue;
    var r = el.getBoundingClientRect();
    if (r.top > 130) continue;
    if (r.left < 120) hasTopBack = true;
    if (r.right > (window.innerWidth || 400) - 120) hasTopMenu = true;
  }

  var titleEl = document.querySelector(
    'header h1, header h2, header h5, .chat-room header h5, '
    + '[class*="chat-header"] h5, [class*="ChatHeader"] h5, .chat-room h5'
  );
  var hasTitle = !!(titleEl && visible(titleEl) && (titleEl.textContent || '').trim().length > 0);

  var bodyText = (document.body.innerText || '').slice(0, 5000);
  var withdrawn = bodyText.indexOf('탈퇴한 고객') >= 0;
  var peerLeft = bodyText.indexOf('상대방이 채팅방을 나갔습니다') >= 0;
  var leaveOnly = withdrawn || peerLeft;
  var composer = document.querySelector(
    'textarea, [contenteditable="true"], [role="textbox"], '
    + '[class*="composer"], [class*="message-input"], [class*="chat-input"]'
  );
  var hasComposer = !!(composer && visible(composer));

  var emptyShell = inChatPath() && !leaveOnly && hasComposer && !hasMsgItems && !hasTitle && !hasTopBack;
  var ok = inChatPath() && (
    leaveOnly ||
    (hasMsgItems && (hasTitle || hasTopBack || hasTopMenu || !!(room && visible(room))))
  );

  return {
    ok: ok,
    emptyShell: emptyShell,
    hasMsgItems: hasMsgItems,
    hasTitle: hasTitle,
    hasTopBack: hasTopBack,
    hasTopMenu: hasTopMenu,
    hasComposer: hasComposer,
    withdrawn: leaveOnly,
    peerLeft: peerLeft,
    leaveOnly: leaveOnly
  };
})();
"""

_CLICK_CHAT_LINK_JS = """
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
    a.click();
    return 'click';
  }
  return '';
})(arguments[0]);
"""

_GO_BACK_JS = """
return (function() {
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }
  var candidates = document.querySelectorAll(
    "button[aria-label*='뒤로'], a[href='/pro/chats'], a[href*='/pro/chats'], "
    + 'header button, .chat-room button, button, a, [role="button"]'
  );
  var best = null;
  var bestScore = -1;
  for (var i = 0; i < candidates.length; i++) {
    var el = candidates[i];
    if (!visible(el)) continue;
    var r = el.getBoundingClientRect();
    if (r.top > 130) continue;
    var score = 0;
    var label = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim();
    if (/뒤로|back/i.test(label)) score += 80;
    if (r.left < 80) score += 60;
    if (r.top < 80) score += 20;
    if (score > bestScore) { bestScore = score; best = el; }
  }
  if (best && bestScore >= 20) {
    best.click();
    return 'click';
  }
  try { history.back(); return 'history'; } catch (e) {}
  return '';
})();
"""


_DETECT_CHAT_BLOCKER_JS = """
return (function() {
  var path = location.pathname || '';
  var href = location.href || '';
  var t = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 8000) : '';
  if (/login|signin|signup/i.test(href)) return 'login';
  if (t.indexOf('로그인') >= 0 && (t.indexOf('이메일') >= 0 || t.indexOf('비밀번호') >= 0)) return 'login';
  if (t.indexOf('존재하지') >= 0 || t.indexOf('찾을 수 없') >= 0) return 'not_found';
  if (t.indexOf('접근할 수 없') >= 0 || t.indexOf('삭제된') >= 0 || t.indexOf('종료된') >= 0) return 'gone';
  if (/\\/pro\\/chats\\/\\d+/.test(path) && t.indexOf('오류') >= 0 && t.indexOf('다시') >= 0) return 'invalid';
  return '';
})();
"""


def is_login_url(url: str) -> bool:
    lower = (url or '').lower()
    return 'login' in lower or '/sign' in lower or '/signup' in lower


def is_in_chat_room_url(url: str) -> bool:
    path = url.split('?')[0].rstrip('/')
    if '/pro/chats/' not in path:
        return False
    tail = path.split('/pro/chats/')[-1]
    return bool(tail and tail.isdigit())


def is_on_chat_list_url(url: str) -> bool:
    path = url.split('?')[0].rstrip('/').lower()
    return path.endswith('/pro/chats')


def verify_chat_room_shell(driver) -> dict:
    try:
        raw = driver.execute_script(_VERIFY_CHAT_SHELL_JS) or {}
        if isinstance(raw, dict):
            return raw
    except Exception as e:
        logger.debug('verify_chat_room_shell: %s', e)
    return {'ok': False, 'emptyShell': True}


def detect_chat_room_blocker(driver) -> str:
    """login / not_found / gone / invalid / ''"""
    if is_login_url(driver.current_url):
        return 'login'
    try:
        result = driver.execute_script(_DETECT_CHAT_BLOCKER_JS) or ''
        if isinstance(result, str):
            return result
    except Exception as e:
        logger.debug('detect_chat_room_blocker: %s', e)
    return ''


def _wait_for_chat_room_ready(driver, delay: float) -> None:
    wait_for_chat_room_elements(driver, timeout=15)
    time.sleep(delay * 0.45)


def _ensure_on_chat_list(driver, delay: float, *, log=None) -> bool:
    if is_on_chat_list_url(driver.current_url) and not is_login_url(driver.current_url):
        dismiss_blocking_overlays(driver, delay * 0.2, max_rounds=2)
        return True
    return recover_chat_list_workspace(driver, delay, log=log)


def recover_chat_list_workspace(driver, delay: float = 1.0, *, log=None) -> bool:
    """채팅 목록 SPA 복구."""
    def _log(msg: str) -> None:
        if log:
            log(msg)
        else:
            logger.info(msg)

    try:
        if is_login_url(driver.current_url):
            _log('[세션] 로그인 페이지 — 재로그인이 필요합니다.')
            return False

        was_on_list = is_on_chat_list_url(driver.current_url)
        if not was_on_list:
            if not navigate_get(driver, URLS['CHAT_LIST'], page_timeout=45):
                _log('[목록 복구] URL 이동 실패')
                return False
            ensure_soomgo_mobile_layout(driver)

        dismiss_blocking_overlays(driver, delay * 0.35, max_rounds=3)
        time.sleep(delay * 0.7)

        if is_login_url(driver.current_url):
            _log('[세션] 로그인 페이지 — 재로그인이 필요합니다.')
            return False

        if not wait_for_chat_list_elements(driver, timeout=15):
            _log('[목록 복구] 채팅 목록 요소 대기 시간 초과')
            return False
        return is_on_chat_list_url(driver.current_url)
    except Exception as e:
        _log(f'[목록 복구] 실패: {type(e).__name__}')
        return False


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

def _open_via_spa_assign(driver, chat_url: str, delay: float) -> str:
    dismiss_blocking_overlays(driver, delay * 0.2, max_rounds=2)
    driver.execute_script('window.location.assign(arguments[0]);', chat_url)
    time.sleep(delay * 0.6)
    return 'spa_assign'


def _open_via_list_click(driver, chat_id: str, delay: float) -> str:
    driver.execute_script(_SCROLL_LIST_TO_CHAT_JS, chat_id)
    time.sleep(delay * 0.25)
    via = driver.execute_script(_CLICK_CHAT_LINK_JS, chat_id) or ''
    if via:
        time.sleep(delay * 0.6)
    return via or ''


def _reload_current_chat_room(driver, delay: float) -> bool:
    if not is_in_chat_room_url(driver.current_url):
        return False
    try:
        driver.execute_script('location.reload();')
        time.sleep(delay * 0.8)
        _wait_for_chat_room_ready(driver, delay)
        shell = verify_chat_room_shell(driver)
        return bool(shell.get('ok') and not shell.get('emptyShell'))
    except Exception as e:
        logger.debug('reload chat room: %s', e)
        return False


def _open_via_get(driver, chat_url: str, delay: float) -> str:
    navigate_get(driver, chat_url, page_timeout=45)
    time.sleep(delay * 0.7)
    return 'get'


def open_chat_room_direct(
    driver,
    chat_id: str,
    delay: float = 1.0,
    *,
    log=None,
) -> bool:
    """채팅방 입장 — driver.get (다른 기능에서 검증된 단순 방식)."""
    cid = str(chat_id or '').strip()
    if not cid.isdigit():
        return False

    def _log(msg: str) -> None:
        if log:
            log(msg)
        else:
            logger.info(msg)

    chat_url = URLS['CHAT_ROOM'].format(chat_id=cid)
    try:
        if not navigate_get(driver, chat_url, page_timeout=45):
            _log('[채팅방] URL 이동 실패')
            return False
        ensure_soomgo_mobile_layout(driver)
        dismiss_blocking_overlays(driver, delay * 0.35, max_rounds=3)
        if not wait_for_chat_room_elements(driver, timeout=15):
            _log('[채팅방] 메시지·입력 영역 대기 시간 초과 (부분 로드로 계속)')
        time.sleep(delay * 0.5)
        if is_login_url(driver.current_url):
            _log('[세션] 방 입장 중 로그인 페이지로 이동됨')
            return False
        shell = verify_chat_room_shell(driver)
        if shell.get('emptyShell'):
            _log('[채팅방] 빈 화면 — 새로고침 후 재확인')
            _reload_current_chat_room(driver, delay)
        if not is_in_chat_room_url(driver.current_url):
            _log(f'[채팅방] URL 확인 실패: {driver.current_url}')
            return False
        blocker = detect_chat_room_blocker(driver)
        if blocker in ('not_found', 'gone', 'invalid'):
            _log(f'[채팅방] 진입 불가 ({blocker})')
            return False
        return True
    except Exception as e:
        _log(f'[채팅방] 이동 실패: {type(e).__name__}')
        return False


def return_to_chat_list_direct(
    driver,
    delay: float = 1.0,
    *,
    log=None,
) -> bool:
    """채팅 목록 복귀 — driver.get (CDP·go_back 없음)."""
    return return_to_chat_list_session_safe(driver, delay, log=log, allow_full_get=True)


def return_to_chat_list_session_safe(
    driver,
    delay: float = 1.0,
    *,
    log=None,
    allow_full_get: bool = True,
) -> bool:
    """채팅방 → 목록. history.back / SPA assign 우선 (세션 유지)."""
    def _log(msg: str) -> None:
        if log:
            log(msg)
        else:
            logger.info(msg)

    try:
        if is_on_chat_list_url(driver.current_url) and not is_login_url(driver.current_url):
            dismiss_blocking_overlays(driver, delay * 0.2, max_rounds=2)
            return True

        if is_login_url(driver.current_url):
            _log('[세션] 로그인 페이지 — 재로그인이 필요합니다.')
            return False

        if is_in_chat_room_url(driver.current_url):
            try:
                driver.execute_script('history.back();')
                time.sleep(delay * 0.55)
                if is_on_chat_list_url(driver.current_url) and not is_login_url(driver.current_url):
                    dismiss_blocking_overlays(driver, delay * 0.2, max_rounds=2)
                    return True
            except Exception as e:
                logger.debug('history.back: %s', e)

            try:
                via = driver.execute_script(_GO_BACK_JS) or ''
                time.sleep(delay * 0.45)
                if is_on_chat_list_url(driver.current_url) and not is_login_url(driver.current_url):
                    dismiss_blocking_overlays(driver, delay * 0.2, max_rounds=2)
                    return True
                if via:
                    logger.debug('[목록 복귀] 뒤로가기(%s) 후 목록 아님', via)
            except Exception as e:
                logger.debug('go_back js: %s', e)

        dismiss_blocking_overlays(driver, delay * 0.15, max_rounds=1)
        driver.execute_script('window.location.assign(arguments[0]);', URLS['CHAT_LIST'])
        time.sleep(delay * 0.75)
        dismiss_blocking_overlays(driver, delay * 0.2, max_rounds=2)

        if is_login_url(driver.current_url):
            _log('[세션] 로그인 페이지 — 재로그인이 필요합니다.')
            return False

        if is_on_chat_list_url(driver.current_url):
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((
                    By.CSS_SELECTOR,
                    'ul.css-19wxjby > li, main ul > li, ul[class*="css-"] > li, a[href*="/pro/chats/"]',
                ))
            )
            return True

        if not allow_full_get:
            _log('[목록 복귀] SPA 복귀 실패')
            return False

        driver.get(URLS['CHAT_LIST'])
        time.sleep(delay)
        dismiss_blocking_overlays(driver, delay * 0.2, max_rounds=2)

        if is_login_url(driver.current_url):
            _log('[세션] 로그인 페이지 — 재로그인이 필요합니다.')
            return False

        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located((
                By.CSS_SELECTOR,
                'ul.css-19wxjby > li, main ul > li, ul[class*="css-"] > li, a[href*="/pro/chats/"]',
            ))
        )
        return is_on_chat_list_url(driver.current_url)
    except Exception as e:
        _log(f'[목록 복귀] 실패: {type(e).__name__}')
        return False


def open_chat_room_session_safe(
    driver,
    chat_id: str,
    delay: float = 1.0,
    *,
    log=None,
) -> bool:
    """목록 SPA 유지 — 클릭·assign 우선, driver.get 은 최후."""
    cid = str(chat_id or '').strip()
    if not cid.isdigit():
        return False

    def _log(msg: str) -> None:
        if log:
            log(msg)
        else:
            logger.info(msg)

    chat_url = URLS['CHAT_ROOM'].format(chat_id=cid)

    if not is_on_chat_list_url(driver.current_url) or is_login_url(driver.current_url):
        if is_login_url(driver.current_url):
            _log('[세션] 방 입장 전 로그인 페이지')
            return False
        return_to_chat_list_session_safe(
            driver, delay, log=log, allow_full_get=True,
        )

    strategies = (
        ('목록 클릭', lambda: _open_via_list_click(driver, cid, delay)),
        ('SPA 이동', lambda: _open_via_spa_assign(driver, chat_url, delay)),
    )

    for name, navigate in strategies:
        if not is_on_chat_list_url(driver.current_url):
            return_to_chat_list_session_safe(
                driver, delay, log=log, allow_full_get=False,
            )
        try:
            via = navigate()
            if not via and name == '목록 클릭':
                continue

            if is_login_url(driver.current_url):
                _log('[세션] 방 입장 중 로그인 페이지로 이동됨')
                return False

            _wait_for_chat_room_ready(driver, delay)

            if not is_in_chat_room_url(driver.current_url):
                continue

            shell = verify_chat_room_shell(driver)
            if shell.get('ok') and not shell.get('emptyShell'):
                return True
            if shell.get('withdrawn') and shell.get('hasMsgItems'):
                return True
            if shell.get('emptyShell'):
                _log(f'[채팅방] 빈 화면 — {name} 실패')
                return_to_chat_list_session_safe(
                    driver, delay, log=log, allow_full_get=False,
                )
        except Exception as e:
            logger.debug('open_chat_room_session_safe %s: %s', name, e)

    _log('[채팅방] SPA 입장 실패 — URL 직접 이동')
    if open_chat_room_direct(driver, cid, delay, log=log):
        shell = verify_chat_room_shell(driver)
        return bool(shell.get('ok') or shell.get('hasMsgItems'))
    return False


def open_chat_room_by_id(
    driver,
    chat_id: str,
    delay: float = 1.0,
    *,
    log=None,
) -> bool:
    """채팅방 입장 — 목록 SPA 유지 후 assign/클릭 우선."""
    cid = str(chat_id or '').strip()
    if not cid.isdigit():
        return False

    def _log(msg: str) -> None:
        if log:
            log(msg)
        else:
            logger.info(msg)

    chat_url = URLS['CHAT_ROOM'].format(chat_id=cid)
    strategies = (
        ('SPA 이동', lambda: _open_via_spa_assign(driver, chat_url, delay)),
        ('목록 링크 클릭', lambda: _open_via_list_click(driver, cid, delay)),
        ('URL 직접 이동', lambda: _open_via_get(driver, chat_url, delay)),
    )

    for name, navigate in strategies:
        if not _ensure_on_chat_list(driver, delay, log=log):
            return False

        try:
            via = navigate()
            if not via and name == '목록 링크 클릭':
                continue

            if is_login_url(driver.current_url):
                _log('[세션] 방 입장 중 로그인 페이지로 이동됨')
                return False

            blocker = detect_chat_room_blocker(driver)
            if blocker == 'login':
                _log('[세션] 방 입장 중 로그인 페이지로 이동됨')
                return False
            if blocker in ('not_found', 'gone', 'invalid'):
                _log(f'[채팅방] 없거나 접근 불가 ({blocker}) — 입장 중단')
                return False

            _wait_for_chat_room_ready(driver, delay)

            if not is_in_chat_room_url(driver.current_url):
                _log(f'[채팅방] URL 불일치 — {name}')
                continue

            shell = verify_chat_room_shell(driver)
            if shell.get('ok') and not shell.get('emptyShell'):
                return True

            if shell.get('emptyShell'):
                _log(f'[채팅방] 빈 화면(입력창만) — 새로고침 시도')
                if _reload_current_chat_room(driver, delay):
                    return True
                _log(f'[채팅방] 빈 화면 — {name} 실패, 다른 방식 시도')
                recover_chat_list_workspace(driver, delay, log=log)
                continue

            if shell.get('withdrawn') and shell.get('hasMsgItems'):
                return True

            _log(f'[채팅방] 로드 미완료 — {name} 재시도')
            recover_chat_list_workspace(driver, delay, log=log)
        except Exception as e:
            _log(f'[채팅방] {name} 오류: {type(e).__name__}')
            recover_chat_list_workspace(driver, delay, log=log)

    _log('[채팅방] 모든 입장 방식 실패')
    return False


def return_to_chat_list(driver, delay: float = 1.0, *, log=None) -> bool:
    """채팅방 → 목록. go_back 우선."""
    def _log(msg: str) -> None:
        if log:
            log(msg)
        else:
            logger.info(msg)

    try:
        if is_in_chat_room_url(driver.current_url):
            try:
                via = driver.execute_script(_GO_BACK_JS) or ''
                time.sleep(delay * 0.45)
                if is_on_chat_list_url(driver.current_url):
                    dismiss_blocking_overlays(driver, delay * 0.2, max_rounds=2)
                    return True
                if via:
                    _log(f'[목록 복귀] 뒤로가기({via}) 후 목록 아님 — URL 이동')
            except Exception as e:
                logger.debug('go_back js: %s', e)

        return recover_chat_list_workspace(driver, delay, log=log)
    except Exception as e:
        _log(f'[목록 복귀] 실패: {type(e).__name__}')
        return False
