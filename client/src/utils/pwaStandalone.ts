/** 홈 화면에 추가(PWA) — iOS standalone / Android display-mode: standalone */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** PWA에서는 주소창 새로고침이 없으므로 홈 이동 시 전체 리로드 */
export function assignStaffHomePath(homePath: '/admin/dashboard' | '/team/dashboard'): void {
  window.location.assign(homePath);
}
