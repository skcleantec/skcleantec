export type PlatformNavItem = {
  label: string;
  to: string;
  icon: string;
  children?: { label: string; to: string }[];
};

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { label: '업체 관리', to: '/platform/tenants', icon: '🏢', children: [{ label: '유료 전환 신청', to: '/platform/plan-upgrade-requests' }, { label: '가입승인 게시판', to: '/platform/signup-inquiries' }] },
  { label: '추천인', to: '/platform/referrers', icon: '🤝' },
  { label: '결제 관리', to: '/platform/billing', icon: '💳' },
  { label: '가입 체험 이벤트', to: '/platform/signup-trial-events', icon: '🎁' },
  { label: '코인 사용량', to: '/platform/coin-usage', icon: '🪙' },
  {
    label: '안내팝업',
    to: '/platform/popups/unpaid',
    icon: '🔔',
    children: [{ label: '미결재 팝업', to: '/platform/popups/unpaid' }, { label: '타업체·테넌트 홍보', to: '/platform/popups/partner-promo' }],
  },
  { label: '정보공유', to: '/platform/db-marketplace', icon: '🛒' },
  { label: '도움말 문의', to: '/platform/help-inquiry', icon: '💬' },
  { label: '도움말 CMS', to: '/platform/help-cms', icon: '📚' },
  { label: '지원 접속', to: '/platform/support-access', icon: '🔑' },
  // { label: '플랜 설정', to: '/platform/plans', icon: '📋' },
  // { label: '공지 발송', to: '/platform/notices', icon: '📢' },
];

export function isPlatformNavActive(pathname: string, to: string): boolean {
  if (to === '/platform/tenants') {
    return (
      pathname === '/platform/tenants' ||
      pathname === '/platform/plan-upgrade-requests' ||
      pathname === '/platform/signup-inquiries' ||
      /^\/platform\/tenants\/[^/]+$/.test(pathname)
    );
  }
  if (to === '/platform/billing') {
    return pathname === '/platform/billing' || pathname.startsWith('/platform/billing/');
  }
  if (to === '/platform/coin-usage') {
    return pathname === '/platform/coin-usage' || pathname.startsWith('/platform/coin-usage/');
  }
  if (to === '/platform/signup-trial-events') {
    return (
      pathname === '/platform/signup-trial-events' ||
      pathname.startsWith('/platform/signup-trial-events/')
    );
  }
  if (to === '/platform/referrers') {
    return pathname === '/platform/referrers' || pathname.startsWith('/platform/referrers/');
  }
  if (to === '/platform/popups/unpaid') {
    return pathname === '/platform/popups/unpaid' || pathname.startsWith('/platform/popups/partner-promo');
  }
  if (to === '/platform/help-inquiry') {
    return pathname === '/platform/help-inquiry' || pathname.startsWith('/platform/help-inquiry/');
  }
  if (to === '/platform/help-cms') {
    return pathname === '/platform/help-cms' || pathname.startsWith('/platform/help-cms/');
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}
