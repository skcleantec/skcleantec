"""숨고 채팅방 — 나가기 메뉴·확인."""
from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

_LEAVE_CHAT_JS = r"""
(function() {
  function norm(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05;
  }
  function clickEl(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    try { el.click(); return true; } catch (e2) {}
    try {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch (e3) {}
    return false;
  }
  function findLeaveItem() {
    var nodes = document.querySelectorAll('button, a, [role="button"], li, span, div, p');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!visible(el)) continue;
      var t = norm(el.textContent || '');
      if (t === '채팅방 나가기' || t.indexOf('채팅방 나가기') >= 0) return el;
    }
    return null;
  }
  function openHeaderMenu() {
    var selectors = [
      'button[aria-label*="더보기"]',
      'button[aria-label*="메뉴"]',
      'button[aria-label*="옵션"]',
      '[class*="more"] button',
      'header button'
    ];
    for (var si = 0; si < selectors.length; si++) {
      var nodes = document.querySelectorAll(selectors[si]);
      for (var ni = 0; ni < nodes.length; ni++) {
        var btn = nodes[ni];
        if (!visible(btn)) continue;
        var label = norm((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || ''));
        if (/더보기|메뉴|옵션|menu|more/i.test(label) || label === '⋯' || label === '...') {
          clickEl(btn);
          return true;
        }
      }
    }
    return false;
  }
  function confirmLeave() {
    var nodes = document.querySelectorAll('button, [role="button"], a');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!visible(el)) continue;
      var t = norm(el.textContent || '');
      if (t === '나가기' || t === '채팅방 나가기' || t === '확인' || t === '나갈게요') {
        clickEl(el);
        return true;
      }
    }
    return false;
  }
  var leave = findLeaveItem();
  if (!leave) {
    openHeaderMenu();
    leave = findLeaveItem();
  }
  if (!leave) return { ok: false, step: 'menu_not_found' };
  if (!clickEl(leave)) return { ok: false, step: 'leave_click_failed' };
  var confirmed = confirmLeave();
  return { ok: true, confirmed: confirmed, step: confirmed ? 'confirmed' : 'leave_clicked' };
})();
"""


def leave_current_chat_room(driver, delay: float = 0.45) -> tuple[bool, str | None]:
    """현재 열린 채팅방 나가기. (되돌리기 불가)"""
    try:
        result = driver.execute_script(_LEAVE_CHAT_JS) or {}
    except Exception as e:
        logger.error('leave_current_chat_room: %s', e)
        return False, str(e) or 'leave_failed'

    time.sleep(delay)
    if not result.get('ok'):
        step = str(result.get('step') or 'unknown')
        return False, f'채팅방 나가기 메뉴를 찾지 못했습니다 ({step})'

    time.sleep(delay * 0.6)
    try:
        still_in = '/pro/chats/' in (driver.current_url or '').lower()
        tail = (driver.current_url or '').rstrip('/').split('/pro/chats/')[-1].split('?')[0]
        if still_in and tail.isdigit():
            return False, '나가기 후에도 채팅방 URL에 남아 있습니다.'
    except Exception:
        pass
    return True, None
