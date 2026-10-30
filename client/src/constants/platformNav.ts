export type PlatformNavLink = {
  label: string;
  to: string;
};

export type PlatformNavGroup = {
  label: string;
  items: PlatformNavLink[];
};

/** 플랫폼 사이드바 6개 업무 그룹. 경로 문자열은 기존 화면을 그대로 가리킨다. */
export const PLATFORM_NAV_GROUPS: PlatformNavGroup[] = [
  {
    label: '오늘 할 일',
    items: [
      { label: '오늘 할 일', to: '/platform/inbox' },
      { label: '가입승인 게시판', to: '/platform/signup-inquiries' },
      { label: '유료 전환 신청', to: '/platform/plan-upgrade-requests' },
      { label: '문의 링크 신청', to: '/platform/landing-contact-link-requests' },
    ],
  },
  {
    label: '업체',
    items: [
      { label: '업체 목록', to: '/platform/tenants' },
      { label: '업체 추가', to: '/platform/tenants/new' },
    ],
  },
  {
    label: '매출·수납',
    items: [
      { label: '이용료 청구', to: '/platform/billing' },
      { label: '입금 내역', to: '/platform/billing/settlement' },
      { label: '카드결제', to: '/platform/card-payment/charge' },
      { label: 'PG 수수료', to: '/platform/card-payment/fees' },
    ],
  },
  {
    label: '부가서비스',
    items: [
      { label: '카드결제 PG', to: '/platform/card-payment' },
      { label: '전자계약', to: '/platform/card-payment/e-contract' },
      { label: '계산서(바로빌)', to: '/platform/barobill-members' },
      { label: 'DB 마켓', to: '/platform/db-marketplace' },
    ],
  },
  {
    label: '마케팅·고객',
    items: [
      { label: '가입 체험 이벤트', to: '/platform/signup-trial-events' },
      { label: '추천인', to: '/platform/referrers' },
      { label: '미결재 팝업', to: '/platform/popups/unpaid' },
      { label: '타업체·테넌트 홍보', to: '/platform/popups/partner-promo' },
      { label: '고객센터', to: '/platform/customer-boards' },
      { label: '도움말', to: '/platform/help-cms' },
      { label: '메시지', to: '/platform/messages' },
    ],
  },
  {
    label: '설정',
    items: [
      { label: '우리 회사 정보', to: '/platform/settings/business' },
      { label: '입금 계좌·연체', to: '/platform/settings/bank' },
      { label: '메일', to: '/platform/settings/smtp' },
      { label: '고객 메일', to: '/platform/settings/email-templates' },
      { label: '약관', to: '/platform/settings/legal' },
      { label: '이용료 알림', to: '/platform/settings/billing-notify' },
      { label: '지원 접속', to: '/platform/support-access' },
    ],
  },
];

function pathOnly(to: string): string {
  const q = to.indexOf('?');
  return q === -1 ? to : to.slice(0, q);
}

export function isPlatformNavActive(pathname: string, to: string): boolean {
  const path = pathOnly(to);
  if (path === '/platform/tenants/new') return pathname === path;
  if (path === '/platform/tenants') {
    return (
      pathname === '/platform/tenants' ||
      (/^\/platform\/tenants\/[^/]+$/.test(pathname) && pathname !== '/platform/tenants/new')
    );
  }
  if (path === '/platform/card-payment/e-contract') return pathname.startsWith(path);
  if (path === '/platform/card-payment/charge') return pathname.startsWith(path);
  if (path === '/platform/card-payment/fees') return pathname.startsWith(path);
  if (path === '/platform/card-payment') return pathname === path;
  if (path === '/platform/billing/settlement') return pathname.startsWith(path);
  if (path === '/platform/billing') return pathname === path;
  if (path === '/platform/customer-boards') {
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  if (path === '/platform/settings/smtp') {
    return pathname === '/platform/settings' || pathname === path;
  }
  if (path.startsWith('/platform/settings/')) return pathname === path;
  if (path === '/platform/popups/unpaid') return pathname === path;
  if (path === '/platform/popups/partner-promo') return pathname.startsWith(path);
  if (path === '/platform/help-inquiry') return pathname.startsWith('/platform/customer-boards');
  return pathname === path || pathname.startsWith(`${path}/`);
}
