"""숨고 페이지 — 로그인·채팅 방해 오버레이(시스템 점검·공지 등) 감지·닫기"""
from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

_IS_BLOCKING_OVERLAY_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 100 || r.height < 60) return false;
  var st = window.getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity || '1') < 0.05) return false;
  return true;
}
function isProtectedModal(text) {
  if (!text) return true;
  if (text.indexOf('고객 요청') >= 0 || text.indexOf('요청 상세') >= 0) return true;
  if (text.indexOf('안심번호') >= 0 || text.indexOf('숨고전화') >= 0) return true;
  return false;
}
function isBlocking(text) {
  if (!text || text.length < 6) return false;
  if (isProtectedModal(text)) return false;
  var keys = ['시스템 점검', '서비스 점검', '점검 안내', '점검 중', '일시 중단', '점검으로',
    '공지사항', '업데이트 안내', '새로운 기능', '이벤트 안내', '긴급 공지'];
  for (var i = 0; i < keys.length; i++) {
    if (text.indexOf(keys[i]) >= 0) return true;
  }
  if (text.indexOf('점검') >= 0 && (text.indexOf('안내') >= 0 || text.indexOf('진행') >= 0)) return true;
  return false;
}
var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="popup"], [class*="Popup"], [class*="overlay"], [class*="Overlay"], [class*="drawer"], [class*="Drawer"]');
for (var i = 0; i < roots.length; i++) {
  var el = roots[i];
  if (!visible(el)) continue;
  var t = (el.innerText || el.textContent || '').trim();
  if (isBlocking(t)) return true;
}
return false;
"""

_DISMISS_BLOCKING_JS = """
function visible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return false;
  var st = window.getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity || '1') < 0.05) return false;
  return true;
}
function isProtectedModal(text) {
  if (!text) return true;
  if (text.indexOf('고객 요청') >= 0 || text.indexOf('요청 상세') >= 0) return true;
  if (text.indexOf('안심번호') >= 0 || text.indexOf('숨고전화') >= 0) return true;
  return false;
}
function isBlocking(text) {
  if (!text || text.length < 6) return false;
  if (isProtectedModal(text)) return false;
  var keys = ['시스템 점검', '서비스 점검', '점검 안내', '점검 중', '일시 중단', '점검으로',
    '공지사항', '업데이트 안내', '새로운 기능', '이벤트 안내', '긴급 공지'];
  for (var i = 0; i < keys.length; i++) {
    if (text.indexOf(keys[i]) >= 0) return true;
  }
  if (text.indexOf('점검') >= 0 && (text.indexOf('안내') >= 0 || text.indexOf('진행') >= 0)) return true;
  return false;
}
function findBlockingRoot() {
  var roots = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="popup"], [class*="Popup"], [class*="overlay"], [class*="Overlay"], [class*="drawer"], [class*="Drawer"]');
  for (var i = 0; i < roots.length; i++) {
    var el = roots[i];
    if (!visible(el)) continue;
    var t = (el.innerText || el.textContent || '').trim();
    if (isBlocking(t)) return el;
  }
  return null;
}
function scoreDismiss(btn, rootRect) {
  if (!visible(btn)) return -1;
  var r = btn.getBoundingClientRect();
  var label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '') + ' ' + (btn.getAttribute('title') || '')).trim();
  var score = 0;
  if (/^확인$|^닫기$|^OK$|^Close$/i.test(label)) score += 60;
  if (/나중에|다음에|건너|skip|later/i.test(label)) score += 45;
  if (/닫기|close|취소|확인/i.test(label)) score += 35;
  if (label === '' || label === '×' || label === '✕' || label === 'X') score += 40;
  if (r.top <= rootRect.top + 80) score += 20;
  if (r.right >= rootRect.right - 80) score += 30;
  if (btn.querySelector('svg, img')) score += 10;
  if (label.length > 24) score -= 20;
  return score;
}
var root = findBlockingRoot();
if (!root) return false;
var rootRect = root.getBoundingClientRect();
var best = null;
var bestScore = -1;
var buttons = root.querySelectorAll('button, [role="button"], a');
for (var i = 0; i < buttons.length; i++) {
  var sc = scoreDismiss(buttons[i], rootRect);
  if (sc > bestScore) { bestScore = sc; best = buttons[i]; }
}
if (best && bestScore >= 30) {
  best.click();
  return true;
}
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
return true;
"""


def dismiss_blocking_overlays(driver, delay: float = 0.5, max_rounds: int = 4) -> int:
    """방해 오버레이(시스템 점검 등)를 닫고 닫은 횟수를 반환."""
    closed = 0
    for _ in range(max_rounds):
        try:
            blocking = bool(driver.execute_script(_IS_BLOCKING_OVERLAY_JS))
        except Exception:
            break
        if not blocking:
            break
        try:
            dismissed = bool(driver.execute_script(_DISMISS_BLOCKING_JS))
        except Exception as e:
            logger.debug('dismiss_blocking_overlays: %s', e)
            break
        if dismissed:
            closed += 1
            time.sleep(delay)
        else:
            break
    return closed
