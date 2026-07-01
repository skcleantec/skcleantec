/** 텔레CRM 작업 화면을 새 창으로 연다 (PC 전용). */
export function openTelecrmWindow(): void {
  const url = `${window.location.origin}/admin/crm?popup=1`;
  window.open(url, 'sk-telecrm', 'width=1440,height=900,noopener,noreferrer');
}
