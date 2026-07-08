/** @deprecated 메인 CRM 상단 바 사용 — /admin/crm?soomgoBar=1 */
export function openCrmSoomgoCompanionWindow(): Window | null {
  const url = new URL('/admin/crm', window.location.origin);
  url.searchParams.set('soomgoBar', '1');
  if (new URLSearchParams(window.location.search).get('popup') === '1') {
    url.searchParams.set('popup', '1');
  }
  window.location.href = url.toString();
  return null;
}
