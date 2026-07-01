/** 텔레CRM 작업 화면을 새 창으로 연다 (PC 전용). 팝업 차단 시 false. */
export function openTelecrmWindow(): boolean {
  const url = `${window.location.origin}/admin/crm?popup=1`;
  const win = window.open(url, 'sk-telecrm', 'width=1440,height=900,noopener,noreferrer');
  return win != null;
}
