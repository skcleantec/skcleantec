"""숨고 채팅 목록 — 닉네임으로 채팅방 찾기·입장"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from automation.chat_list_watcher import _INSTALL_WATCHER_JS, _SNAPSHOT_JS
from automation.navigation import ensure_chat_workspace, open_chat_room_by_id
from automation.selectors import SOOMGO_DISPLAY_NAME_JS

logger = logging.getLogger(__name__)

_MAX_SCROLL_ROUNDS = 14
_SCROLL_AMOUNT = 480
_SEARCH_RESULT_ROUNDS = 6

_FILL_SEARCH_JS = """
function setNativeInputValue(el, value) {
  var proto = window.HTMLInputElement.prototype;
  var desc = Object.getOwnPropertyDescriptor(proto, 'value');
  var setter = desc && desc.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function fillChatListSearch(query) {
  var q = (query || '').trim();
  if (!q) return { ok: false, reason: 'empty' };
  var selectors = [
    'input[type="search"]',
    'input[placeholder*="채팅"]',
    'input[placeholder*="검색"]',
    'input[aria-label*="채팅"]',
    'input[aria-label*="검색"]',
    'input[name*="search" i]'
  ];
  var seen = {};
  var inputs = [];
  for (var si = 0; si < selectors.length; si++) {
    var nodes = document.querySelectorAll(selectors[si]);
    for (var ni = 0; ni < nodes.length; ni++) {
      var node = nodes[ni];
      if (!node || seen[node]) continue;
      seen[node] = true;
      inputs.push(node);
    }
  }
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    if (!el.offsetParent && el.getAttribute('type') !== 'search') continue;
    var ph = (el.getAttribute('placeholder') || '') + (el.getAttribute('aria-label') || '');
    if (/메시지/.test(ph) && !/채팅|고객|닉|이름|목록/.test(ph)) continue;
    try { el.focus(); } catch (e) {}
    setNativeInputValue(el, q);
    try {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    } catch (e2) {}
    return { ok: true, method: 'input', placeholder: ph.slice(0, 80) };
  }
  return { ok: false, reason: 'no_input' };
}
return fillChatListSearch(arguments[0]);
"""

_FIND_IN_ROWS_JS = (
    SOOMGO_DISPLAY_NAME_JS
    + """
function normNick(s) {
  if (!s) return '';
  s = normalizeSoomgoDisplayNameLine(String(s)).replace(/^내\\s*고용\\s*/i, '').trim().toLowerCase();
  return s;
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
    return normalizeSoomgoDisplayNameLine(x);
  }).filter(Boolean);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^내\\s*고용\\s*/i, '').trim();
    if (isSoomgoDisplayName(line)) return line;
    if (line.length >= 2 && line.length <= 16 && /[\\uAC00-\\uD7A3A-Za-z]/.test(line)) return line;
  }
  return lines[0] || '';
}
function findNickInDom(target) {
  var want = normNick(target);
  if (!want) return { ok: false, reason: 'empty_target' };
  var anchors = document.querySelectorAll('a[href*="/pro/chats/"]');
  var exact = null, partial = null;
  for (var i = 0; i < anchors.length; i++) {
    var href = (anchors[i].getAttribute('href') || '').toLowerCase();
    var m = href.match(/\\/pro\\/chats\\/(\\d+)/);
    if (!m) continue;
    var chatId = m[1];
    var name = rowNameFromAnchor(anchors[i]);
    var nn = normNick(name);
    if (!nn) continue;
    if (nn === want) {
      exact = { chatId: chatId, nickname: name, match: 'exact' };
      break;
    }
    if (!partial && (nn.indexOf(want) >= 0 || want.indexOf(nn) >= 0)) {
      partial = { chatId: chatId, nickname: name, match: 'partial' };
    }
  }
  var hit = exact || partial;
  if (!hit) return { ok: false, reason: 'not_found' };
  return { ok: true, chatId: hit.chatId, nickname: hit.nickname, match: hit.match };
}
return findNickInDom(arguments[0]);
"""
)

_SCROLL_LIST_JS = """
(function() {
  var amount = arguments[0] || 480;
  var candidates = [
    document.querySelector('main'),
    document.querySelector('ul[class*="css-"]'),
    document.scrollingElement,
    document.documentElement
  ];
  for (var i = 0; i < candidates.length; i++) {
    var el = candidates[i];
    if (!el) continue;
    var before = el.scrollTop;
    el.scrollTop = before + amount;
    if (el.scrollTop > before) return { moved: true, top: el.scrollTop };
  }
  try {
    window.scrollBy(0, amount);
    return { moved: true, via: 'window' };
  } catch (e) {}
  return { moved: false };
})()
"""


def _normalize_nickname(nickname: str) -> str:
    s = re.sub(r'\s+', ' ', nickname.strip())
    s = re.sub(r'^내\s*고용\s*', '', s, flags=re.I)
    return s.lower()


def _find_in_snapshot(driver, nickname: str) -> dict[str, Any] | None:
    try:
        rows = driver.execute_script(_SNAPSHOT_JS) or []
    except Exception:
        return None
    want = _normalize_nickname(nickname)
    exact: dict[str, Any] | None = None
    partial: dict[str, Any] | None = None
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get('customerName') or '').strip()
        if not name:
            continue
        nn = _normalize_nickname(name)
        chat_id = str(row.get('chatId') or '').strip()
        if not chat_id.isdigit():
            continue
        if nn == want:
            exact = {'chatId': chat_id, 'nickname': name, 'match': 'exact'}
            break
        if not partial and (want in nn or nn in want):
            partial = {'chatId': chat_id, 'nickname': name, 'match': 'partial'}
    return exact or partial


def _find_hit(driver, query: str) -> dict[str, Any] | None:
    hit = _find_in_snapshot(driver, query)
    if hit:
        return hit
    try:
        dom_hit = driver.execute_script(_FIND_IN_ROWS_JS, query)
        if isinstance(dom_hit, dict) and dom_hit.get('ok'):
            return dom_hit
    except Exception as e:
        logger.debug('find nick in dom: %s', e)
    return None


def find_chat_by_nickname(driver, nickname: str, delay: float = 1.0) -> dict[str, Any]:
    query = (nickname or '').strip()
    if len(query) < 2:
        return {'ok': False, 'error': '닉네임이 너무 짧습니다.'}

    if not ensure_chat_workspace(driver, delay=delay, force_list=True):
        return {'ok': False, 'error': '숨고 채팅 목록으로 이동하지 못했습니다.'}

    time.sleep(delay * 0.4)

    try:
        driver.execute_script(_INSTALL_WATCHER_JS)
    except Exception:
        pass

    search_used = False
    try:
        search_res = driver.execute_script(_FILL_SEARCH_JS, query)
        if isinstance(search_res, dict) and search_res.get('ok'):
            search_used = True
            logger.info('chat list search filled query=%s via=%s', query, search_res.get('method'))
            time.sleep(delay * 1.1)
    except Exception as e:
        logger.debug('chat list search fill: %s', e)

    if search_used:
        for round_i in range(_SEARCH_RESULT_ROUNDS):
            hit = _find_hit(driver, query)
            if hit:
                chat_id = str(hit.get('chatId') or '')
                if chat_id.isdigit():
                    return {
                        'ok': True,
                        'chatId': chat_id,
                        'nickname': hit.get('nickname'),
                        'match': hit.get('match', 'exact'),
                        'searchUsed': True,
                        'scrollRounds': 0,
                    }
            if round_i + 1 < _SEARCH_RESULT_ROUNDS:
                time.sleep(delay * 0.45)
        return {
            'ok': False,
            'error': f'검색창으로 「{query}」을(를) 찾지 못했습니다. 닉네임·검색어를 확인해 주세요.',
            'searchUsed': True,
        }

    for round_i in range(_MAX_SCROLL_ROUNDS + 1):
        hit = _find_hit(driver, query)
        if hit:
            chat_id = str(hit.get('chatId') or '')
            if chat_id.isdigit():
                return {
                    'ok': True,
                    'chatId': chat_id,
                    'nickname': hit.get('nickname'),
                    'match': hit.get('match', 'exact'),
                    'searchUsed': False,
                    'scrollRounds': round_i,
                }

        if round_i >= _MAX_SCROLL_ROUNDS:
            break

        try:
            moved = driver.execute_script(_SCROLL_LIST_JS, _SCROLL_AMOUNT)
            if isinstance(moved, dict) and not moved.get('moved'):
                break
        except Exception:
            break
        time.sleep(delay * 0.35)

    return {'ok': False, 'error': f'숨고 채팅 목록에서 「{query}」을(를) 찾지 못했습니다.'}


def open_chat_room_by_nickname(driver, nickname: str, delay: float = 1.0) -> dict[str, Any]:
    found = find_chat_by_nickname(driver, nickname, delay=delay)
    if not found.get('ok'):
        return found
    chat_id = str(found['chatId'])
    if not open_chat_room_by_id(driver, chat_id, delay=delay):
        return {'ok': False, 'error': '채팅방을 열지 못했습니다.', 'chatId': chat_id}
    return {
        'ok': True,
        'chatId': chat_id,
        'nickname': found.get('nickname') or nickname,
        'match': found.get('match'),
        'searchUsed': found.get('searchUsed'),
    }
