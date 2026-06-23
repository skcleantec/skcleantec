/**
 * admin 스크린샷 + pages.ts 정의 기준으로 help/data.json 생성
 * 팀장 항목은 기존 data.json 유지(정산 문구만 수정)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDashboardMarkdown,
  buildInquiriesMarkdown,
  buildScheduleMarkdown,
} from './detailed-help-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const DATA_PATH = path.join(REPO, 'client', 'public', 'help', 'data.json');

const ADMIN_PAGES = [
  { module: '대시보드', moduleOrder: 1, title: '대시보드', path: '/admin/dashboard', screenshotFile: 'admin_대시보드_대시보드.png', hint: '오늘 접수 통계, DB 접수 폼(전화 접수 입력), 미배정·진행 중 건수 요약이 있습니다.' },
  { module: '접수 관리', moduleOrder: 2, title: '접수 목록', path: '/admin/inquiries', screenshotFile: 'admin_접수_관리_접수_목록.png', hint: '전체 접수 목록 테이블. 상태 필터, 담당 팀장 지정, 날짜 검색, 엑셀 다운로드 기능이 있습니다.' },
  { module: '스케줄 관리', moduleOrder: 3, title: '스케줄 표', path: '/admin/schedule', screenshotFile: 'admin_스케줄_관리_스케줄_표.png', hint: '월간 달력 뷰. 날짜별 팀장 배정 현황, 미배정 건, 오전·오후 슬롯 표시.' },
  { module: '팀장·팀 관리', moduleOrder: 4, title: '팀장 목록', path: '/admin/team-leaders', screenshotFile: 'admin_팀장_팀_관리_팀장_목록.png', hint: '팀장 계정 목록. 등록·수정, 역할(팀장/외부파트너), 활성 여부 관리.' },
  { module: '팀장·팀 관리', moduleOrder: 4, title: '팀 관리', path: '/admin/teams', screenshotFile: 'admin_팀장_팀_관리_팀_관리.png', hint: '팀 단위 그룹 관리. 팀장과 크루(현장팀원)를 묶는 팀 구성 화면.' },
  { module: '팀장·팀 관리', moduleOrder: 4, title: '팀 휴무 캘린더', path: '/admin/team-holidays', screenshotFile: 'admin_팀장_팀_관리_팀_휴무_캘린더.png', hint: '팀장별 휴무·이동 가능 일정 캘린더. 팀장이 신청한 휴무를 관리자가 승인/거부.' },
  { module: '팀장·팀 관리', moduleOrder: 4, title: '팀장 통계', path: '/admin/team-leader-stats', screenshotFile: 'admin_팀장_팀_관리_팀장_통계.png', hint: '팀장별 완료 건수, 배정 현황 통계.' },
  { module: '발주서', moduleOrder: 5, title: '발주서 목록', path: '/admin/order-form', screenshotFile: 'admin_발주서_발주서_목록.png', hint: '고객이 셀프 접수 시 작성한 발주서 목록. 제출 여부, 접수 연결 상태 확인.' },
  { module: '발주서', moduleOrder: 5, title: '발주서 안내 설정', path: '/admin/order-form/notice', screenshotFile: 'admin_발주서_발주서_안내_설정.png', hint: '고객에게 발송되는 발주서 안내문·약관 설정 화면.' },
  { module: '발주서', moduleOrder: 5, title: '발주서 전문 옵션 설정', path: '/admin/order-form/specialty-settings', screenshotFile: 'admin_발주서_발주서_전문_옵션_설정.png', hint: '청소 전문 옵션(입주청소, 특수청소 등) 항목 커스터마이징.' },
  { module: 'C/S 관리', moduleOrder: 6, title: 'C/S 워크데스크', path: '/admin/cs', screenshotFile: 'admin_C_S_관리_C_S_워크데스크.png', hint: '고객 문의 처리 화면. 상담 이력, 처리 상태, 담당자 지정.' },
  { module: '현장검수', moduleOrder: 7, title: '현장검수 템플릿', path: '/admin/inspection-template', screenshotFile: 'admin_현장검수_현장검수_템플릿.png', hint: '팀장이 현장에서 사용하는 체크리스트 템플릿 설정. 구역·항목 추가.' },
  { module: '전자계약', moduleOrder: 8, title: '전자계약 목록', path: '/admin/e-contracts', screenshotFile: 'admin_전자계약_전자계약_목록.png', hint: '발송된 전자계약서 목록. 서명 완료 여부, PDF 다운로드.' },
  { module: '정산', moduleOrder: 9, title: '급여·정산', path: '/admin/payroll', screenshotFile: 'admin_정산_급여_정산.png', hint: '팀장별 월간 정산 현황. 배정 건수, 금액, 지급 여부 관리.' },
  { module: '정산', moduleOrder: 9, title: '외부업체 정산', path: '/admin/external-settlement', screenshotFile: 'admin_정산_외부업체_정산.png', hint: '타업체(협력업체) 수수료 정산·지급 관리 화면.' },
  { module: '페이백·리뷰', moduleOrder: 10, title: '페이백·리뷰 신청 목록', path: '/admin/review-payback', screenshotFile: 'admin_페이백_리뷰_페이백_리뷰_신청_목록.png', hint: '고객이 신청한 페이백·리뷰 요청 목록. 확인·지급 처리.' },
  { module: '광고', moduleOrder: 11, title: '광고 관리', path: '/admin/advertising', screenshotFile: 'admin_광고_광고_관리.png', hint: '플랫폼 내 배너·광고 설정 화면.' },
  { module: '메시지', moduleOrder: 12, title: '메시지', path: '/admin/messages', screenshotFile: 'admin_메시지_메시지.png', hint: '관리자와 팀장 간 1:1 메시지 채팅 화면.' },
  { module: '업체 설정', moduleOrder: 13, title: '업체 등록정보', path: '/admin/tenant-company-profile', screenshotFile: 'admin_업체_설정_업체_등록정보.png', hint: '업체 기본정보(상호, 사업자번호, 대표자, SMTP 메일 설정 등) 관리.' },
  { module: '업체 설정', moduleOrder: 13, title: '고객 페이지 설정', path: '/admin/page-settings', screenshotFile: 'admin_업체_설정_고객_페이지_설정.png', hint: '고객에게 노출되는 공개 페이지(발주서, 현장검수 열람 등) 디자인·문구 설정.' },
  { module: '파트너', moduleOrder: 14, title: '파트너 업체', path: '/admin/partners', screenshotFile: 'admin_파트너_파트너_업체.png', hint: '협력 파트너 업체 등록·관리. 공동 접수 배분 설정.' },
  { module: '파트너', moduleOrder: 14, title: '파트너 정산', path: '/admin/partner-settlement', screenshotFile: 'admin_파트너_파트너_정산.png', hint: '파트너 업체와의 정산 내역 확인.' },
  { module: '운영사', moduleOrder: 15, title: '운영사 관리', path: '/admin/operating-companies', screenshotFile: 'admin_운영사_운영사_관리.png', hint: '운영사(본사·가맹점) 구분 관리.' },
];

function buildMarkdown(roleLabel, page) {
  return [
    '## 화면 소개',
    '',
    `${roleLabel}가 **${page.title}** 화면에서 업무를 처리합니다. ${page.hint}`,
    '',
    '## 주요 기능',
    '',
    '- 상단 필터·기간·검색 조건',
    '- 목록·표 또는 설정 폼',
    '- 상세 보기·저장·처리 버튼',
    '',
    '## 사용 방법',
    '',
    `1. 메뉴에서 **${page.module}** → **${page.title}** 로 이동합니다.`,
    '2. 조회 조건을 선택한 뒤 화면 내용을 확인합니다.',
    '3. 항목을 선택해 상세를 검토하고 필요한 작업을 진행합니다.',
    '',
    '## 자주 묻는 질문',
    '',
    '**Q: 목록이 비어 있어요.**',
    '',
    'A: 조회 기간·필터를 넓혀 보거나, 해당 메뉴 접근 권한(관리자/마케터)을 확인하세요.',
  ].join('\n');
}

function adminEntry(page) {
  // 상세 마크다운이 있는 화면은 개별 함수 사용
  let markdown;
  if (page.path === '/admin/dashboard') {
    markdown = buildDashboardMarkdown();
  } else if (page.path === '/admin/inquiries') {
    markdown = buildInquiriesMarkdown();
  } else if (page.path === '/admin/schedule') {
    markdown = buildScheduleMarkdown();
  } else {
    markdown = buildMarkdown('관리자(마케터)', page);
  }

  return {
    role: 'admin',
    module: page.module,
    moduleOrder: page.moduleOrder,
    title: page.title,
    path: page.path,
    screenshotFile: page.screenshotFile,
    summary: page.hint,
    markdown,
  };
}

const TEAM_SETTLEMENT_FIX = {
  title: '타업체 정산',
  summary:
    '타업체(EXTERNAL_PARTNER) 계정이 담당 현장의 수수료·정산완료 내역을 기간별로 확인하는 화면입니다.',
  markdown: [
    '## 화면 소개',
    '**타업체 로그인 계정**이 본인 업체에 배정된 현장의 **인계·수수료 정산** 내역을 확인하는 화면입니다. 일반 팀장 급여 정산이 아니라, 협력 타업체 수수료·미수금·정산완료 내역을 조회합니다.',
    '',
    '## 주요 기능',
    '- **기간 필터**: 오늘 / 전체 / 월별 / 날짜별 조회',
    '- **정산 내역 탭**: 건별 접수·수수료·취소 차감 목록',
    '- **정산완료내역 탭**: 관리자가 기록한 지급(정산완료) 이력',
    '- **요약 카드**: 기간 결제대상, 정산완료, 남은 결제(미수) 금액',
    '- **고객명·접수번호 검색**: 내역 빠르게 찾기',
    '',
    '## 사용 방법',
    '1. 상단에서 조회 **기간**을 선택합니다.',
    '2. **정산 내역** 탭에서 건별 수수료를 확인합니다.',
    '3. **정산완료내역** 탭에서 실제 지급된 금액·일자를 확인합니다.',
    '4. 특정 건을 찾을 때는 검색창에 **고객명 또는 접수번호**를 입력합니다.',
    '',
    '## 자주 묻는 질문',
    '**Q: 정보공유로 갖고간 건이 안 보여요.**',
    'A: 인계 확정 월 기준으로 집계됩니다. 조회 월을 인계 확정한 달로 바꿔 보세요.',
    '',
    '**Q: 일반 팀장 급여 정산은 어디서 보나요?**',
    'A: 이 메뉴는 타업체 전용입니다. 자사 팀장 급여는 관리자 **급여·정산** 메뉴에서 처리됩니다.',
  ].join('\n'),
};

const raw = await readFile(DATA_PATH, 'utf8');
const teamEntries = JSON.parse(raw)
  .filter((entry) => entry.role === 'team')
  .map((entry) => {
    if (entry.path === '/team/settlement') {
      return {
        ...entry,
        title: TEAM_SETTLEMENT_FIX.title,
        summary: TEAM_SETTLEMENT_FIX.summary,
        markdown: TEAM_SETTLEMENT_FIX.markdown,
      };
    }
    return entry;
  });

const merged = [...ADMIN_PAGES.map(adminEntry), ...teamEntries];
await writeFile(DATA_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
console.log(`Wrote ${merged.length} entries to ${DATA_PATH}`);
