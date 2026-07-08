/** 텔레CRM 작업 화면을 새 창으로 연다 (PC 전용). 팝업 차단 시 false. */
export function openTelecrmWindow(): boolean {
  const s = window.screen as Screen & { availLeft?: number; availTop?: number };
  const left = s.availLeft ?? 0;
  const top = s.availTop ?? 0;
  const width = Math.max(640, Math.floor((window.screen.availWidth || 1440) / 2));
  const height = window.screen.availHeight || 900;
  const url = `${window.location.origin}/admin/crm?popup=1`;
  const features = `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`;
  const win = window.open(url, 'sk-telecrm', features);
  return win != null;
}
