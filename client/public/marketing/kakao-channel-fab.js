/**
 * PC(lg+) 전역 — 카카오톡 채널 상담 FAB (길게 눌러 위치 이동)
 * channelPublicId: _vnxjSX · shared/platformSupport.ts 와 동일
 * 표시: 모든 경로(랜딩·로그인·관리·팀·크루 등) — 모바일(lg 미만) 제외
 */
(function initKakaoConsultFab() {
  'use strict';

  var PC_QUERY = '(min-width: 1024px)';
  var STORAGE_KEY = 'cbiseo:kakao-consult-fab:v1';
  var CHANNEL_PUBLIC_ID = '_vnxjSX';
  var CHAT_FALLBACK_URL = 'https://pf.kakao.com/_vnxjSX/chat';
  var HOLD_MS = 420;
  var HOLD_CANCEL_MOVE_PX = 10;
  var TAP_BLOCK_MS = 200;
  var DEFAULT_INSET_PX = 24;
  var FAB_SIZE_PX = 56;
  var FAB_ID = 'cbiseo-kakao-consult-fab';

  var pcMq = window.matchMedia(PC_QUERY);
  var fabEl = null;
  var styleEl = null;
  var tapBlockedUntil = 0;
  var sdkInitAttempted = false;

  function ensureStyles() {
    if (styleEl || document.getElementById('cbiseo-kakao-consult-fab-style')) return;
    styleEl = document.createElement('style');
    styleEl.id = 'cbiseo-kakao-consult-fab-style';
    styleEl.textContent =
      '#' +
      FAB_ID +
      '{' +
      'position:fixed;z-index:110;width:' +
      FAB_SIZE_PX +
      'px;height:' +
      FAB_SIZE_PX +
      'px;padding:0;margin:0;border:none;border-radius:9999px;' +
      'background:#FEE500;box-shadow:0 4px 14px rgba(15,23,42,.18),0 0 0 1px rgba(0,0,0,.06);' +
      'display:none;align-items:center;justify-content:center;cursor:pointer;touch-action:none;' +
      'transition:box-shadow .15s ease,transform .15s ease;' +
      '}' +
      '@media (min-width:1024px){#' +
      FAB_ID +
      '.cbiseo-kakao-fab-visible{display:flex;}}' +
      '#' +
      FAB_ID +
      ':hover{box-shadow:0 6px 18px rgba(15,23,42,.22),0 0 0 1px rgba(0,0,0,.08);}' +
      '#' +
      FAB_ID +
      ':focus-visible{outline:2px solid #0f172a;outline-offset:3px;}' +
      '#' +
      FAB_ID +
      '.cbiseo-kakao-fab-dragging{cursor:grabbing;transform:scale(1.04);box-shadow:0 8px 24px rgba(15,23,42,.28);}' +
      '#' +
      FAB_ID +
      ' img{display:block;width:28px;height:28px;pointer-events:none;user-select:none;-webkit-user-drag:none;}';
    document.head.appendChild(styleEl);
  }

  function readSavedPosition() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== 1) return null;
      if (typeof data.left !== 'number' || typeof data.top !== 'number') return null;
      return { left: data.left, top: data.top };
    } catch (_e) {
      return null;
    }
  }

  function persistPosition(left, top) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: 1, left: Math.round(left), top: Math.round(top) }),
      );
    } catch (_e) {
      /* ignore quota / private mode */
    }
  }

  function clampPosition(left, top) {
    var maxLeft = Math.max(0, window.innerWidth - FAB_SIZE_PX);
    var maxTop = Math.max(0, window.innerHeight - FAB_SIZE_PX);
    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop),
    };
  }

  function defaultPosition() {
    return clampPosition(
      window.innerWidth - FAB_SIZE_PX - DEFAULT_INSET_PX,
      window.innerHeight - FAB_SIZE_PX - DEFAULT_INSET_PX,
    );
  }

  function applyPosition(el, left, top, save) {
    var pos = clampPosition(left, top);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    if (save) persistPosition(pos.left, pos.top);
    return pos;
  }

  function tryInitKakaoSdk() {
    if (sdkInitAttempted) return;
    var key = window.__CBISEO_KAKAO_JS_KEY__;
    if (!key || typeof window.Kakao === 'undefined') return;
    sdkInitAttempted = true;
    try {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(key);
      }
    } catch (_e) {
      sdkInitAttempted = false;
    }
  }

  function openChat() {
    tryInitKakaoSdk();
    try {
      if (
        typeof window.Kakao !== 'undefined' &&
        window.Kakao.isInitialized &&
        window.Kakao.isInitialized() &&
        window.Kakao.Channel &&
        typeof window.Kakao.Channel.chat === 'function'
      ) {
        window.Kakao.Channel.chat({ channelPublicId: CHANNEL_PUBLIC_ID });
        return;
      }
    } catch (_e) {
      /* fallback below */
    }
    window.open(CHAT_FALLBACK_URL, '_blank', 'noopener,noreferrer');
  }

  function bindPointer(el) {
    var holdTimer = null;
    var dragging = false;
    var pressMoved = false;
    var dragOffsetX = 0;
    var dragOffsetY = 0;
    var activePointerId = null;
    var captureTarget = null;
    var endPressCleanup = null;
    var endDragCleanup = null;
    var pressStartX = 0;
    var pressStartY = 0;

    function clearHoldTimer() {
      if (holdTimer != null) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
    }

    function clearPressListeners() {
      if (endPressCleanup) {
        endPressCleanup();
        endPressCleanup = null;
      }
    }

    function clearDragListeners() {
      if (endDragCleanup) {
        endDragCleanup();
        endDragCleanup = null;
      }
    }

    function finishPointer(evt, wasDragging) {
      try {
        captureTarget && captureTarget.releasePointerCapture(evt.pointerId);
      } catch (_e) {
        /* ignore */
      }
      captureTarget = null;
      activePointerId = null;
      clearHoldTimer();
      clearPressListeners();
      clearDragListeners();
      if (wasDragging) {
        el.classList.remove('cbiseo-kakao-fab-dragging');
        dragging = false;
        tapBlockedUntil = Date.now() + TAP_BLOCK_MS;
        var rect = el.getBoundingClientRect();
        applyPosition(el, rect.left, rect.top, true);
      } else if (!pressMoved && Date.now() >= tapBlockedUntil) {
        openChat();
      }
      pressMoved = false;
    }

    function onPressMove(evt) {
      if (activePointerId !== evt.pointerId) return;
      if (dragging) return;
      var dx = evt.clientX - pressStartX;
      var dy = evt.clientY - pressStartY;
      if (Math.hypot(dx, dy) > HOLD_CANCEL_MOVE_PX) {
        pressMoved = true;
        clearHoldTimer();
      }
    }

    function onPressUp(evt) {
      if (activePointerId !== evt.pointerId) return;
      finishPointer(evt, dragging);
    }

    function onDragMove(evt) {
      if (!dragging || activePointerId !== evt.pointerId) return;
      pressMoved = true;
      applyPosition(el, evt.clientX - dragOffsetX, evt.clientY - dragOffsetY, false);
    }

    function onDragUp(evt) {
      if (activePointerId !== evt.pointerId) return;
      finishPointer(evt, true);
    }

    function beginDrag(evt) {
      if (dragging || activePointerId !== evt.pointerId) return;
      dragging = true;
      clearPressListeners();
      var rect = el.getBoundingClientRect();
      dragOffsetX = evt.clientX - rect.left;
      dragOffsetY = evt.clientY - rect.top;
      el.classList.add('cbiseo-kakao-fab-dragging');
      try {
        el.setPointerCapture(evt.pointerId);
        captureTarget = el;
      } catch (_e) {
        captureTarget = null;
      }
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragUp);
      window.addEventListener('pointercancel', onDragUp);
      endDragCleanup = function cleanupDrag() {
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', onDragUp);
        window.removeEventListener('pointercancel', onDragUp);
      };
    }

    el.addEventListener('pointerdown', function onPointerDown(evt) {
      if (evt.button !== 0) return;
      clearHoldTimer();
      clearPressListeners();
      clearDragListeners();
      dragging = false;
      pressMoved = false;
      activePointerId = evt.pointerId;
      pressStartX = evt.clientX;
      pressStartY = evt.clientY;

      window.addEventListener('pointermove', onPressMove);
      window.addEventListener('pointerup', onPressUp);
      window.addEventListener('pointercancel', onPressUp);
      endPressCleanup = function cleanupPress() {
        window.removeEventListener('pointermove', onPressMove);
        window.removeEventListener('pointerup', onPressUp);
        window.removeEventListener('pointercancel', onPressUp);
      };

      holdTimer = window.setTimeout(function onHoldReady() {
        holdTimer = null;
        if (pressMoved) return;
        beginDrag(evt);
      }, HOLD_MS);
    });

    el.addEventListener('keydown', function onKeyDown(evt) {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        openChat();
      }
    });
  }

  function mountFab() {
    if (fabEl || document.getElementById(FAB_ID)) return;
    ensureStyles();

    fabEl = document.createElement('button');
    fabEl.type = 'button';
    fabEl.id = FAB_ID;
    fabEl.className = 'cbiseo-kakao-fab-visible';
    fabEl.setAttribute('aria-label', '카카오톡 상담');
    fabEl.title = '카카오톡 상담 · 길게 눌러 위치 변경';

    var img = document.createElement('img');
    img.src = '/marketing/kakao-talk-icon.svg';
    img.alt = '';
    img.width = 28;
    img.height = 28;
    img.draggable = false;
    fabEl.appendChild(img);

    var saved = readSavedPosition();
    var pos = saved || defaultPosition();
    applyPosition(fabEl, pos.left, pos.top, false);

    bindPointer(fabEl);
    document.body.appendChild(fabEl);

    window.addEventListener('resize', function onResize() {
      if (!fabEl) return;
      var rect = fabEl.getBoundingClientRect();
      applyPosition(fabEl, rect.left, rect.top, true);
    });

    if (typeof window.Kakao !== 'undefined') {
      tryInitKakaoSdk();
    } else {
      window.addEventListener('load', tryInitKakaoSdk);
    }
  }

  function unmountFab() {
    if (!fabEl) return;
    fabEl.remove();
    fabEl = null;
  }

  function syncVisibility() {
    if (pcMq.matches) mountFab();
    else unmountFab();
  }

  if (typeof pcMq.addEventListener === 'function') {
    pcMq.addEventListener('change', syncVisibility);
  } else if (typeof pcMq.addListener === 'function') {
    pcMq.addListener(syncVisibility);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncVisibility);
  } else {
    syncVisibility();
  }
})();
