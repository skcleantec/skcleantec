/**
 * 관리자 전용 하위 메뉴별 마케터 가이드 슬라이드 HTML·목차·스크린샷 JSON 생성
 * 실행: node server/scripts/generate-marketer-guide-admin-slides.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const helpDir = path.join(repoRoot, 'client/public/help');
const shotsDir = path.join(helpDir, 'screenshots');

const TOTAL_SLIDES = 37;
const ADMIN_START = 18;

/** @type {Array<{id:string, tocTitle:string, tocDesc:string, group:string, title:string, sub:string, shot:string, steps:Array<{title:string, body:string, bullets?:string[]}>, tip?:string, warn?:string}>} */
const ADMIN_SLIDES = [
  {
    id: '18',
    tocTitle: '관리자 전용 개요',
    tocDesc: '5개 대분류·권한 안내',
    group: '관리자 전용',
    title: '관리자 전용 — 사이드바 구조',
    sub: '권한 <em>「전체」</em> 마케터와 ADMIN만 상단 GNB에 <em>「관리자 전용」</em> 이 보입니다. PC는 왼쪽 사이드·모바일은 가로 탭으로 하위 메뉴에 들어갑니다.',
    shot: 's16_team_leaders.png',
    steps: [
      {
        title: '5개 대분류',
        body: '',
        bullets: [
          '<em>업체등록정보</em> — 가입·사업자·발송 메일',
          '<em>사용자등록</em> — 계정·브랜드·타업체·파트너·전자계약',
          '<em>정산</em> — 타업체·파트너·월정산표',
          '<em>직원관리</em> — 팀장 실적·팀원·휴일캘린더',
          '<em>설정</em> — 페이지·권한·브랜드정책·검수·팀장교육',
        ],
      },
    ],
    warn: '「없음」「일부」 권한 마케터는 이 메뉴 전체가 숨겨집니다. 마케터 권한 변경은 <em>사용자 등록 → 마케터</em> 또는 <em>직원권한</em> 안내를 따르세요.',
  },
  {
    id: '19',
    tocTitle: '가입정보',
    tocDesc: '플랜·기능·사용량',
    group: '업체등록정보',
    title: '가입정보 — 플랜·기능 모듈',
    sub: '청소비서 <em>플랜·이용 상태·켜진 기능·사용량</em> 을 확인합니다. (플랫폼 계약 정보)',
    shot: 's18_subscription.png',
    steps: [
      {
        title: '표시 항목',
        bullets: [
          '플랜명·상태(체험·정상·중지)',
          '기능 모듈 — 전자계약·광고비·정보공유 등',
          '사용량 미터 — 사용자·접수 등 할당량 대비 사용',
        ],
      },
      {
        title: '변경·문의',
        body: '플랜 업그레이드·중지 해제·모듈 추가는 <em>플랫폼 담당자</em>에게 문의합니다. 이 화면은 조회 중심입니다.',
      },
    ],
  },
  {
    id: '20',
    tocTitle: '사업자정보',
    tocDesc: '상호·직인·견적 반영',
    group: '업체등록정보',
    title: '사업자정보 — 업체 기본 정보',
    sub: '견적서·공개 페이지에 쓰는 <em>사업자 정보</em>와 <em>견적 직인</em> 이미지를 저장합니다.',
    shot: 's18_business.png',
    steps: [
      {
        title: '입력 항목',
        bullets: ['상호·대표자·사업자번호·주소·연락처', '견적서 직인 — 업로드·표시 크기 조절'],
      },
      {
        title: '브랜드별 정보',
        body: '영업 브랜드가 여러 개면 브랜드별 사업자 정보는 <em>영업브랜드</em> 메뉴에서 따로 넣을 수 있습니다.',
      },
      { title: '저장', body: '하단 <em>저장</em> 후 견적 PDF·공개 페이지에 반영됩니다.' },
    ],
  },
  {
    id: '21',
    tocTitle: '발송이메일',
    tocDesc: 'SMTP·연결 테스트',
    group: '업체등록정보',
    title: '발송이메일 — SMTP 설정',
    sub: '고객에게 보내는 <em>견적·발주·알림 메일</em> 발송 계정을 설정합니다.',
    shot: 's18_outbound_email.png',
    steps: [
      {
        title: '설정 항목',
        bullets: ['발송 주소·SMTP 호스트·포트', '보안(SSL/TLS)', '<em>연결 테스트</em> — 저장 전 발송 가능 여부 확인'],
      },
      {
        title: '보안',
        body: '비밀번호는 서버에만 저장되며 화면에 다시 노출되지 않을 수 있습니다.',
      },
    ],
  },
  {
    id: '22',
    tocTitle: '사용자 등록',
    tocDesc: '팀장·마케터·사무직',
    group: '사용자등록',
    title: '사용자 등록 — 계정 관리',
    sub: '팀장·마케터·사무직 <em>로그인 계정</em>을 등록·수정·비활성합니다. 현장 <em>팀원</em>은 <em>팀원</em> 메뉴에서 별도 관리합니다.',
    shot: 's18_users.png',
    steps: [
      {
        title: '탭 구분',
        bullets: [
          '<em>팀장</em> — 배정·휴무·정산 대상',
          '<em>마케터</em> — 접수·발주 + 관리자 권한 단계',
          '<em>사무직</em> — 급여용(로그인 없음)',
          '<em>퇴사자</em> — 비활성 계정 이력',
        ],
      },
      {
        title: '팀장 탭 주요 기능',
        bullets: [
          '<em>+</em> 새 팀장 등록',
          '휴무 일괄 허용/금지·팀장별 휴무 등록 스위치',
          '상세·수정 — 브랜드·서비스 권역·정산 옵션·사원증',
          '삭제 — 비활성(로그인 불가)',
        ],
      },
      {
        title: '마케터 탭',
        body: '상세·수정에서 <em>관리자 권한</em> — 없음 / 일부 / 전체. 「전체」만 <em>관리자 전용</em> GNB 노출.',
      },
    ],
  },
  {
    id: '23',
    tocTitle: '영업브랜드',
    tocDesc: '운영사·배지·번호',
    group: '사용자등록',
    title: '영업브랜드 — 운영사 등록',
    sub: '한 업체 안에 <em>영업 브랜드(운영사)</em> 를 여러 개 두고 접수·정산·배지를 구분합니다.',
    shot: 's18_operating_brands.png',
    steps: [
      {
        title: '등록·수정',
        bullets: [
          '<em>새 브랜드</em> — 이름·표시명·접두 번호·배지 색·사업자 정보',
          '접수·스케줄·발주서에 <em>브랜드 배지</em> 표시',
        ],
      },
      {
        title: '연결 메뉴',
        bullets: ['사용자 등록 — 팀장·마케터 배정', '브랜드정책 — 배정·목록 규칙', '월정산표·타업체정산 — 브랜드별 분리'],
      },
    ],
  },
  {
    id: '24',
    tocTitle: '타업체등록',
    tocDesc: '협력업체·로그인',
    group: '사용자등록',
    title: '타업체등록 — 협력 업체',
    sub: '스케줄·접수 <em>타업체 배정</em>과 <em>타업체정산</em>에 쓰는 업체·로그인 계정을 등록합니다.',
    shot: 's18_external_companies.png',
    steps: [
      {
        title: '등록',
        bullets: [
          '업체명·사업자번호·연락처·메모',
          '타업체 전용 <em>로그인 이메일·비밀번호</em>',
          '담당자 이름·연락처',
        ],
      },
      { title: '목록', body: '<em>수정</em> · <em>비활성</em> — 더 이상 배정하지 않을 때. 접수·스케줄 배정 드롭다운에 표시됩니다.' },
    ],
  },
  {
    id: '25',
    tocTitle: '파트너연결',
    tocDesc: '업체 간 파트너',
    group: '사용자등록',
    title: '파트너연결 — 다른 업체와 연결',
    sub: '같은 청소비서를 쓰는 <em>다른 테넌트</em>와 파트너로 연결해 접수·정보공유를 주고받습니다.',
    shot: 's18_partners.png',
    steps: [
      {
        title: '상태',
        bullets: [
          '<em>승인 대기</em> — 승인/거절',
          '<em>연결됨</em> — 중지 가능',
          '<em>중지·거절됨</em>',
        ],
      },
      {
        title: '파트너 초대',
        bullets: ['파트너 초대 → 상대 <em>업체 코드(slug)</em> 입력', '초대 보내기 → 상대 ADMIN 승인 대기'],
      },
      { title: '연결 후', body: '<em>정보공유</em>·파트너 배정 접수 · 수수료는 <em>파트너정산</em>에서 확인.' },
    ],
  },
  {
    id: '26',
    tocTitle: '전자계약',
    tocDesc: '양식·체결 링크',
    group: '사용자등록',
    title: '전자계약 — 계약서 발급',
    sub: '팀장·마케터용 <em>전자계약서 양식</em>을 만들고 체결 링크를 발송·관리합니다.',
    shot: 's18_e_contracts.png',
    steps: [
      {
        title: '새 계약서',
        bullets: ['제목 입력', '수신 대상 — <em>팀장</em> / <em>마케터(링크)</em>', '<em>등록</em> 후 본문·필드 편집'],
      },
      {
        title: '하위 설정',
        bullets: [
          '<em>발행측(갑) 정보</em> — 서명·인감',
          '<em>체결·매핑 필드</em> — 접수 데이터 연결',
          '<em>체결 기록</em> — 서명 완료 이력',
        ],
      },
    ],
    tip: '마케터는 전용 포털이 없어 <em>체결 링크</em>를 직접 전달해야 합니다.',
  },
  {
    id: '27',
    tocTitle: '타업체정산',
    tocDesc: '수수료·지급·잔액',
    group: '정산',
    title: '타업체정산 — 협력업체 정산',
    sub: '타업체 배정 현장의 <em>수수료·미지급·지급 이력</em>을 영업 브랜드별로 관리합니다.',
    shot: 's18_external_settlement.png',
    steps: [
      {
        title: '화면 구성',
        bullets: ['영업 브랜드 칩 — 브랜드별 분리', '업체명 검색·새로고침', '누적·지급·잔액 요약'],
      },
      {
        title: '업체 행 버튼',
        bullets: ['<em>정산 내역</em> — 건별 수수료', '<em>지급 기록</em> — 송금 입력', '<em>지급 이력</em> — 과거 조회'],
      },
    ],
    tip: '정보공유 <em>인계 확정</em> 건은 인계 월 기준으로 잡힐 수 있습니다. 조회 월을 맞춰 보세요.',
  },
  {
    id: '28',
    tocTitle: '파트너정산',
    tocDesc: '수금·지급·CSV',
    group: '정산',
    title: '파트너정산 — 파트너 수수료',
    sub: '파트너 업체와의 <em>접수·DB 연계 수수료</em> 잔액을 보고 수금·지급을 기록합니다.',
    shot: 's18_partner_settlement.png',
    steps: [
      {
        title: '탭',
        bullets: [
          '<em>판매(받을 금액)</em> — 우리가 넘긴 DB',
          '<em>구매(지급할 금액)</em> — 가져온 DB',
        ],
      },
      {
        title: '행 작업',
        bullets: ['누적·수금/지급·잔액', '수금/지급 기록 · 정산 내역 · CSV'],
      },
    ],
    tip: '집계 기준은 <em>예약일(KST)</em> 입니다.',
  },
  {
    id: '29',
    tocTitle: '월정산표',
    tocDesc: '팀장·마케터·팀원 급여',
    group: '정산',
    title: '월정산표 — 월별 정산·급여',
    sub: '팀장·마케터·사무직·팀원 풀 등 <em>월별 정산</em>을 탭으로 나눠 확인·기록합니다.',
    shot: 's18_payroll.png',
    steps: [
      {
        title: '상단',
        bullets: ['귀속·지급 월(YYYY-MM)', '새로고침', '? 툴팁 — 탭별 규칙'],
      },
      {
        title: '탭',
        bullets: [
          '팀원 · 수입·지출 · 팀장 · 마케터 · 사무직 · 정산 · 미정산현황',
          '브랜드 여러 개면 수입·지출·정산 탭에 <em>브랜드 칩</em>',
        ],
      },
      { title: '사용', body: '행 클릭 → 상세 시트. 팀장·팀원 기본값은 <em>사용자 등록</em>·<em>팀원</em>에 미리 넣어 두면 자동 반영.' },
    ],
  },
  {
    id: '30',
    tocTitle: '팀장 실적',
    tocDesc: '월별 배정·완료',
    group: '직원관리',
    title: '팀장 — 월간 실적 집계',
    sub: '선택 <em>월(KST)</em> 기준 팀장별 배정·완료·미완료·취소 건수를 봅니다.',
    shot: 's18_leader_stats.png',
    steps: [
      { title: '조회', body: '조회 월 선택 → <em>조회</em>. 기준: <em>예약일</em>이 해당 월 + 그 팀장 배정.' },
      {
        title: '표 열',
        bullets: ['배정 — 전체', '완료 · 미완료 · 취소'],
      },
    ],
  },
  {
    id: '31',
    tocTitle: '팀원',
    tocDesc: '크루·휴무·그룹',
    group: '직원관리',
    title: '팀원 — 크루·공유 로그인',
    sub: '현장 투입 <em>팀원(크루)</em> 과 크루 앱 <em>공유 로그인 그룹</em>을 관리합니다. 스케줄 <em>팀원 가용</em>과 연동됩니다.',
    shot: 's18_team_members.png',
    steps: [
      {
        title: '팀 크루 그룹',
        bullets: ['새 그룹 — 여러 팀원이 하나의 크루 로그인', '집계 모드: 활성 전원 / 일자 명단만'],
      },
      {
        title: '팀원 목록',
        bullets: ['+ 등록 · 수정 · 휴무 · 삭제(비밀번호 확인)', '사용 OFF면 스케줄 가용에서 제외'],
      },
    ],
    tip: '팀장 로그인 계정은 <em>사용자 등록 → 팀장</em> 탭입니다.',
  },
  {
    id: '32',
    tocTitle: '휴일캘린더',
    tocDesc: '팀장·팀원 휴무',
    group: '직원관리',
    title: '휴일캘린더 — 휴무 한눈에',
    sub: '팀장·팀원 <em>휴무</em>를 월 달력으로 모아 봅니다. 등록은 팀장 화면 또는 <em>팀원</em> 메뉴에서 합니다.',
    shot: 's18_holiday_calendar.png',
    steps: [
      {
        title: '범례',
        bullets: ['노란 칸 — 팀장 휴무', '하늘색 — 팀원 휴무', '분홍 — 공휴일(참고)'],
      },
      {
        title: '조작',
        bullets: ['◀ ▶ · 이번 달', '날짜 클릭 → 그날 휴무 목록', '하단 팀장 휴무 현황 표'],
      },
    ],
    tip: '팀장 휴무 → 스케줄 <em>오전·오후 남은 자리</em> 감소. 팀원 휴무 → <em>👥 팀원 가용</em> 감소.',
  },
  {
    id: '33',
    tocTitle: '페이지설정',
    tocDesc: '접수 축하 바',
    group: '설정',
    title: '페이지설정 — 접수 축하 문구',
    sub: '새 접수·발주 알림 시 화면 상단 <em>축하 바</em> 문구를 이 브라우저에 저장합니다.',
    shot: 's18_page_settings.png',
    steps: [
      {
        title: '문구 구분',
        bullets: ['발주·발주서 출처일 때', '그 외 일반 접수일 때', '치환: {고객명} 등 — 화면 안내 참고'],
      },
      {
        title: '버튼',
        bullets: ['저장 — 이 PC·브라우저만', '기본값 되돌리기', '테스트 표시'],
      },
    ],
    warn: '다른 PC·시크릿 창에서는 따로 저장해야 합니다.',
  },
  {
    id: '34',
    tocTitle: '직원권한',
    tocDesc: '마케터 3단계',
    group: '설정',
    title: '직원권한 — 마케터 관리자 권한',
    sub: '마케터 <em>관리자 권한</em> 단계 설명과 실제 설정 위치(<em>사용자 등록 → 마케터</em>) 안내입니다.',
    shot: 's18_staff_access.png',
    steps: [
      {
        title: '권한 단계',
        bullets: [
          '<em>없음</em> — 접수·발주 기본만',
          '<em>일부</em> — 배정·고급 수정, 관리자 전용 GNB 숨김',
          '<em>전체</em> — 관리자와 동일 업무 메뉴(ADMIN 소유 기능 제외)',
        ],
      },
      { title: '설정', body: '「사용자 등록 · 마케터 탭으로 이동」→ 상세·수정 → 권한 저장. <em>ADMIN</em>만 변경 가능.' },
    ],
  },
  {
    id: '35',
    tocTitle: '브랜드정책',
    tocDesc: '배정·목록 규칙',
    group: '설정',
    title: '브랜드정책 — 영업 브랜드 규칙',
    sub: '영업 브랜드와 <em>배정·접수 목록</em>이 어떻게 묶일지 업체 전체 규칙을 정합니다.',
    shot: 's18_brand_policy.png',
    steps: [
      {
        title: '주요 옵션',
        bullets: [
          '<em>배정 모드</em> — 브랜드 일치 엄격/완화',
          '<em>팀장 목록 노출</em> — 마케터가 볼 팀장 범위',
          '<em>접수 기본 브랜드</em>',
        ],
      },
      { title: '저장', body: '변경 후 <em>저장</em> — 이후 배정·목록 필터에 반영. ADMIN은 정책과 무관하게 전체 접근.' },
    ],
  },
  {
    id: '36',
    tocTitle: '검수템플릿',
    tocDesc: '현장 체크리스트',
    group: '설정',
    title: '검수템플릿 — 현장 검수 항목',
    sub: '팀장 <em>현장 검수 체크리스트</em>를 공간(현관·주방 등)별로 편집합니다.',
    shot: 's18_inspection_template.png',
    steps: [
      {
        title: '편집',
        bullets: [
          '왼쪽 공간 선택 → 항목 추가·이름·순서·삭제',
          '저장 — 이후 새 검수부터 적용',
          '기본값 되돌리기',
        ],
      },
      { title: '연동', body: 'C/S에서 현장검수 요청 시 여기 저장한 항목이 팀장 체크리스트에 표시됩니다.' },
    ],
  },
  {
    id: '37',
    tocTitle: '팀장교육자료',
    tocDesc: 'PDF 업로드',
    group: '설정',
    title: '팀장교육자료 — 교육 PDF',
    sub: '현장 팀장이 팀 앱에서 볼 <em>교육자료 PDF</em> 를 업로드·교체합니다.',
    shot: 's18_team_leader_training.png',
    steps: [
      {
        title: '관리자 — 업로드',
        bullets: [
          'PDF 파일 선택 → 업로드',
          '등록된 파일명·용량 확인',
          '새 PDF로 교체 시 이전 파일 대체',
        ],
      },
      {
        title: '팀장 화면',
        body: '팀장 앱에서 <em>교육자료</em> 메뉴로 PDF 열람·다운로드. 등록 전에는 안내 문구만 표시됩니다.',
      },
    ],
  },
];

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSteps(steps) {
  let n = 0;
  return steps
    .map((step) => {
      n += 1;
      let inner = '';
      if (step.body) {
        inner += `<p>${step.body}</p>`;
      }
      if (step.bullets?.length) {
        inner += `<ul class="sub-li">${step.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`;
      }
      return `<div class="step">
          <div class="step-num">${n}</div>
          <div class="step-c">
            <strong>${step.title}</strong>
            ${inner}
          </div>
        </div>`;
    })
    .join('\n        ');
}

function renderSlide(slide, slideLabel) {
  const tip = slide.tip
    ? `<div class="tip-box"><div class="tip-t">💡 참고</div>${slide.tip}</div>`
    : '';
  const warn = slide.warn
    ? `<div class="warn-box"><div class="warn-t">⚠️ 주의</div>${slide.warn}</div>`
    : '';
  return `<!-- ══ SLIDE ${slide.id} ══ ${esc(slide.tocTitle)} -->
<div class="slide" id="slide-${slide.id}">
  <div class="slide-header">
    <span class="brand">청소<span>비서</span> 관리자 앱 사용설명서</span>
    <span class="slide-num">${slide.id} / ${TOTAL_SLIDES} — ${esc(slideLabel)}</span>
  </div>
  <div class="slide-body">
    <div class="pc-col">
      <img src="./screenshots/${slide.shot}" alt="${esc(slide.tocTitle)}">
      <p class="pc-shot-label">${esc(slide.tocTitle)} 화면 (스크린샷 교체 가능)</p>
    </div>
    <div class="desc-col">
      <div class="page-tag">관리자 전용 › ${esc(slide.group)}</div>
      <div class="page-title">${slide.title}</div>
      <div class="page-sub">${slide.sub}</div>
      <div class="step-list">
        ${renderSteps(slide.steps)}
      </div>
      ${tip}
      ${warn}
    </div>
  </div>
</div>
`;
}

const slideLabels = {
  18: '관리자 전용 개요',
  19: '가입정보',
  20: '사업자정보',
  21: '발송이메일',
  22: '사용자 등록',
  23: '영업브랜드',
  24: '타업체등록',
  25: '파트너연결',
  26: '전자계약',
  27: '타업체정산',
  28: '파트너정산',
  29: '월정산표',
  30: '팀장 실적',
  31: '팀원 관리',
  32: '휴일캘린더',
  33: '페이지설정',
  34: '직원권한',
  35: '브랜드정책',
  36: '검수템플릿',
  37: '팀장교육자료',
};

const adminHtml = ADMIN_SLIDES.map((s) => renderSlide(s, slideLabels[s.id] ?? s.tocTitle)).join('\n');

const htmlPath = path.join(helpDir, 'marketer-guide.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/ \/ 18 —/g, ` / ${TOTAL_SLIDES} —`);
html = html.replace(/<!-- ══ SLIDE 18 ══[\s\S]*?(?=\n\n<\/div><!-- \/page-wrapper -->)/, adminHtml.trim() + '\n\n');
html = html.replace(/\0+$/g, '');
fs.writeFileSync(htmlPath, html, 'utf8');

const tocPath = path.join(helpDir, 'marketer-guide.toc.json');
const existingToc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
const baseToc = existingToc.filter((c) => Number(c.id) < ADMIN_START);
const adminToc = ADMIN_SLIDES.map((s) => ({
  id: s.id.padStart(2, '0'),
  anchor: `slide-${s.id}`,
  title: s.tocTitle,
  desc: s.tocDesc,
}));
fs.writeFileSync(tocPath, JSON.stringify([...baseToc, ...adminToc], null, 2) + '\n', 'utf8');

const htmlTocBlock = [...baseToc, ...adminToc]
  .map((c) => {
    const hl = c.id === '18' ? ' toc-highlight' : '';
    return `    <div class="toc-item${hl}"><div class="toc-num">${c.id}</div><div class="toc-name">${c.title}</div><div class="toc-desc">${c.desc}</div></div>`;
  })
  .join('\n');
html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(
  /<div class="toc-grid">[\s\S]*?<\/div>\s*<\/div>\s*\n\n<!-- ══ SLIDE 01/,
  `<div class="toc-grid">\n${htmlTocBlock}\n  </div>\n</div>\n\n<!-- ══ SLIDE 01`,
);
fs.writeFileSync(htmlPath, html, 'utf8');

const shotMap = {
  's18_subscription.png': 'admin_업체_설정_업체_등록정보.png',
  's18_business.png': 'admin_업체_설정_업체_등록정보.png',
  's18_outbound_email.png': 'admin_업체_설정_업체_등록정보.png',
  's18_users.png': 'admin_팀장_팀_관리_팀장_목록.png',
  's18_operating_brands.png': 'admin_운영사_운영사_관리.png',
  's18_external_companies.png': 'admin_팀장_팀_관리_팀장_목록.png',
  's18_partners.png': 'admin_파트너_파트너_업체.png',
  's18_e_contracts.png': 'admin_전자계약_전자계약_목록.png',
  's18_external_settlement.png': 'admin_정산_외부업체_정산.png',
  's18_partner_settlement.png': 'admin_파트너_파트너_정산.png',
  's18_payroll.png': 'admin_정산_급여_정산.png',
  's18_leader_stats.png': 'admin_팀장_팀_관리_팀장_통계.png',
  's18_team_members.png': 'admin_팀장_팀_관리_팀_관리.png',
  's18_holiday_calendar.png': 'admin_팀장_팀_관리_팀_휴무_캘린더.png',
  's18_page_settings.png': 'admin_업체_설정_고객_페이지_설정.png',
  's18_staff_access.png': 'admin_팀장_팀_관리_팀장_목록.png',
  's18_brand_policy.png': 'admin_운영사_운영사_관리.png',
  's18_inspection_template.png': 'admin_현장검수_현장검수_템플릿.png',
  's18_team_leader_training.png': 's16_team_leaders.png',
};

for (const [dest, src] of Object.entries(shotMap)) {
  const from = path.join(shotsDir, src);
  const to = path.join(shotsDir, dest);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
  } else if (fs.existsSync(path.join(shotsDir, 's16_team_leaders.png'))) {
    fs.copyFileSync(path.join(shotsDir, 's16_team_leaders.png'), to);
  }
}

const screenshotsPath = path.join(helpDir, 'marketer-guide.screenshots.json');
const existingShots = JSON.parse(fs.readFileSync(screenshotsPath, 'utf8'));
const filtered = existingShots.filter((s) => {
  if (s.filename === 's16_team_leaders.png') return false;
  if (s.filename.startsWith('s18_')) return false;
  return true;
});

const adminShots = ADMIN_SLIDES.filter((s) => s.id !== '18').map((s) => ({
  filename: s.shot,
  label: s.tocTitle,
  chapterIds: [s.id.padStart(2, '0')],
}));
adminShots.unshift({
  filename: 's16_team_leaders.png',
  label: '관리자 전용 개요',
  chapterIds: ['18'],
});

fs.writeFileSync(screenshotsPath, JSON.stringify([...filtered, ...adminShots], null, 2) + '\n', 'utf8');

const serverTs = path.join(repoRoot, 'server/src/modules/help/marketerGuideScreenshots.ts');
let ts = fs.readFileSync(serverTs, 'utf8');
const files = [
  's02_dashboard.png',
  's04_inquiries.png',
  's06_order_issue.png',
  's07_order_forms.png',
  's08_quotations.png',
  's09_cs.png',
  's10_payback.png',
  's11_advertising.png',
  's14_ad_settings.png',
  's15_schedule.png',
  's15d_schedule_day.png',
  's15b_messages.png',
  's15e_messages_notice.png',
  's15c_db_marketplace.png',
  's15f_db_cart.png',
  's16_team_leaders.png',
  ...Object.keys(shotMap),
];
const uniqueFiles = [...new Set(files)];
ts = ts.replace(
  /export const MARKETER_GUIDE_SCREENSHOT_FILENAMES = \[[\s\S]*?\] as const;/,
  `export const MARKETER_GUIDE_SCREENSHOT_FILENAMES = [\n${uniqueFiles.map((f) => `  '${f}',`).join('\n')}\n] as const;`,
);
fs.writeFileSync(serverTs, ts, 'utf8');

console.log(`Updated marketer guide: ${ADMIN_SLIDES.length} admin slides, ${TOTAL_SLIDES} total slides.`);
