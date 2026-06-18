import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';

/** 관리자 전용(/admin/team-leaders/*) — PC 사이드·모바일 가로 탭 공통 정의 */
export const ADMIN_TEAM_LEADERS_NAV_ITEMS: AdminSideNavItem[] = [
  {
    type: 'group',
    label: '업체등록정보',
    children: [
      {
        to: '/admin/team-leaders/company-profile/business',
        end: true,
        label: '사업자정보',
        title: '업체 기본 사업자 정보·견적 직인',
      },
      {
        to: '/admin/team-leaders/company-profile/outbound-email',
        end: true,
        label: '발송이메일',
        title: '고객 발송 메일 SMTP',
      },
    ],
  },
  {
    type: 'group',
    label: '사용자등록',
    children: [
      {
        to: '/admin/team-leaders',
        end: true,
        label: '사용자 등록',
        title: '팀장·마케터·사무직 등록',
      },
      {
        to: '/admin/team-leaders/operating-companies',
        label: '영업브랜드',
        title: '영업 브랜드 등록',
      },
      {
        to: '/admin/team-leaders/external-companies',
        label: '타업체등록',
        title: '타업체 등록',
      },
      {
        to: '/admin/team-leaders/tenant-partners',
        label: '파트너연결',
        title: '파트너 연결',
      },
      {
        to: '/admin/team-leaders/e-contracts',
        label: '전자계약',
        title: '전자계약',
      },
    ],
  },
  {
    type: 'group',
    label: '정산',
    children: [
      {
        to: '/admin/team-leaders/external-settlement',
        label: '타업체정산',
        title: '타업체 정산',
      },
      {
        to: '/admin/team-leaders/tenant-partner-settlement',
        label: '파트너정산',
        title: '파트너 정산',
      },
      {
        to: '/admin/team-leaders/payroll',
        label: '월정산표',
      },
    ],
  },
  {
    type: 'group',
    label: '직원관리',
    children: [
      {
        to: '/admin/team-leaders/leader-stats',
        label: '팀장',
        title: '팀장별 실적',
      },
      {
        to: '/admin/team-leaders/team-members',
        label: '팀원',
        title: '팀원 관리',
      },
      {
        to: '/admin/team-leaders/holiday-calendar',
        label: '휴일캘린더',
        title: '휴일 캘린더',
      },
    ],
  },
  {
    type: 'group',
    label: '설정',
    children: [
      {
        to: '/admin/team-leaders/page-settings',
        label: '페이지설정',
        title: '페이지 설정',
      },
      {
        to: '/admin/team-leaders/operating-policy',
        label: '브랜드정책',
        title: '영업 브랜드 운영 정책',
      },
      {
        to: '/admin/team-leaders/inspection-template',
        label: '검수템플릿',
        title: '현장 검수 체크리스트 템플릿',
      },
    ],
  },
];
