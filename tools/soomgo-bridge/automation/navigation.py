"""숨고 고수 화면 — 채팅 목록·채팅방 유지 네비게이션"""
from __future__ import annotations

import logging
import re
import time

from automation.overlay_modals import dismiss_blocking_overlays
from automation.mobile_viewport import apply_mobile_viewport
from automation.selectors import NON_CHAT_PRO_PATH_HINTS, URLS

logger = logging.getLogger(__name__)


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


def is_on_non_chat_pro_page(url: str) -> bool:
    path = _current_path(url)
    if '/pro/chats' in path:
        return False
    if not path.startswith('/pro'):
        return False
    return any(hint in path for hint in NON_CHAT_PRO_PATH_HINTS) or path in ('/pro', '/pro/')


def is_pro_session_url(url: str) -> bool:
    lower = url.lower()
    if 'login' in lower or '/sign' in lower:
        return False
    return '/pro' in lower


def _click_chat_nav(driver) -> bool:
    """사이드/하단 탭의 「채팅」 메뉴 클릭"""
    try:
        clicked = driver.execute_script("""
            var candidates = document.querySelectorAll(
              "a[href*='/pro/chats'], button, [role='tab'], nav a, aside a, li a, "
              + "footer a, nav button, [data-testid*='chat'], [aria-label*='채팅']"
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
                href.indexOf('/pro/chats') >= 0
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


def ensure_chat_workspace(driver, delay: float = 1.0, force_list: bool = False) -> bool:
    """
    상담사 채팅 업무 화면으로 맞춘다.
    - 이미 상세 채팅방이면 그대로 유지 (통화·메시지·정보 추출 중단 방지)
    - 받은요청 등 다른 /pro 페이지면 채팅 목록으로 이동
    """
    try:
        apply_mobile_viewport(driver)
        dismiss_blocking_overlays(driver, 0.3, max_rounds=2)

        url = driver.current_url
        if not force_list and is_in_chat_room_url(url):
            logger.info('stay in chat room: %s', url)
            return True

        if not force_list and is_on_chat_list_url(url):
            logger.info('already on chat list')
            return True

        if is_on_non_chat_pro_page(url) or force_list or not is_on_chat_list_url(url):
            logger.info('navigate to chat list from %s', url)
            _navigate_to_chat_list_direct(driver, delay)

        url = driver.current_url
        if _on_chat_workspace(url):
            return True

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

        return _on_chat_workspace(driver.current_url)
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
