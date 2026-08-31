"""채팅방 — 맨 위 스크롤 시 첫 날짜 구분선(개설일) 추출."""
from __future__ import annotations

import logging
import re
from datetime import date
from typing import Any

logger = logging.getLogger(__name__)

_EXTRACT_OPENED_AT_JS = r"""
(function(maxSteps, stepPx) {
  function norm(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  function findInput() {
    var inputs = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (!el.offsetParent && el.getAttribute('contenteditable') !== 'true') continue;
      var ph = (el.getAttribute('placeholder') || '') + (el.getAttribute('aria-label') || '');
      if (/메시지|입력|채팅/.test(ph) || el.tagName === 'TEXTAREA') return el;
    }
    return null;
  }
  function findScrollRoot(input) {
    var n = input;
    for (var i = 0; i < 14 && n; i++) {
      n = n.parentElement;
      if (!n) break;
      var st = window.getComputedStyle(n);
      var oy = st.overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && n.scrollHeight > n.clientHeight + 8) {
        return n;
      }
    }
    return null;
  }
  function isDateLabel(t) {
    if (!t) return false;
    if (/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(t)) return true;
    if (/^\d{1,2}월\s*\d{1,2}일/.test(t)) return true;
    if (/^(오늘|어제)$/.test(t)) return true;
    return false;
  }
  function collectDates(root) {
    var out = [];
    if (!root) return out;
    var nodes = root.querySelectorAll('li, div, span, p, time, h2, h3, h4, strong');
    for (var i = 0; i < nodes.length; i++) {
      var t = norm(nodes[i].textContent || '');
      if (!isDateLabel(t)) continue;
      if (t.length > 40) continue;
      out.push(t);
    }
    return out;
  }
  var input = findInput();
  if (!input) return { ok: false, error: 'message_input_not_found', labels: [] };
  var scroller = findScrollRoot(input);
  if (scroller) scroller.scrollTop = 0;
  var labels = collectDates(scroller || document.body);
  var steps = 0;
  for (var s = 0; s < (maxSteps || 12); s++) {
    steps = s + 1;
    if (!scroller) break;
    var prevTop = scroller.scrollTop;
    scroller.scrollTop = Math.max(0, scroller.scrollTop - (stepPx || 400));
    var batch = collectDates(scroller);
    for (var b = 0; b < batch.length; b++) {
      if (labels.indexOf(batch[b]) < 0) labels.push(batch[b]);
    }
    if (scroller.scrollTop <= 0 || scroller.scrollTop === prevTop) break;
  }
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
  return { ok: true, labels: labels, scrollSteps: steps, hasScroller: !!scroller };
})(
  arguments[0],
  arguments[1]
);
"""

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


def extract_chat_room_opened_at(driver, *, today: date | None = None) -> date | None:
    """현재 채팅방 DOM — 스크롤 최상단 근처 첫 날짜 구분선."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    kst_today = today or datetime.now(ZoneInfo('Asia/Seoul')).date()
    try:
        raw: dict[str, Any] = driver.execute_script(_EXTRACT_OPENED_AT_JS, 16, 420) or {}
    except Exception as e:
        logger.warning('extract_chat_room_opened_at js: %s', e)
        return None
    if not raw.get('ok'):
        return None
    labels = raw.get('labels') or []
    parsed: list[date] = []
    for label in labels:
        if not isinstance(label, str):
            continue
        d = parse_chat_date_label(label, today=kst_today)
        if d:
            parsed.append(d)
    if not parsed:
        return None
    return min(parsed)
