/** 원성 화면 왼쪽 메뉴. 항목을 여기에 추가하면 사이드바에 바로 붙는다. */
export const PG_PARTNER_NAV = [
  { to: '/pg-partner/applications', label: 'PG 신청', icon: 'check-list-3', end: true },
  { to: '/pg-partner/clerks', label: '고유번호', icon: 'account', end: true },
  { to: '/pg-partner/refunds', label: '취소·환불', icon: 'alert-circle', end: true },
] as const;
