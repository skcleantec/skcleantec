export type PlatformNavItem = {
  label: string;
  to: string;
  icon: string;
  children?: { label: string; to: string }[];
};

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { label: '업체 관리', to: '/platform/tenants', icon: '🏢' },
  { label: '결제 관리', to: '/platform/billing', icon: '💳' },
  {
    label: '안내팝업',
    to: '/platform/popups/unpaid',
    icon: '🔔',
    children: [{ label: '미결재 팝업', to: '/platform/popups/unpaid' }, { label: '타업체·테넌트 홍보', to: '/platform/popups/partner-promo' }],
  },
  { label: '정보공유', to: '/platform/db-marketplace', icon: '🛒' },
  { label: '도움말 문의', to: '/platform/help-inquiry', icon: '💬' },
  { label: '지원 접속', to: '/platform/support-access', icon: '🔑' },
  // { label: '플랜 설정', to: '/platform/plans', icon: '📋' },
  // { label: '공지 발송', to: '/platform/notices', icon: '📢' },
];

export function isPlatformNavActive(pathname: string, to: string): boolean {
  if (to === '/platform/tenants') {
    return pathname === '/platform/tenants' || /^\/platform\/tenants\/[^/]+$/.test(pathname);
  }
  if (to === '/platform/billing') {
    return pathname === '/platform/billing' || pathname.startsWith('/platform/billing/');
  }
  if (to === '/platform/popups/unpaid') {
    return pathname === '/platform/popups/unpaid' || pathname.startsWith('/platform/popups/partner-promo');
  }
  if (to === '/platform/help-inquiry') {
    return pathname === '/platform/help-inquiry' || pathname.startsWith('/platform/help-inquiry/');
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}
