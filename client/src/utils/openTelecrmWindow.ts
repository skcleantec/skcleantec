import { CRM_LAYOUT_MIN_WIDTH, readSoomgoSplitScreenBounds } from './crmSoomgoSplitLayout';

/** 텔레CRM 작업 화면을 새 창으로 연다 (PC 전용). 팝업 차단 시 false. */
export function openTelecrmWindow(): boolean {
  const { availLeft, availTop, availWidth, availHeight } = readSoomgoSplitScreenBounds();
  const width = Math.max(CRM_LAYOUT_MIN_WIDTH, availWidth);
  const url = `${window.location.origin}/admin/crm?popup=1`;
  const features = `width=${width},height=${availHeight},left=${availLeft},top=${availTop},scrollbars=yes,resizable=yes`;

  const win = window.open(url, 'sk-telecrm', features);
  if (!win || win.closed) {
    return false;
  }

  try {
    win.focus();
  } catch {
    /* focus blocked */
  }
  return true;
}
