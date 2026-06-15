/** PC 접이식 섹션 사이드(서비스접수·관리자 전용 등) 펼침/접힘 후 레이아웃 재측정용 */
export const ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT = 'skcleanteck:admin-section-side-nav-layout';

const SIDE_NAV_TRANSITION_MS = 350;

export function notifyAdminSectionSideNavLayoutChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT));
  window.setTimeout(
    () => window.dispatchEvent(new Event(ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT)),
    SIDE_NAV_TRANSITION_MS,
  );
}
