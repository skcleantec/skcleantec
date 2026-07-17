"""숨고 채팅 목록 — 미읽음·미리보기 감시 (in-page, 읽기 전용)

숨고 서버·AI 봇에 추가 요청·클릭·입력 없음. 이미 열린 채팅 목록 DOM의 innerText만 읽는다.
매크로·봇 탐지 회피: 기존 2초 주기 유지, MutationObserver는 목록 영역 passive 관찰만.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)

DEDUPE_TTL_MS = 60_000
WATCH_DEDUPE_TTL_MS = 4_000
MAX_STORE = 200
MAX_PENDING = 50
SCAN_INTERVAL_MS = 2000
WATCH_SCAN_INTERVAL_MS = 1000

_INSTALL_WATCHER_JS = """
if (!window.__soomgoBridgeChatListWatch) {
  window.__soomgoBridgeChatListWatch = {
    installed: true,
    events: [],
    lastScanAt: 0,
    scanTimer: null,
    watchChatIds: {},
    scanIntervalMs: __SCAN_MS__,
  };

  window.__soomgoBridgeSetWatchChatIds = function(ids) {
    var map = {};
    if (ids && ids.length) {
      for (var i = 0; i < ids.length; i++) map[String(ids[i])] = true;
    }
    window.__soomgoBridgeChatListWatch.watchChatIds = map;
    var ms = Object.keys(map).length ? __WATCH_SCAN_MS__ : __SCAN_MS__;
    if (window.__soomgoBridgeChatListWatch.scanTimer) {
      clearInterval(window.__soomgoBridgeChatListWatch.scanTimer);
    }
    window.__soomgoBridgeChatListWatch.scanIntervalMs = ms;
    window.__soomgoBridgeChatListWatch.scanTimer = window.setInterval(function() {
      window.__soomgoBridgeRunChatScan();
    }, ms);
    window.__soomgoBridgeRunChatScan();
  };

  window.__soomgoParseChatRow = function(rawLines, rawBlock) {
    function norm(s) { return (s || '').replace(/\\s+/g, ' ').trim(); }
    function isSkip(line) {
      var t = norm(line);
      return !t || /^\\d{1,2}$/.test(t) || /^(오전|오후)\\s*\\d{1,2}:\\d{2}$/.test(t) || /^\\d+분 전$/.test(t) || /^\\d+시간 전$/.test(t) || t === '어제' || t === '방금';
    }
    function isSmart(line) { return /스마트\\s*견적|총\\s*[\\d,]+\\s*원/.test(norm(line)); }
    function isQuoteRead(line) { return /견적.*(읽|확인)|고객님이\\s*견적|견적서를\\s*확인/.test(norm(line)); }
    function isSystem(line) { return /🏆|숨고\\s*고용|숨고패스/.test(norm(line)); }
    function fmtRegion(svc, reg) {
      return norm(svc).replace(/([가-힣a-zA-Z0-9])(이사\\/입주|입주\\/이사)/gi, '$1 $2') + ' • ' + norm(reg);
    }
    function splitHeader(line) {
      var t = norm(line);
      var m = t.match(/^([가-힣]{2,6})\\s*(이사\\/입주(?:\\s*청소업체)?|입주\\/이사(?:\\s*청소업체)?)\\s*•\\s*(.+)$/)
        || t.match(/^([가-힣]{2,6})(이사\\/입주(?:\\s*청소업체)?|입주\\/이사(?:\\s*청소업체)?)\\s*•\\s*(.+)$/);
      if (m) return { name: m[1], region: fmtRegion(m[2], m[3]) };
      return null;
    }
    var lines = [];
    for (var i = 0; i < rawLines.length; i++) {
      if (!isSkip(rawLines[i])) lines.push(norm(rawLines[i]));
    }
    var name = null, region = null, msg = null, time = null, quality = 'fallback', kind = 'unknown';
    var headerDone = false;
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      if (!headerDone) {
        var h = splitHeader(line);
        if (h) { name = h.name; region = h.region; headerDone = true; continue; }
      }
      if (isSmart(line)) continue;
      if (!headerDone && /청소업체|•|[시군구]/.test(line)) {
        region = line.replace(/([가-힣a-zA-Z0-9])(이사\\/입주|입주\\/이사)/gi, '$1 $2');
        headerDone = true;
        continue;
      }
      if (name && line === name) continue;
      if (region && line === region) continue;
      var tm = line.match(/\\s*((오전|오후)\\s*\\d{1,2}:\\d{2}|\\d+분 전|\\d+시간 전|어제|방금)\\s*$/);
      var text = tm ? line.slice(0, tm.index).trim() : line;
      if (tm && !time) time = norm(tm[1]);
      if (!text || /^\\d{1,2}$/.test(text) || isSmart(text)) continue;
      if (!msg) {
        msg = text;
        kind = isQuoteRead(text) ? 'quote_read' : (isSystem(text) ? 'system' : 'message');
        quality = headerDone ? 'full' : 'partial';
      }
    }
    if (!name && lines[0]) {
      var h0 = splitHeader(lines[0]);
      if (h0) { name = h0.name; region = region || h0.region; }
    }
    if (msg && region && msg === region) msg = null;
    if (!msg && rawBlock) {
      var body = norm(rawBlock).replace(/\\s*총\\s*[\\d,]+\\s*원.*스마트\\s*견적\\s*$/i, '');
      if (name && body.indexOf(name) === 0) body = body.slice(name.length).trim();
      if (region && body.indexOf(region) >= 0) body = body.replace(region, '').trim();
      if (body && !isSmart(body)) { msg = body; quality = 'fallback'; kind = 'message'; }
    }
    if (!time && rawBlock) {
      var tm2 = rawBlock.match(/(오전|오후)\\s*\\d{1,2}:\\d{2}|\\d+분 전|\\d+시간 전|어제|방금/);
      if (tm2) time = norm(tm2[0]);
    }
    if (kind === 'unknown' && msg) kind = 'message';
    return { customerName: name, serviceRegion: region, messagePreview: msg, parseQuality: quality, previewKind: kind, listTimeLabel: time };
  };

  window.__soomgoBridgeScanChatRows = function() {
    var out = [];
    var seen = {};
    var anchors = document.querySelectorAll('a[href*="/pro/chats/"]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = (a.getAttribute('href') || '').toLowerCase();
      var m = href.match(/\\/pro\\/chats\\/(\\d+)/);
      if (!m) continue;
      var chatId = m[1];
      if (seen[chatId]) continue;
      seen[chatId] = true;

      var row = a;
      for (var up = 0; up < 12 && row; up++) {
        var tag = (row.tagName || '').toLowerCase();
        if (tag === 'li' || tag === 'article' || row.getAttribute('role') === 'listitem') break;
        var r = row.getBoundingClientRect ? row.getBoundingClientRect() : null;
        if (r && r.height >= 48 && r.width >= 160) break;
        row = row.parentElement;
      }
      if (!row) row = a;

      var clone = row.cloneNode(true);
      var badgeNodesPre = clone.querySelectorAll('span, div, p, strong');
      for (var bp = 0; bp < badgeNodesPre.length; bp++) {
        var bel = badgeNodesPre[bp];
        var btxt = (bel.textContent || '').trim();
        if (!/^\\d{1,2}$/.test(btxt)) continue;
        var brect = bel.getBoundingClientRect ? bel.getBoundingClientRect() : null;
        var rrect = row.getBoundingClientRect ? row.getBoundingClientRect() : null;
        if (!brect || !rrect) continue;
        if (brect.width < 14 || brect.width > 44 || brect.height < 14 || brect.height > 44) continue;
        if (brect.left < rrect.left + rrect.width * 0.45) continue;
        bel.remove();
      }

      var rawBlock = (clone.innerText || clone.textContent || row.innerText || row.textContent || '');
      var rawLines = rawBlock.split(/\\n+/).map(function(s) {
        return s.replace(/\\s+/g, ' ').trim();
      }).filter(Boolean);

      if (rawLines.length <= 1 && rawBlock) {
        var sqSplit = rawBlock.replace(/\\s+/g, ' ').trim().match(/^(.+?)\\s*(총\\s*[\\d,]+\\s*원\\s*부터\\s*•?\\s*스마트\\s*견적)\\s*$/i);
        if (sqSplit) {
          rawLines = [sqSplit[1].trim(), sqSplit[2].trim()];
        }
      }

      var parsed = window.__soomgoParseChatRow(rawLines, rawBlock);

      var unreadCount = 0;
      var badgeNodes = row.querySelectorAll('span, div, p, strong');
      var rowRect = row.getBoundingClientRect ? row.getBoundingClientRect() : null;
      for (var b = 0; b < badgeNodes.length; b++) {
        var bt = (badgeNodes[b].textContent || '').trim();
        if (!/^\\d{1,2}$/.test(bt)) continue;
        var br = badgeNodes[b].getBoundingClientRect ? badgeNodes[b].getBoundingClientRect() : null;
        if (!br || br.width < 14 || br.width > 44 || br.height < 14 || br.height > 44) continue;
        if (rowRect && br.left < rowRect.left + rowRect.width * 0.45) continue;
        var n = parseInt(bt, 10);
        if (n > unreadCount) unreadCount = n;
      }

      var messagePreview = parsed.messagePreview || '';
      var previewText = messagePreview || '(채팅 미리보기)';
      var previewKind = parsed.previewKind || 'unknown';
      if (previewKind === 'unknown' && /스마트\\s*견적|총\\s*[\\d,]+\\s*원/.test(previewText)) previewKind = 'smart_quote';

      out.push({
        chatId: chatId,
        customerName: parsed.customerName,
        serviceRegion: parsed.serviceRegion,
        previewText: previewText.slice(0, 500),
        messagePreview: messagePreview ? messagePreview.slice(0, 500) : null,
        parseQuality: parsed.parseQuality || 'fallback',
        previewKind: previewKind,
        unreadCount: unreadCount,
        listTimeLabel: parsed.listTimeLabel,
        capturedAt: Date.now(),
      });
    }
    return out;
  };

  window.__soomgoBridgePushChatEvents = function(rows) {
    if (!rows || !rows.length) return;
    var watchMap = window.__soomgoBridgeChatListWatch.watchChatIds || {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r.chatId) continue;
      var watched = !!watchMap[String(r.chatId)];
      if ((r.unreadCount || 0) < 1 && r.previewKind !== 'quote_read' && !watched) continue;
      if (r.previewKind === 'smart_quote' && !watched) continue;
      window.__soomgoBridgeChatListWatch.events.push(r);
      if (window.__soomgoBridgeChatListWatch.events.length > 80) {
        window.__soomgoBridgeChatListWatch.events.shift();
      }
    }
  };

  window.__soomgoBridgeRunChatScan = function() {
    try {
      var rows = window.__soomgoBridgeScanChatRows();
      window.__soomgoBridgePushChatEvents(rows);
      window.__soomgoBridgeChatListWatch.lastScanAt = Date.now();
    } catch (e) {}
  };

  window.__soomgoBridgeDrainChatEvents = function() {
    var q = window.__soomgoBridgeChatListWatch.events.slice();
    window.__soomgoBridgeChatListWatch.events = [];
    return q;
  };

  var root = document.body;
  if (root && window.MutationObserver) {
    var mo = new MutationObserver(function() {
      window.__soomgoBridgeRunChatScan();
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true });
  }

  window.__soomgoBridgeChatListWatch.scanTimer = window.setInterval(function() {
    window.__soomgoBridgeRunChatScan();
  }, __SCAN_MS__);

  window.__soomgoBridgeRunChatScan();
}
return true;
""".replace('__SCAN_MS__', str(SCAN_INTERVAL_MS)).replace('__WATCH_SCAN_MS__', str(WATCH_SCAN_INTERVAL_MS))

_SET_WATCH_JS = """
if (window.__soomgoBridgeSetWatchChatIds) {
  window.__soomgoBridgeSetWatchChatIds(arguments[0] || []);
}
return true;
"""

_POLL_INSTALLED_JS = """
return !!(window.__soomgoBridgeChatListWatch && window.__soomgoBridgeChatListWatch.installed);
"""

_DRAIN_JS = """
if (!window.__soomgoBridgeDrainChatEvents) return [];
return window.__soomgoBridgeDrainChatEvents();
"""

_SNAPSHOT_JS = """
if (window.__soomgoBridgeScanChatRows) {
  return window.__soomgoBridgeScanChatRows();
}
return [];
"""


class ChatListWatcher:
    def __init__(self) -> None:
        self._watcher_installed = False
        self._store: list[dict[str, Any]] = []
        self._pending: list[dict[str, Any]] = []
        self._dedupe: dict[str, int] = {}
        self._watch_chat_ids: set[str] = set()
        self._last_preview_by_chat: dict[str, str] = {}
        self._last_snapshot: list[dict[str, Any]] = []

    @property
    def watcher_installed(self) -> bool:
        return self._watcher_installed

    def watch_chat_ids(self) -> list[str]:
        return sorted(self._watch_chat_ids)

    def poll_interval_sec(self) -> float:
        return 1.0 if self._watch_chat_ids else 2.0

    def set_watch_chat_ids(self, driver, ids: list[str]) -> None:
        cleaned = {str(i).strip() for i in ids if str(i).strip().isdigit()}
        self._watch_chat_ids = cleaned
        if not self._watcher_installed:
            return
        try:
            driver.execute_script(_SET_WATCH_JS, list(cleaned))
        except Exception as e:
            logger.debug('set watch chat ids: %s', e)

    def install(self, driver) -> bool:
        try:
            driver.execute_script(_INSTALL_WATCHER_JS)
            self._watcher_installed = True
            if self._watch_chat_ids:
                driver.execute_script(_SET_WATCH_JS, list(self._watch_chat_ids))
            return True
        except Exception as e:
            logger.debug('chat list watcher install: %s', e)
            self._watcher_installed = False
            return False

    def ensure_installed(self, driver) -> bool:
        try:
            ok = driver.execute_script(_POLL_INSTALLED_JS)
            if ok:
                self._watcher_installed = True
                if self._watch_chat_ids:
                    driver.execute_script(_SET_WATCH_JS, list(self._watch_chat_ids))
                return True
        except Exception:
            pass
        return self.install(driver)

    def _dedupe_key(self, row: dict[str, Any]) -> str:
        chat_id = str(row.get('chatId') or '')
        preview = str(row.get('previewText') or '').strip()
        unread = int(row.get('unreadCount') or 0)
        return f'{chat_id}|{preview}|{unread}'

    def _should_emit(self, row: dict[str, Any]) -> bool:
        chat_id = str(row.get('chatId') or '')
        preview = str(row.get('previewText') or '').strip()
        unread = int(row.get('unreadCount') or 0)
        kind = str(row.get('previewKind') or '')
        watched = chat_id in self._watch_chat_ids
        now = int(row.get('capturedAt') or time.time() * 1000)

        if watched:
            prev_preview = self._last_preview_by_chat.get(chat_id)
            if prev_preview != preview:
                self._last_preview_by_chat[chat_id] = preview
                ttl = WATCH_DEDUPE_TTL_MS
                key = f'watch|{chat_id}|{preview}'
                prev = self._dedupe.get(key)
                if prev and now - prev < ttl:
                    return False
                self._dedupe[key] = now
                return True
            if unread >= 1:
                pass
            elif kind == 'quote_read':
                pass
            else:
                return False
        elif unread < 1 and kind != 'quote_read':
            return False
        if kind == 'smart_quote' and not watched:
            return False

        key = self._dedupe_key(row)
        ttl = WATCH_DEDUPE_TTL_MS if watched else DEDUPE_TTL_MS
        prev = self._dedupe.get(key)
        if prev and now - prev < ttl:
            return False
        self._dedupe[key] = now
        if preview:
            self._last_preview_by_chat[chat_id] = preview
        return True

    def _normalize_row(self, row: dict[str, Any]) -> dict[str, Any]:
        captured = int(row.get('capturedAt') or time.time() * 1000)
        chat_id = str(row.get('chatId') or '')
        return {
            'id': str(uuid.uuid4()),
            'chatId': chat_id,
            'customerName': (row.get('customerName') or None),
            'serviceRegion': (row.get('serviceRegion') or None),
            'previewText': str(row.get('previewText') or '').strip() or '(내용 없음)',
            'messagePreview': (str(row.get('messagePreview') or '').strip() or None),
            'parseQuality': row.get('parseQuality') or 'fallback',
            'previewKind': row.get('previewKind') or 'unknown',
            'unreadCount': int(row.get('unreadCount') or 0),
            'listTimeLabel': row.get('listTimeLabel') or None,
            'capturedAt': captured,
        }

    def _normalize_snapshot_row(self, row: dict[str, Any]) -> dict[str, Any]:
        captured = int(row.get('capturedAt') or time.time() * 1000)
        chat_id = str(row.get('chatId') or '')
        return {
            'chatId': chat_id,
            'customerName': (row.get('customerName') or None),
            'serviceRegion': (row.get('serviceRegion') or None),
            'previewText': str(row.get('previewText') or '').strip() or '(내용 없음)',
            'messagePreview': (str(row.get('messagePreview') or '').strip() or None),
            'parseQuality': row.get('parseQuality') or 'fallback',
            'previewKind': row.get('previewKind') or 'unknown',
            'unreadCount': int(row.get('unreadCount') or 0),
            'listTimeLabel': row.get('listTimeLabel') or None,
            'capturedAt': captured,
        }

    def list_snapshot(self, driver) -> list[dict[str, Any]]:
        if not self._watcher_installed:
            return list(self._last_snapshot)
        try:
            raw = driver.execute_script(_SNAPSHOT_JS)
        except Exception as e:
            logger.debug('chat list snapshot: %s', e)
            return list(self._last_snapshot)
        if not isinstance(raw, list):
            return list(self._last_snapshot)
        rows = [
            self._normalize_snapshot_row(item)
            for item in raw
            if isinstance(item, dict) and str(item.get('chatId') or '').strip()
        ]
        self._last_snapshot = rows
        return rows

    def poll_events(self, driver) -> list[dict[str, Any]]:
        if not self._watcher_installed:
            return []
        try:
            raw = driver.execute_script(_DRAIN_JS)
        except Exception as e:
            logger.debug('chat list drain: %s', e)
            return []
        if not isinstance(raw, list):
            return []
        emitted: list[dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            if not self._should_emit(item):
                continue
            alert = self._normalize_row(item)
            emitted.append(alert)
            self._store.append(alert)
            self._pending.append(alert)
        if len(self._store) > MAX_STORE:
            self._store = self._store[-MAX_STORE:]
        if len(self._pending) > MAX_PENDING:
            self._pending = self._pending[-MAX_PENDING:]
        return emitted

    def pending_alerts(self) -> list[dict[str, Any]]:
        return list(self._pending)

    def all_alerts(self) -> list[dict[str, Any]]:
        return list(reversed(self._store[-MAX_STORE:]))

    def ack_ids(self, ids: list[str]) -> int:
        if not ids:
            return 0
        id_set = {str(i) for i in ids}
        before = len(self._pending)
        self._pending = [a for a in self._pending if a.get('id') not in id_set]
        return before - len(self._pending)

    def ack_before(self, captured_at: int) -> int:
        before = len(self._pending)
        self._pending = [a for a in self._pending if int(a.get('capturedAt') or 0) >= captured_at]
        return before - len(self._pending)
