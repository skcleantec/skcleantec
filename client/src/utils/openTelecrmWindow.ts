import { CRM_LAYOUT_MIN_WIDTH, readSoomgoSplitScreenBounds } from './crmSoomgoSplitLayout';

/** 레거시 `sk-telecrm` 빈(data:,) 창 재사용 방지 — 2026-07 */
const TELECRM_POPUP_NAME = 'cbiseo-telecrm';

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
}

/** CRM 팝업(`/admin/crm?popup=1`) 마운트 시 호출 — 재오픈 시 기존 창 포커스용 */
export function registerTelecrmPopupWindow(): void {
  if (typeof window === 'undefined') return;
  if (new URLSearchParams(window.location.search).get('popup') !== '1') return;
  telecrmPopupRef = window;
  try {
    if (window.name !== TELECRM_POPUP_NAME) {
      window.name = TELECRM_POPUP_NAME;
    }
  } catch {
    /* name assignment blocked */
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
        /* cross-origin during load — fall through to reopen */
      }
      try {
        telecrmPopupRef.close();
      } catch {
        /* ignore */
      }
      telecrmPopupRef = null;
    }

    const win = window.open(url, TELECRM_POPUP_NAME, features);
    if (!win || win.closed) {
      return false;
    }

    telecrmPopupRef = win;
    ensureTelecrmPopupUrl(win, url);

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
