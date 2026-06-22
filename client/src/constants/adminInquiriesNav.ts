import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';

/** 서비스접수(/admin/inquiries/*) — PC 사이드·모바일 가로 탭 공통 정의 */
export const ADMIN_INQUIRIES_NAV_ITEMS: AdminSideNavItem[] = [
  { type: 'link', to: '/admin/inquiries', end: true, label: '접수목록' },
  { type: 'link', to: '/admin/inquiries/followup', label: '부재·보류' },
  { type: 'link', to: '/admin/inquiries/review-payback', label: '페이백/리뷰' },
  {
    type: 'group',
    label: '발주서',
    children: [
      { to: '/admin/inquiries/order-forms', label: '발주서 목록' },
      { to: '/admin/inquiries/order-issue', label: '발주서 발급' },
      {
        to: '/admin/inquiries/order-templates',
        label: '발주서 양식',
        title: '발주서별 제목·아이콘·항목 직접 만들기(구글폼식)',
      },
      {
        to: '/admin/inquiries/order-customer-link',
        label: '고객링크설정',
        title: '발주서 링크 안내 메시지 문구 편집·저장',
      },
      {
        to: '/admin/inquiries/order-customer-preview',
        label: '발주서설정',
        title: '공통 메시지·견적/전문시공 옵션 설정·미리보기',
      },
    ],
  },
  {
    type: 'group',
    label: '견적서',
    children: [
      { to: '/admin/inquiries/quotations', label: '견적 목록' },
      { to: '/admin/inquiries/quotations/new', label: '견적 작성' },
      { to: '/admin/inquiries/quotations/settings', label: '견적 설정' },
    ],
  },
];
