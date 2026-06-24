export type Role = 'admin' | 'team';

export interface ExtraCapture {
  /** 이 추가 캡처의 제목 */
  title: string;
  /** 클릭할 셀렉터 (없으면 클릭 없이 바로 캡처) */
  clickSelector?: string;
  /** 클릭 후 기다릴 셀렉터 */
  waitSelector?: string;
  /** 현재 페이지를 벗어나지 않는 추가 동작 힌트 (Claude 설명용) */
  hint?: string;
}

export interface PageDef {
  role: Role;
  /** 모듈 그룹 이름 (사이드바 구분) */
  module: string;
  /** 사이드바 내 순서 */
  moduleOrder: number;
  /** 이 페이지의 화면 제목 */
  title: string;
  /** 앱 내 경로 (BASE_URL 뒤) */
  path: string;
  /** 페이지 로딩 완료 후 기다릴 CSS 셀렉터 (없으면 networkidle) */
  waitSelector?: string;
  /** Claude에게 전달할 이 화면의 맥락 힌트 */
  hint?: string;
  /** 메인 캡처 후 추가로 찍을 상태(모달, 패널 등) */
  extraCaptures?: ExtraCapture[];
}

// ────────────────────────────────────────
// 관리자 페이지
// ────────────────────────────────────────
export const ADMIN_PAGES: PageDef[] = [
  {
    role: 'admin',
    module: '대시보드',
    moduleOrder: 1,
    title: '대시보드',
    path: '/admin/dashboard',
    hint: '오늘 접수 통계, DB 접수 폼(전화 접수 입력), 미배정·진행 중 건수 요약이 있습니다.',
  },
  {
    role: 'admin',
    module: '접수 관리',
    moduleOrder: 2,
    title: '접수 목록',
    path: '/admin/inquiries',
    hint: '전체 접수 목록 테이블. 상태 필터, 담당 팀장 지정, 날짜 검색, 엑셀 다운로드 기능이 있습니다.',
  },
  {
    role: 'admin',
    module: '스케줄 관리',
    moduleOrder: 3,
    title: '스케줄 표',
    path: '/admin/schedule',
    hint: '월간 달력 뷰. 날짜별 팀장 배정 현황, 미배정 건, 오전·오후 슬롯 표시.',
  },
  {
    role: 'admin',
    module: '팀장·팀 관리',
    moduleOrder: 4,
    title: '팀장 목록',
    path: '/admin/team-leaders',
    hint: '팀장 계정 목록. 등록·수정, 역할(팀장/외부파트너), 활성 여부 관리.',
  },
  {
    role: 'admin',
    module: '팀장·팀 관리',
    moduleOrder: 4,
    title: '팀 관리',
    path: '/admin/teams',
    hint: '팀 단위 그룹 관리. 팀장과 크루(현장팀원)를 묶는 팀 구성 화면.',
  },
  {
    role: 'admin',
    module: '팀장·팀 관리',
    moduleOrder: 4,
    title: '팀 휴무 캘린더',
    path: '/admin/team-holidays',
    hint: '팀장별 휴무·이동 가능 일정 캘린더. 팀장이 신청한 휴무를 관리자가 승인/거부.',
  },
  {
    role: 'admin',
    module: '팀장·팀 관리',
    moduleOrder: 4,
    title: '팀장 통계',
    path: '/admin/team-leader-stats',
    hint: '팀장별 완료 건수, 배정 현황 통계.',
  },
  {
    role: 'admin',
    module: '발주서',
    moduleOrder: 5,
    title: '발주서 목록',
    path: '/admin/order-form',
    hint: '고객이 셀프 접수 시 작성한 발주서 목록. 제출 여부, 접수 연결 상태 확인.',
  },
  {
    role: 'admin',
    module: '발주서',
    moduleOrder: 5,
    title: '발주서 안내 설정',
    path: '/admin/order-form/notice',
    hint: '고객에게 발송되는 발주서 안내문·약관 설정 화면.',
  },
  {
    role: 'admin',
    module: '발주서',
    moduleOrder: 5,
    title: '발주서 전문 옵션 설정',
    path: '/admin/order-form/specialty-settings',
    hint: '청소 전문 옵션(입주청소, 특수청소 등) 항목 커스터마이징.',
  },
  {
    role: 'admin',
    module: 'C/S 관리',
    moduleOrder: 6,
    title: 'C/S 워크데스크',
    path: '/admin/inquiries/cs',
    hint: '고객 문의 처리 화면. 상담 이력, 처리 상태, 담당자 지정.',
  },
  {
    role: 'admin',
    module: '현장검수',
    moduleOrder: 7,
    title: '현장검수 템플릿',
    path: '/admin/inspection-template',
    hint: '팀장이 현장에서 사용하는 체크리스트 템플릿 설정. 구역·항목 추가.',
  },
  {
    role: 'admin',
    module: '전자계약',
    moduleOrder: 8,
    title: '전자계약 목록',
    path: '/admin/e-contracts',
    hint: '발송된 전자계약서 목록. 서명 완료 여부, PDF 다운로드.',
  },
  {
    role: 'admin',
    module: '정산',
    moduleOrder: 9,
    title: '급여·정산',
    path: '/admin/payroll',
    hint: '팀장별 월간 정산 현황. 배정 건수, 금액, 지급 여부 관리.',
  },
  {
    role: 'admin',
    module: '정산',
    moduleOrder: 9,
    title: '외부업체 정산',
    path: '/admin/external-settlement',
    hint: '외부 파트너(협력업체) 정산 관리 화면.',
  },
  {
    role: 'admin',
    module: '페이백·리뷰',
    moduleOrder: 10,
    title: '페이백·리뷰 신청 목록',
    path: '/admin/review-payback',
    hint: '고객이 신청한 페이백·리뷰 요청 목록. 확인·지급 처리.',
  },
  {
    role: 'admin',
    module: '광고',
    moduleOrder: 11,
    title: '광고 관리',
    path: '/admin/advertising',
    hint: '플랫폼 내 배너·광고 설정 화면.',
  },
  {
    role: 'admin',
    module: '메시지',
    moduleOrder: 12,
    title: '메시지',
    path: '/admin/messages',
    hint: '관리자와 팀장 간 1:1 메시지 채팅 화면.',
  },
  {
    role: 'admin',
    module: '업체 설정',
    moduleOrder: 13,
    title: '업체 등록정보',
    path: '/admin/tenant-company-profile',
    hint: '업체 기본정보(상호, 사업자번호, 대표자, SMTP 메일 설정 등) 관리.',
  },
  {
    role: 'admin',
    module: '업체 설정',
    moduleOrder: 13,
    title: '고객 페이지 설정',
    path: '/admin/page-settings',
    hint: '고객에게 노출되는 공개 페이지(발주서, 현장검수 열람 등) 디자인·문구 설정.',
  },
  {
    role: 'admin',
    module: '파트너',
    moduleOrder: 14,
    title: '파트너 업체',
    path: '/admin/partners',
    hint: '협력 파트너 업체 등록·관리. 공동 접수 배분 설정.',
  },
  {
    role: 'admin',
    module: '파트너',
    moduleOrder: 14,
    title: '파트너 정산',
    path: '/admin/partner-settlement',
    hint: '파트너 업체와의 정산 내역 확인.',
  },
  {
    role: 'admin',
    module: '운영사',
    moduleOrder: 15,
    title: '운영사 관리',
    path: '/admin/operating-companies',
    hint: '운영사(본사·가맹점) 구분 관리.',
  },
];

// ────────────────────────────────────────
// 팀장 페이지  (/team/*)
// 로그인: /team/login 에서 아이디·비밀번호 입력 (크루 모드 OFF)
// ────────────────────────────────────────
export const TEAM_PAGES: PageDef[] = [
  {
    role: 'team',
    module: '일정',
    moduleOrder: 1,
    title: '오늘 일정 (대시보드)',
    path: '/team/dashboard',
    hint: '팀장이 가장 먼저 보는 화면. 오늘 배정된 현장 목록, 고객 주소·특이사항 요약.',
    waitSelector: '[class*="dashboard"], [class*="schedule"], [class*="assignment"], main',
  },
  {
    role: 'team',
    module: '일정',
    moduleOrder: 1,
    title: '배정 목록',
    path: '/team/assignments',
    hint: '팀장에게 배정된 전체 접수 목록. 날짜·상태별 필터, 상세 정보 확인.',
    waitSelector: '[class*="list"], [class*="table"], [class*="assignment"], main',
  },
  {
    role: 'team',
    module: '일정',
    moduleOrder: 1,
    title: '스케줄 달력',
    path: '/team/schedule',
    hint: '월간 달력. 팀장 본인의 배정 일정을 날짜별로 확인.',
    waitSelector: '[class*="calendar"], [class*="schedule"], table, main',
  },
  {
    role: 'team',
    module: 'C/S',
    moduleOrder: 2,
    title: 'C/S (고객 문의)',
    path: '/team/cs',
    hint: '팀장이 처리해야 할 고객 문의·재방문 요청 확인 화면.',
    waitSelector: '[class*="cs"], [class*="list"], main',
  },
  {
    role: 'team',
    module: '전자계약',
    moduleOrder: 3,
    title: '전자계약 목록',
    path: '/team/e-contracts',
    hint: '본인 관할 전자계약서 목록. 서명 요청·완료 상태 확인.',
    waitSelector: '[class*="contract"], [class*="list"], main',
  },
  {
    role: 'team',
    module: '정산',
    moduleOrder: 4,
    title: '타업체 정산',
    path: '/team/settlement',
    hint: '타업체(EXTERNAL_PARTNER) 계정 전용. 담당 현장 수수료·정산완료·미수금을 기간별로 확인.',
    waitSelector: '[class*="settlement"], [class*="payroll"], main',
  },
  {
    role: 'team',
    module: '휴무 신청',
    moduleOrder: 5,
    title: '휴무 신청',
    path: '/team/dayoffs',
    hint: '팀장이 휴무를 신청하고 관리자 승인을 기다리는 화면.',
    waitSelector: '[class*="dayoff"], [class*="holiday"], [class*="calendar"], main',
  },
  {
    role: 'team',
    module: '메시지',
    moduleOrder: 6,
    title: '메시지',
    path: '/team/messages',
    hint: '관리자에게 메시지 전송. 1:1 채팅 화면.',
    waitSelector: '[class*="message"], [class*="chat"], main',
  },
];

export const ALL_PAGES: PageDef[] = [...ADMIN_PAGES, ...TEAM_PAGES];
