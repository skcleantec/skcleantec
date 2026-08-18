"""채팅방 — 시스템 안내 아래 첫 날짜 구분선(개설일) 추출."""
from __future__ import annotations

import logging
import re
import time
from datetime import date
from typing import Any

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

logger = logging.getLogger(__name__)

# 입장 시 하단에 있다가 최상단으로 올려야 li#message-chat-date-YYYY-MM-DD 가 DOM 에 나타남
_SCROLL_CHAT_TO_TOP_JS = r"""
return (function(maxSteps, stepPx) {
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') >= 0.05;
  }
  function hasDateMarker() {
    return !!document.querySelector(
      'li[id^="message-chat-date-"], [id^="message-chat-date-"], li[class*="message-chat-date-"]'
    );
  }
  function isScrollable(el) {
    if (!el) return false;
    var st = window.getComputedStyle(el);
    var oy = st.overflowY;
    return (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      el.scrollHeight > el.clientHeight + 4;
  }
  function findScroller() {
    var selectors = [
      '.chat-messages-container',
      'section.chatbody-section .chat-messages',
      '.chatbody-section',
      '.chat-messages'
    ];
    for (var s = 0; s < selectors.length; s++) {
      var nodes = document.querySelectorAll(selectors[s]);
      for (var n = 0; n < nodes.length; n++) {
        if (isScrollable(nodes[n])) return nodes[n];
      }
    }
    var input = document.querySelector('textarea, [contenteditable="true"]');
    var el = input;
    for (var i = 0; i < 16 && el; i++) {
      el = el.parentElement;
      if (!el) break;
      if (isScrollable(el)) return el;
    }
    return null;
  }
  function nudgeTop(scroller) {
    if (scroller) {
      try { scroller.scrollTop = 0; } catch (e) {}
      try {
        scroller.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -(stepPx || 700),
          bubbles: true,
          cancelable: true
        }));
      } catch (e2) {}
      try { scroller.scrollBy(0, -(stepPx || 700)); } catch (e3) {}
    }
    var ul = document.querySelector(
      '.chat-messages-container ul, section.chatbody-section ul, .chat-messages ul'
    );
    if (ul) {
      var first = ul.querySelector(':scope > li');
      if (first) {
        try { first.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (e4) {}
      }
    }
    window.scrollTo(0, 0);
  }

  if (hasDateMarker()) {
    return { ok: true, found: true, steps: 0, mode: 'already-visible' };
  }

  var scroller = findScroller();
  var steps = 0;
  for (var i = 0; i < (maxSteps || 24); i++) {
    steps = i + 1;
    nudgeTop(scroller);
    if (hasDateMarker()) {
      return { ok: true, found: true, steps: steps, mode: 'scroll-top' };
    }
    if (scroller) {
      var prev = scroller.scrollTop;
      scroller.scrollTop = Math.max(0, scroller.scrollTop - (stepPx || 700));
      if (hasDateMarker()) {
        return { ok: true, found: true, steps: steps, mode: 'scroll-up' };
      }
      if (scroller.scrollTop <= 0 && prev <= 0 && i >= 4) break;
    }
  }
  return { ok: true, found: hasDateMarker(), steps: steps, mode: 'exhausted' };
})(arguments[0], arguments[1]);
"""

_READ_OPENED_DATE_JS = r"""
return (function() {
  function norm(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  function isoFromToken(token) {
    var m = String(token || '').match(/message-chat-date-(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  var out = [];
  var nodes = document.querySelectorAll(
    'li[id^="message-chat-date-"], [id^="message-chat-date-"], li[class*="message-chat-date-"]'
  );
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var iso = isoFromToken(n.id) || isoFromToken(n.className);
    var dateEl = n.querySelector('.date') || n;
    var label = norm(dateEl.textContent || n.textContent || '');
    out.push({ iso: iso, label: label, source: 'message-chat-date' });
  }
  if (out.length) return { ok: true, items: out };
  var ul = document.querySelector('.chat-messages-container ul, .chat-messages ul, section.chatbody-section ul');
  if (ul) {
    var lis = ul.querySelectorAll(':scope > li');
    for (var u = 0; u < lis.length; u++) {
      var li = lis[u];
      var iso2 = isoFromToken(li.id) || isoFromToken(li.className);
      if (!iso2) continue;
      var dateEl2 = li.querySelector('.date') || li;
      out.push({ iso: iso2, label: norm(dateEl2.textContent || ''), source: 'chat-ul' });
    }
  }
  if (out.length) return { ok: true, items: out };
  return { ok: false, error: 'chat_date_not_found', items: [] };
})();
"""

_ISO_YMD = re.compile(r'^(\d{4})-(\d{2})-(\d{2})$')
_KR_YMD = re.compile(r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일')
_KR_MD = re.compile(r'^(\d{1,2})\s*월\s*(\d{1,2})\s*일')


def _year_hint(today: date, month: int, day: int) -> int:
    y = today.year
    try:
        candidate = date(y, month, day)
    except ValueError:
        return y
    if candidate > today + __import__('datetime').timedelta(days=60):
        return y - 1
    return y


def parse_chat_date_label(label: str, *, today: date) -> date | None:
    text = (label or '').strip()
    if not text:
        return None
    if text == '오늘':
        return today
    if text == '어제':
        return today - __import__('datetime').timedelta(days=1)
    m = _ISO_YMD.match(text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    m = _KR_YMD.search(text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    m = _KR_MD.match(text)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        y = _year_hint(today, mo, d)
        try:
            return date(y, mo, d)
        except ValueError:
            return None
    return None


def _parse_extract_item(item: dict[str, Any], *, today: date) -> date | None:
    iso = item.get('iso')
    if isinstance(iso, str) and iso.strip():
        m = _ISO_YMD.match(iso.strip())
        if m:
            try:
                return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except ValueError:
                pass
    label = item.get('label')
    if isinstance(label, str):
        return parse_chat_date_label(label, today=today)
    return None


def scroll_chat_room_to_top(driver, *, max_steps: int = 24, step_px: int = 700) -> bool:
    """채팅방 메시지 영역 최상단까지 스크롤 (개설일 구분선 노출)."""
    try:
        raw = driver.execute_script(_SCROLL_CHAT_TO_TOP_JS, max_steps, step_px) or {}
        found = bool(raw.get('found'))
        logger.debug(
            'scroll_chat_room_to_top found=%s steps=%s mode=%s',
            found,
            raw.get('steps'),
            raw.get('mode'),
        )
        return found
    except Exception as e:
        logger.warning('scroll_chat_room_to_top: %s', e)
        return False


def extract_chat_room_opened_at(driver, *, today: date | None = None) -> date | None:
    """채팅방 맨 위(시스템 안내 직후) 첫 날짜 구분선."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    kst_today = today or datetime.now(ZoneInfo('Asia/Seoul')).date()

    try:
        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located((
                By.CSS_SELECTOR,
                'textarea, [contenteditable="true"], .chat-messages, .chat-messages-container',
            ))
        )
    except TimeoutException:
        pass

    for attempt in range(5):
        if attempt:
            time.sleep(0.25 + attempt * 0.12)
        scroll_chat_room_to_top(driver, max_steps=24 + attempt * 4, step_px=700)
        time.sleep(0.35 + attempt * 0.1)

        try:
            raw: dict[str, Any] = driver.execute_script(_READ_OPENED_DATE_JS) or {}
        except Exception as e:
            logger.warning('extract_chat_room_opened_at read js (attempt %s): %s', attempt + 1, e)
            continue

        if not raw.get('ok'):
            continue

        items = raw.get('items') or []
        for item in items:
            if not isinstance(item, dict):
                continue
            parsed = _parse_extract_item(item, today=kst_today)
            if parsed:
                logger.debug(
                    'extract_chat_room_opened_at ok date=%s source=%s attempt=%s',
                    parsed.isoformat(),
                    item.get('source'),
                    attempt + 1,
                )
                return parsed

    return None
