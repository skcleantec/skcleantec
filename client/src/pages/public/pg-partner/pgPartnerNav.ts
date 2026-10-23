/** 원성 화면 왼쪽 메뉴. 항목을 여기에 추가하면 사이드바에 바로 붙는다. */
export const PG_PARTNER_NAV = [
  { to: '/pg-partner/applications', label: 'PG 신청', icon: 'check-list-3', end: true },
  { to: '/pg-partner/contracts', label: '전자계약', icon: 'document', end: true },
  { to: '/pg-partner/merchants', label: '사용 중 업체', icon: 'clipboard', end: true },
  { to: '/pg-partner/payments', label: '결제 내역', icon: 'alert-circle', end: true },
] as const;
