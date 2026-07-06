/** GNB hover/focus 시 lazy 페이지 청크 선로드 */
export type PrefetchAdminNavId = 'inquiries' | 'schedule' | 'advertising' | 'messages';

/** 관리자 전용 정산 메뉴 lazy 청크 */
export type PrefetchTeamLeadersPageId = 'payroll' | 'external-settlement';

const prefetched = new Set<PrefetchAdminNavId>();
const prefetchedTeamLeaders = new Set<PrefetchTeamLeadersPageId>();

export function prefetchAdminNavPage(id: PrefetchAdminNavId): void {
  if (prefetched.has(id)) return;
  prefetched.add(id);
  switch (id) {
    case 'inquiries':
      void import('../pages/admin/AdminInquiriesPage');
      break;
    case 'schedule':
      void import('../pages/admin/AdminSchedulePage');
      break;
    case 'advertising':
      void import('../pages/admin/AdminAdvertisingPage');
      break;
    case 'messages':
      void import('../pages/admin/AdminMessagesPage');
      break;
    default:
      break;
  }
}

export function prefetchTeamLeadersPage(id: PrefetchTeamLeadersPageId): void {
  if (prefetchedTeamLeaders.has(id)) return;
  prefetchedTeamLeaders.add(id);
  switch (id) {
    case 'payroll':
      void import('../pages/admin/AdminPayrollPage');
      break;
    case 'external-settlement':
      void import('../pages/admin/AdminExternalSettlementPage');
      break;
    default:
      break;
  }
}

export function prefetchTeamLeadersSettlementPages(): void {
  prefetchTeamLeadersPage('payroll');
  prefetchTeamLeadersPage('external-settlement');
}

export function teamLeadersPagePrefetchHandlers(id: PrefetchTeamLeadersPageId): {
  onMouseEnter: () => void;
  onFocus: () => void;
} {
  return {
    onMouseEnter: () => prefetchTeamLeadersPage(id),
    onFocus: () => prefetchTeamLeadersPage(id),
  };
}

export function adminNavPrefetchHandlers(id: PrefetchAdminNavId): {
  onMouseEnter: () => void;
  onFocus: () => void;
} {
  return {
    onMouseEnter: () => prefetchAdminNavPage(id),
    onFocus: () => prefetchAdminNavPage(id),
  };
}
