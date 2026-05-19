import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';

/** 서비스접수(/admin/inquiries/*) — PC 사이드·모바일 가로 탭 공통 정의 */
export const ADMIN_INQUIRIES_NAV_ITEMS: AdminSideNavItem[] = [
  { type: 'link', to: '/admin/inquiries', end: true, label: '접수목록' },
  { type: 'link', to: '/admin/inquiries/followup', label: '부재·보류' },
  {
    type: 'group',
    label: '발주서',
    children: [
      { to: '/admin/inquiries/order-forms', label: '발주서 목록' },
      { to: '/admin/inquiries/order-issue', label: '발주서 발급' },
      {
        to: '/admin/inquiries/order-customer-preview',
        label: '발주서설정',
        title: '발주서 폼 설정·미리보기',
      },
    ],
  },
];
