import { CRM_LAYOUT_MIN_WIDTH, readSoomgoSplitScreenBounds } from './crmSoomgoSplitLayout';

/** 레거시 named target — `window.open('', name)` 시 data:, 창이 생김. 이름 지정 오픈 금지 */
const LEGACY_TELECRM_POPUP_NAME = 'sk-telecrm';

let telecrmPopupRef: Window | null = null;
let openingTelecrm = false;

function buildTelecrmPopupUrl(): string {
  return `${window.location.origin}/admin/crm?popup=1`;
}

function isStalePopupUrl(href: string): boolean {
  const t = href.trim();
  return !t || t === 'about:blank' || t.startsWith('data:');
}

function ensureTelecrmPopupUrl(win: Window, url: string): void {
  const navigate = () => {
    if (win.closed) return;
    try {
      const href = win.location.href;
      if (isStalePopupUrl(href) || !href.includes('/admin/crm')) {
        win.location.replace(url);
      }
    } catch {
      /* navigation in progress */
    }
  };

  navigate();
  window.setTimeout(navigate, 50);
  window.setTimeout(navigate, 200);
  window.setTimeout(navigate, 600);
}

function closePopupRef(ref: Window | null): void {
  if (!ref || ref.closed) return;
  try {
    ref.close();
  } catch {
    /* ignore */
  }
}

function openFreshTelecrmPopup(url: string, features: string): Window | null {
  // named target 재사용(data:,·sk-telecrm) 방지 — 항상 _blank
  const win = window.open(url, '_blank', features);
  if (!win || win.closed) return null;

  try {
    if (isStalePopupUrl(win.location.href)) {
      closePopupRef(win);
      const retry = window.open(url, '_blank', features);
      if (!retry || retry.closed) return null;
      ensureTelecrmPopupUrl(retry, url);
      return retry;
    }
  } catch {
    /* cross-origin during load */
  }

  ensureTelecrmPopupUrl(win, url);
  return win;
}

/** CRM 팝업(`/admin/crm?popup=1`) 마운트 시 호출 — 재오픈 시 기존 창 포커스용 */
export function registerTelecrmPopupWindow(): void {
  if (typeof window === 'undefined') return;
  if (new URLSearchParams(window.location.search).get('popup') !== '1') return;
  telecrmPopupRef = window;
  try {
    window.name = '';
  } catch {
    /* ignore */
  }
}

/** 텔레CRM 작업 화면을 새 창으로 연다 (PC 전용). 팝업 차단 시 false. */
export function openTelecrmWindow(): boolean {
  if (typeof window === 'undefined') return false;
  if (openingTelecrm) return true;

  const url = buildTelecrmPopupUrl();
  const { availLeft, availTop, availWidth, availHeight } = readSoomgoSplitScreenBounds();
  const width = Math.max(CRM_LAYOUT_MIN_WIDTH, availWidth);
  const features = `width=${width},height=${availHeight},left=${availLeft},top=${availTop},scrollbars=yes,resizable=yes`;

  openingTelecrm = true;
  try {
    if (telecrmPopupRef && !telecrmPopupRef.closed) {
      try {
        const href = telecrmPopupRef.location.href;
        if (!isStalePopupUrl(href) && href.includes('/admin/crm')) {
          telecrmPopupRef.focus();
          return true;
        }
      } catch {
        /* cross-origin during load */
      }
      closePopupRef(telecrmPopupRef);
      telecrmPopupRef = null;
    }

    const win = openFreshTelecrmPopup(url, features);
    if (!win) {
      return false;
    }

    telecrmPopupRef = win;

    try {
      win.focus();
    } catch {
      /* focus blocked */
    }
    return true;
  } finally {
    window.setTimeout(() => {
      openingTelecrm = false;
    }, 400);
  }
}

/** 레거시 sk-telecrm data:, 창 — 사용자가 수동으로 닫을 때까지 남을 수 있음 */
export const LEGACY_TELECRM_WINDOW_NAME = LEGACY_TELECRM_POPUP_NAME;
