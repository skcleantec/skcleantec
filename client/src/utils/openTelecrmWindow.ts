import { CRM_LAYOUT_MIN_WIDTH, readSoomgoSplitScreenBounds } from './crmSoomgoSplitLayout';

function isBlankPopupUrl(href: string): boolean {
  const t = href.trim();
  return !t || t === 'about:blank' || t.startsWith('data:');
}

/** 텔레CRM 작업 화면을 새 창으로 연다 (PC 전용). 팝업 차단 시 false. */
export function openTelecrmWindow(): boolean {
  const { availLeft, availTop, availWidth, availHeight } = readSoomgoSplitScreenBounds();
  const width = Math.max(CRM_LAYOUT_MIN_WIDTH, availWidth);
  const url = `${window.location.origin}/admin/crm?popup=1`;
  const features = `width=${width},height=${availHeight},left=${availLeft},top=${availTop},scrollbars=yes,resizable=yes`;

  let win: Window | null = null;
  try {
    win = window.open('', 'sk-telecrm', features);
    if (win && !win.closed) {
      try {
        if (isBlankPopupUrl(win.location.href)) {
          win.location.replace(url);
        } else if (!win.location.href.includes('/admin/crm')) {
          win.location.replace(url);
        }
        win.focus();
        return true;
      } catch {
        /* cross-origin during navigation — reopen below */
      }
    }
  } catch {
    /* named window reuse failed */
  }

  win = window.open(url, 'sk-telecrm', features);
  if (!win || win.closed) {
    return false;
  }

  try {
    if (isBlankPopupUrl(win.location.href)) {
      win.location.replace(url);
    }
  } catch {
    /* navigation in progress */
  }

  win.focus();
  return true;
}
