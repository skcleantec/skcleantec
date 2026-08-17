"""숨고 채팅 목록 — 닉네임으로 채팅방 찾기·입장"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from automation.chat_address_match import pick_best_by_address
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

_FIND_ALL_IN_ROWS_JS = (
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
    return normalizeSoomgoDisplayNameLine(x.replace(/\\s+/g, ' ').trim());
  }).filter(Boolean);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^내\\s*고용\\s*/i, '').trim();
    if (isSoomgoDisplayName(line)) return line;
    if (line.length >= 2 && line.length <= 16 && /[\\uAC00-\\uD7A3A-Za-z]/.test(line)) return line;
  }
  return lines[0] || '';
}
function rowRegionFromAnchor(a) {
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
    var line = lines[i];
    if (/청소업체/.test(line) && (/[•·]/.test(line) || /[시군구읍면]/.test(line))) {
      var parts = line.split(/[•·]/);
      if (parts.length > 1) return parts[parts.length - 1].trim();
      return line;
    }
    if (/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(line) && /[시군구읍면]/.test(line)) {
      return line;
    }
  }
  return '';
}
function findAllNickInDom(target) {
  var want = normNick(target);
  if (!want) return { ok: false, reason: 'empty_target', items: [] };
  var anchors = document.querySelectorAll('a[href*="/pro/chats/"]');
  var items = [];
  var seen = {};
  for (var i = 0; i < anchors.length; i++) {
    var href = (anchors[i].getAttribute('href') || '').toLowerCase();
    var m = href.match(/\\/pro\\/chats\\/(\\d+)/);
    if (!m) continue;
    var chatId = m[1];
    if (seen[chatId]) continue;
    var name = rowNameFromAnchor(anchors[i]);
    var nn = normNick(name);
    if (!nn) continue;
    if (nn !== want && nn.indexOf(want) < 0 && want.indexOf(nn) < 0) continue;
    seen[chatId] = true;
    items.push({
      chatId: chatId,
      nickname: name,
      match: nn === want ? 'exact' : 'partial',
      serviceRegion: rowRegionFromAnchor(anchors[i]) || null
    });
  }
  return { ok: true, items: items };
}
return findAllNickInDom(arguments[0]);
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


def _find_all_in_snapshot(driver, nickname: str) -> list[dict[str, Any]]:
    try:
        rows = driver.execute_script(_SNAPSHOT_JS) or []
    except Exception:
        return []
    want = _normalize_nickname(nickname)
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get('customerName') or '').strip()
        if not name:
            continue
        nn = _normalize_nickname(name)
        if not nn:
            continue
        if nn != want and want not in nn and nn not in want:
            continue
        chat_id = str(row.get('chatId') or '').strip()
        if not chat_id.isdigit() or chat_id in seen:
            continue
        seen.add(chat_id)
        results.append(
            {
                'chatId': chat_id,
                'nickname': name,
                'match': 'exact' if nn == want else 'partial',
                'serviceRegion': row.get('serviceRegion'),
            }
        )
    return results


def _find_all_in_dom(driver, query: str) -> list[dict[str, Any]]:
    try:
        dom_hit = driver.execute_script(_FIND_ALL_IN_ROWS_JS, query)
    except Exception as e:
        logger.debug('find all nick in dom: %s', e)
        return []
    if not isinstance(dom_hit, dict) or not dom_hit.get('ok'):
        return []
    items = dom_hit.get('items')
    if not isinstance(items, list):
        return []
    out: list[dict[str, Any]] = []
    for row in items:
        if isinstance(row, dict) and row.get('chatId'):
            out.append(row)
    return out


def _find_all_hits(driver, query: str) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in _find_all_in_snapshot(driver, query) + _find_all_in_dom(driver, query):
        chat_id = str(row.get('chatId') or '').strip()
        if not chat_id.isdigit() or chat_id in seen:
            continue
        seen.add(chat_id)
        merged.append(row)
    return merged


def _resolve_candidate(
    candidates: list[dict[str, Any]],
    query: str,
    address: str | None,
) -> dict[str, Any] | None:
    if not candidates:
        return None
    picked = pick_best_by_address(candidates, address)
    if picked:
        return picked
    if len(candidates) == 1:
        return candidates[0]
    addr = (address or '').strip()
    if not addr:
        return {
            'ok': False,
            'error': (
                f'「{query}」 동명이인 채팅방이 {len(candidates)}건입니다. '
                '부재·보류에 주소를 저장한 뒤 다시 시도해 주세요.'
            ),
            'candidateCount': len(candidates),
        }
    return {
        'ok': False,
        'error': (
            f'「{query}」 이름은 {len(candidates)}건 찾았지만, '
            '저장된 주소와 일치하는 채팅방을 찾지 못했습니다. 주소를 확인해 주세요.'
        ),
        'candidateCount': len(candidates),
    }


def _find_hit(driver, query: str, address: str | None = None) -> dict[str, Any] | None:
    candidates = _find_all_hits(driver, query)
    resolved = _resolve_candidate(candidates, query, address)
    if not resolved:
        return None
    if resolved.get('ok') is False:
        return resolved
    return {
        'ok': True,
        'chatId': resolved.get('chatId'),
        'nickname': resolved.get('nickname'),
        'match': resolved.get('match', 'exact'),
        'serviceRegion': resolved.get('serviceRegion'),
        'addressMatch': bool((address or '').strip() and len(candidates) > 1),
    }


def find_chat_by_nickname(
    driver,
    nickname: str,
    delay: float = 1.0,
    address: str | None = None,
) -> dict[str, Any]:
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
            hit = _find_hit(driver, query, address)
            if hit:
                if hit.get('ok') is False:
                    return hit
                chat_id = str(hit.get('chatId') or '')
                if chat_id.isdigit():
                    return {
                        'ok': True,
                        'chatId': chat_id,
                        'nickname': hit.get('nickname'),
                        'match': hit.get('match', 'exact'),
                        'searchUsed': True,
                        'scrollRounds': 0,
                        'addressMatch': hit.get('addressMatch'),
                    }
            if round_i + 1 < _SEARCH_RESULT_ROUNDS:
                time.sleep(delay * 0.45)
        return {
            'ok': False,
            'error': f'검색창으로 「{query}」을(를) 찾지 못했습니다. 닉네임·검색어를 확인해 주세요.',
            'searchUsed': True,
        }

    for round_i in range(_MAX_SCROLL_ROUNDS + 1):
        hit = _find_hit(driver, query, address)
        if hit:
            if hit.get('ok') is False:
                return hit
            chat_id = str(hit.get('chatId') or '')
            if chat_id.isdigit():
                return {
                    'ok': True,
                    'chatId': chat_id,
                    'nickname': hit.get('nickname'),
                    'match': hit.get('match', 'exact'),
                    'searchUsed': False,
                    'scrollRounds': round_i,
                    'addressMatch': hit.get('addressMatch'),
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


def open_chat_room_by_nickname(
    driver,
    nickname: str,
    delay: float = 1.0,
    address: str | None = None,
) -> dict[str, Any]:
    found = find_chat_by_nickname(driver, nickname, delay=delay, address=address)
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

