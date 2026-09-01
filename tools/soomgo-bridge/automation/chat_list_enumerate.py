"""숨고 채팅 목록 — 전체 chatId 수집 (스크롤)."""
from __future__ import annotations

import logging
import time
from typing import Any

from automation.chat_list_search import _SCROLL_LIST_JS, _SCROLL_AMOUNT
from automation.login import goto_chat_list
from automation.navigation import ensure_chat_workspace
from automation.selectors import SOOMGO_DISPLAY_NAME_JS

logger = logging.getLogger(__name__)

_ENUMERATE_JS = (
    SOOMGO_DISPLAY_NAME_JS
    + """
function normNick(s) {
  if (!s) return '';
  return normalizeSoomgoDisplayNameLine(String(s)).replace(/^내\\s*고용\\s*/i, '').trim();
}
function rowNameFromAnchor(a) {
  var row = a;
  for (var up = 0; up < 12 && row; up++) {
    var tag = (row.tagName || '').toLowerCase();
    if (tag === 'li' || tag === 'article' || row.getAttribute('role') === 'listitem') break;
    row = row.parentElement;
  }
  if (!row) row = a;
  var lines = (row.innerText || row.textContent || '').split(/\\n+/).map(function(x) {
    return normalizeSoomgoDisplayNameLine(x.replace(/\\s+/g, ' ').trim());
  }).filter(Boolean);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^내\\s*고용\\s*/i, '').trim();
    if (isSoomgoDisplayName(line)) return line;
    if (line.length >= 2 && line.length <= 16 && /[\\uAC00-\\uD7A3A-Za-z]/.test(line)) return line;
  }
  return lines[0] || '';
}
function collectVisible() {
  var out = [];
  var seen = {};
  var anchors = document.querySelectorAll('a[href*="/pro/chats/"]');
  for (var i = 0; i < anchors.length; i++) {
    var href = (anchors[i].getAttribute('href') || '').toLowerCase();
    var m = href.match(/\\/pro\\/chats\\/(\\d+)/);
    if (!m) continue;
    var chatId = m[1];
    if (seen[chatId]) continue;
    seen[chatId] = true;
    var name = rowNameFromAnchor(anchors[i]);
    var text = (anchors[i].closest('li, article, [role="listitem"]') || anchors[i]).innerText || '';
    var hiredMe = /^내\\s*고용/.test(text.replace(/\\s+/g, ' ').trim());
    var hiredOther = /다른\\s*고수\\s*고용/.test(text);
    out.push({ chatId: chatId, nickname: name || null, hiredMe: hiredMe, hiredOther: hiredOther });
  }
  return out;
}
return collectVisible();
"""
)


def enumerate_chat_list(
    driver,
    *,
    delay: float = 0.35,
    max_scroll_rounds: int = 40,
) -> list[dict[str, Any]]:
    """채팅 목록 전체 — 고유 chatId·닉네임·고용 상태."""
    if not ensure_chat_workspace(driver, delay=delay, force_list=True):
        goto_chat_list(driver, force_list=True)
        time.sleep(delay * 0.8)

    seen: dict[str, dict[str, Any]] = {}
    stagnant = 0
    for round_i in range(max_scroll_rounds + 1):
        try:
            batch = driver.execute_script(_ENUMERATE_JS) or []
        except Exception as e:
            logger.warning('enumerate batch: %s', e)
            batch = []
        added = 0
        for row in batch:
            if not isinstance(row, dict):
                continue
            cid = str(row.get('chatId') or '').strip()
            if not cid.isdigit():
                continue
            prev = seen.get(cid)
            if prev:
                if row.get('hiredMe'):
                    prev['hiredMe'] = True
                if row.get('hiredOther'):
                    prev['hiredOther'] = True
                if not prev.get('nickname') and row.get('nickname'):
                    prev['nickname'] = row.get('nickname')
                continue
            seen[cid] = {
                'chatId': cid,
                'nickname': row.get('nickname'),
                'hiredMe': bool(row.get('hiredMe')),
                'hiredOther': bool(row.get('hiredOther')),
            }
            added += 1

        if round_i >= max_scroll_rounds:
            break
        if added == 0:
            stagnant += 1
        else:
            stagnant = 0
        if stagnant >= 3:
            break
        try:
            moved = driver.execute_script(_SCROLL_LIST_JS, _SCROLL_AMOUNT)
            if isinstance(moved, dict) and not moved.get('moved'):
                break
        except Exception:
            break
        time.sleep(delay)

    return list(seen.values())
