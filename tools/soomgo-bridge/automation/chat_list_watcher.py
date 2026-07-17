"""숨고 채팅 목록 — 미읽음·미리보기 메시지 감시 (in-page, 네트워크 추가 없음)"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)

DEDUPE_TTL_MS = 60_000
MAX_STORE = 200
MAX_PENDING = 50

_INSTALL_WATCHER_JS = """
if (!window.__soomgoBridgeChatListWatch) {
  window.__soomgoBridgeChatListWatch = {
    installed: true,
    events: [],
    lastScanAt: 0,
    scanTimer: null,
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
      for (var up = 0; up < 10 && row; up++) {
        var tag = (row.tagName || '').toLowerCase();
        if (tag === 'li' || tag === 'article' || row.getAttribute('role') === 'listitem') break;
        var r = row.getBoundingClientRect ? row.getBoundingClientRect() : null;
        if (r && r.height >= 52 && r.width >= 180) break;
        row = row.parentElement;
      }
      if (!row) row = a;

      var raw = (row.innerText || row.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!raw) continue;

      var lines = raw.split(/ (?=\\d+분 전|\\d+시간 전|어제|방금|\\d+:\\d+)/).map(function(s) {
        return s.trim();
      }).filter(Boolean);

      var customerName = (a.textContent || '').replace(/\\s+/g, ' ').trim().split(' ')[0] || null;
      if (!customerName || customerName.length > 40) {
        customerName = lines[0] ? lines[0].slice(0, 40) : null;
      }

      var previewText = raw;
      if (lines.length >= 2) {
        previewText = lines.slice(1).join(' ').replace(/\\b\\d+\\b$/, '').trim() || lines[1] || raw;
      }

      var unreadCount = 0;
      var badgeNodes = row.querySelectorAll('span, div, p, strong');
      for (var b = 0; b < badgeNodes.length; b++) {
        var bt = (badgeNodes[b].textContent || '').trim();
        if (/^\\d{1,2}$/.test(bt)) {
          var br = badgeNodes[b].getBoundingClientRect ? badgeNodes[b].getBoundingClientRect() : null;
          if (br && br.width >= 14 && br.width <= 40 && br.height >= 14 && br.height <= 40) {
            var n = parseInt(bt, 10);
            if (n > unreadCount) unreadCount = n;
          }
        }
      }

      var listTimeLabel = null;
      var tm = raw.match(/(\\d+분 전|\\d+시간 전|어제|방금|\\d{1,2}:\\d{2})/);
      if (tm) listTimeLabel = tm[1];

      var previewKind = 'unknown';
      if (/견적.*읽|읽었|확인/.test(previewText)) previewKind = 'quote_read';
      else if (/안녕|고객님|문의|네|요|니다|\\.\\.\\./.test(previewText)) previewKind = 'message';

      out.push({
        chatId: chatId,
        customerName: customerName,
        previewText: previewText.slice(0, 500),
        previewKind: previewKind,
        unreadCount: unreadCount,
        listTimeLabel: listTimeLabel,
        capturedAt: Date.now(),
      });
    }
    return out;
  };

  window.__soomgoBridgePushChatEvents = function(rows) {
    if (!rows || !rows.length) return;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r.chatId) continue;
      if ((r.unreadCount || 0) < 1 && r.previewKind !== 'quote_read') continue;
      window.__soomgoBridgeChatListWatch.events.push(r);
      if (window.__soomgoBridgeChatListWatch.events.length > 50) {
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
  }, 4000);

  window.__soomgoBridgeRunChatScan();
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


class ChatListWatcher:
    def __init__(self) -> None:
        self._watcher_installed = False
        self._store: list[dict[str, Any]] = []
        self._pending: list[dict[str, Any]] = []
        self._dedupe: dict[str, int] = {}

    @property
    def watcher_installed(self) -> bool:
        return self._watcher_installed

    def install(self, driver) -> bool:
        try:
            driver.execute_script(_INSTALL_WATCHER_JS)
            self._watcher_installed = True
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
        unread = int(row.get('unreadCount') or 0)
        kind = str(row.get('previewKind') or '')
        if unread < 1 and kind != 'quote_read':
            return False
        key = self._dedupe_key(row)
        now = int(row.get('capturedAt') or time.time() * 1000)
        prev = self._dedupe.get(key)
        if prev and now - prev < DEDUPE_TTL_MS:
            return False
        self._dedupe[key] = now
        return True

    def _normalize_row(self, row: dict[str, Any]) -> dict[str, Any]:
        captured = int(row.get('capturedAt') or time.time() * 1000)
        return {
            'id': str(uuid.uuid4()),
            'chatId': str(row.get('chatId') or ''),
            'customerName': (row.get('customerName') or None),
            'previewText': str(row.get('previewText') or '').strip() or '(내용 없음)',
            'previewKind': row.get('previewKind') or 'unknown',
            'unreadCount': int(row.get('unreadCount') or 0),
            'listTimeLabel': row.get('listTimeLabel') or None,
            'capturedAt': captured,
        }

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
