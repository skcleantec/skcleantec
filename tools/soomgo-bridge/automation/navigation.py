"""숨고 고수 화면 — 채팅 목록·채팅방 유지 네비게이션"""
from __future__ import annotations

import logging
import re
import time

from automation.overlay_modals import dismiss_blocking_overlays
from automation.chat_room import ensure_chat_composer_visible
from automation.window_layout import apply_mobile_viewport
from automation.selectors import NON_CHAT_SESSION_PATH_HINTS, URLS

logger = logging.getLogger(__name__)

_MAX_CHAT_NAV_ATTEMPTS = 4


def _current_path(url: str) -> str:
    try:
        from urllib.parse import urlparse

        return urlparse(url).path.lower()
    except Exception:
        return url.lower()


def is_in_chat_room_url(url: str) -> bool:
    path = _current_path(url)
    if '/pro/chats/' not in path:
        return False
    tail = path.rstrip('/').split('/pro/chats/')[-1].split('?')[0]
    return bool(tail and tail.isdigit())


def is_on_chat_list_url(url: str) -> bool:
    path = _current_path(url).rstrip('/')
    return path == '/pro/chats' or path.endswith('/pro/chats')


def is_on_non_chat_work_page(url: str) -> bool:
    """채팅 목록·방이 아닌 숨고 업무 화면 (받은요청 /requests/received 포함)."""
    if is_on_chat_list_url(url) or is_in_chat_room_url(url):
        return False
    path = _current_path(url)
    if path.startswith('/requests'):
        return True
    if not path.startswith('/pro'):
        return False
    return any(hint in path for hint in NON_CHAT_SESSION_PATH_HINTS) or path in ('/pro', '/pro/')


def is_on_non_chat_pro_page(url: str) -> bool:
    return is_on_non_chat_work_page(url)


def is_pro_session_url(url: str) -> bool:
    """로그인된 숨고 고수/업무 세션 URL (/pro·/requests/received 등)."""
    lower = url.lower()
    if 'soomgo.com' not in lower:
        return False
    if any(token in lower for token in ('/login', '/sign', '/signup', '/register')):
        return False
    path = _current_path(url).rstrip('/') or '/'
    if path == '/':
        return False
    if path.startswith('/pro'):
        return True
    if path.startswith('/requests'):
        return True
    return False


def needs_chat_workspace(url: str) -> bool:
    return is_pro_session_url(url) and not is_on_chat_list_url(url) and not is_in_chat_room_url(url)


def is_logged_in(driver) -> bool:
    try:
        return is_pro_session_url(driver.current_url)
    except Exception:
        return False


def _click_chat_nav(driver) -> bool:
    """사이드/하단 탭의 「채팅」 메뉴 클릭"""
    try:
        clicked = driver.execute_script("""
            var candidates = document.querySelectorAll(
              "a[href*='/pro/chats'], a[href*='pro/chats'], button, [role='tab'], "
              + "nav a, aside a, li a, footer a, nav button, "
              + "[data-testid*='chat'], [aria-label*='채팅']"
            );
            for (var i = 0; i < candidates.length; i++) {
              var el = candidates[i];
              var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
              var href = (el.getAttribute('href') || '').toLowerCase();
              var aria = (el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
              var label = text || aria;
              if (
                label === '채팅' ||
                label.indexOf('채팅 ') === 0 ||
                aria.indexOf('채팅') >= 0 ||
                href.indexOf('/pro/chats') >= 0 ||
                href.indexOf('pro/chats') >= 0
              ) {
                if (label.indexOf('받은') >= 0 || label.indexOf('요청') >= 0) continue;
                el.click();
                return true;
              }
            }
            return false;
        """)
        return bool(clicked)
    except Exception as e:
        logger.debug('click chat nav failed: %s', e)
        return False


def _navigate_to_chat_list_direct(driver, delay: float) -> None:
    driver.get(URLS['CHAT_LIST'])
    time.sleep(delay * 1.5)


def _on_chat_workspace(url: str) -> bool:
    return is_on_chat_list_url(url) or is_in_chat_room_url(url)


def _recover_chat_list_from_work_page(driver, delay: float) -> bool:
    """받은요청(/requests/received) 등에서 채팅 목록으로 이동 — 여러 번 재시도."""
    for attempt in range(_MAX_CHAT_NAV_ATTEMPTS):
        url = driver.current_url
        if _on_chat_workspace(url):
            return True

        path = _current_path(url)
        logger.info('chat nav attempt %s from %s', attempt + 1, url)

        if path.startswith('/requests') or is_on_non_chat_work_page(url):
            if _click_chat_nav(driver):
                time.sleep(delay * 1.2)
                if _on_chat_workspace(driver.current_url):
                    return True

        dismiss_blocking_overlays(driver, 0.3, max_rounds=2)
        _navigate_to_chat_list_direct(driver, delay)
        if _on_chat_workspace(driver.current_url):
            return True

        try:
            driver.execute_script('window.location.href = arguments[0];', URLS['CHAT_LIST'])
            time.sleep(delay * 1.2)
        except Exception:
            pass
        if _on_chat_workspace(driver.current_url):
            return True

    return _on_chat_workspace(driver.current_url)


def ensure_chat_workspace(driver, delay: float = 1.0, force_list: bool = False) -> bool:
    """
    상담사 채팅 업무 화면으로 맞춘다.
    - 이미 상세 채팅방이면 그대로 유지 (통화·메시지·정보 추출 중단 방지)
    - 받은요청(/requests/received) 등 다른 업무 페이지면 채팅 목록으로 이동
    """
    try:
        apply_mobile_viewport(driver)
        dismiss_blocking_overlays(driver, 0.3, max_rounds=2)

        url = driver.current_url
        if not force_list and is_in_chat_room_url(url):
            logger.info('stay in chat room: %s', url)
            ensure_chat_composer_visible(driver)
            return True

        if not force_list and is_on_chat_list_url(url):
            logger.info('already on chat list')
            return True

        if needs_chat_workspace(url) or force_list:
            logger.info('navigate to chat list from %s', url)
            return _recover_chat_list_from_work_page(driver, delay)

        if not _on_chat_workspace(url):
            return _recover_chat_list_from_work_page(driver, delay)

        return True
    except Exception as e:
        logger.error('ensure_chat_workspace: %s', e)
        return False


def remember_chat_room_url(driver) -> str | None:
    try:
        url = driver.current_url
        return url if is_in_chat_room_url(url) else None
    except Exception:
        return None


def open_chat_room_by_id(driver, chat_id: str, delay: float = 1.0) -> bool:
    cid = str(chat_id or '').strip()
    if not cid.isdigit():
        return False
    try:
        target = URLS['CHAT_ROOM'].format(chat_id=cid)
        driver.get(target)
        time.sleep(delay * 1.5)
        return is_in_chat_room_url(driver.current_url)
    except Exception as e:
        logger.error('open_chat_room_by_id: %s', e)
        return False


def restore_chat_room_if_lost(driver, room_url: str | None, delay: float = 1.0) -> bool:
    if not room_url:
        return False
    try:
        if is_in_chat_room_url(driver.current_url):
            return True
        m = re.search(r'/pro/chats/(\d+)', room_url)
        if not m:
            return False
        chat_id = m.group(1)
        return open_chat_room_by_id(driver, chat_id, delay=delay)
    except Exception as e:
        logger.error('restore_chat_room: %s', e)
        return False
