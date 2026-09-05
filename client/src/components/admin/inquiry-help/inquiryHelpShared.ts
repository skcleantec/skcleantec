/** 서비스접수 목록 도움말 — AdminInquiriesPage · InquiryHelpModal 공통 */

export const INQUIRY_PAGE_OVERVIEW_HELP =
  '전화·발주서·수기 등 모든 접수를 조회·수정하는 화면입니다. 행(또는 모바일 카드)을 누르면 접수 상세 모달이 열립니다. 위 「이용 순서」 번호를 누르면 사용법·아이콘·색·설정 안내가 나옵니다.';

export type InquiryHelpTabId = 'list' | 'detail';

export const INQUIRY_HELP_TABS: ReadonlyArray<{ id: InquiryHelpTabId; label: string }> = [
  { id: 'list', label: '접수 목록' },
  { id: 'detail', label: '접수 상세' },
];

/** 목록 상태 필터·StatusQuickPicker 와 동일 */
export const INQUIRY_HELP_STATUS_ROWS: ReadonlyArray<{ icon: string; label: string; meaning: string }> = [
  { icon: '🔗', label: '미제출', meaning: '발주서 링크만 발급 · 고객 미제출 — 목록 상단 고정(tier 0)' },
  { icon: '✅', label: '입금완료', meaning: '예약금 입금 확인 — 상단 고정(tier 1)' },
  { icon: '💰', label: '입금대기', meaning: '예약금 대기 — 상단 고정(tier 2)' },
  { icon: '🕒', label: '대기', meaning: '발주·예약 전 — 상단 고정(tier 3)' },
  { icon: '📝', label: '예약완료', meaning: '고객 발주서 제출 등 정상 접수(RECEIVED)' },
  { icon: '📌', label: '분배완료', meaning: '팀장 배정 완료' },
  { icon: '🚚', label: '진행중', meaning: '현장 작업 진행' },
  { icon: '🏁', label: '완료', meaning: '작업·정산 완료' },
  { icon: '⏸️', label: '보류', meaning: '일정·연락 보류 — 카드 노란 테두리' },
  { icon: '🛑', label: '취소', meaning: '접수 취소' },
  { icon: '🛠️', label: 'C/S 처리중', meaning: 'C/S 후속 작업 중 — 목록에서 「완료」 처리 가능' },
];

/** 접수번호 — 별도 버튼 없음, 표시·검색·상세 연동 */
export const INQUIRY_HELP_INQUIRY_NUMBER_ROWS: ReadonlyArray<{ where: string; usage: string }> = [
  {
    where: 'PC — 접수일 열 아래 회색 글씨',
    usage:
      'CB2608010001 형식. 행 어디를 눌러도 접수 상세가 열립니다. 상단 검색창에 접수번호를 넣으면 해당 건을 찾을 수 있습니다.',
  },
  {
    where: '모바일 — 고객명 옆 검은 칩',
    usage: '같은 접수번호입니다. 칩만 따로 누르는 버튼은 없고, 카드 본문·상태 줄을 누르면 상세로 이동합니다.',
  },
  {
    where: '접수 상세 모달 헤더',
    usage: '「접수 상세」 탭 — 번호 옆 복사로 카카오·메모에 붙여넣기. 고객에게 보낼 때는 발주서·메시지 기능을 사용합니다.',
  },
];

export const INQUIRY_HELP_PIN_TIER_ROWS: ReadonlyArray<{ color: string; label: string; meaning: string }> = [
  { color: 'bg-rose-100', label: '미제출', meaning: '발주서 미제출 — 날짜·상태 필터와 무관하게 최상단' },
  { color: 'bg-emerald-100', label: '입금완료', meaning: '입금 확인 후 처리 대기 — 상단 고정' },
  { color: 'bg-sky-100', label: '입금대기', meaning: '예약금 입금 대기 — 상단 고정' },
  { color: 'bg-amber-100', label: '대기', meaning: '발주·예약 전 — 상단 고정' },
];

export type InquiryHelpDetailSection = {
  num: number;
  title: string;
  summary: string;
  fields: ReadonlyArray<{ name: string; desc: string }>;
};

/** ScheduleInquiryDetailModal 섹션 번호·제목과 동일 */
export const INQUIRY_HELP_DETAIL_SECTIONS: readonly InquiryHelpDetailSection[] = [
  {
    num: 1,
    title: '고객 · 주소',
    summary: '고객 식별·연락·주소·유입 경로',
    fields: [
      { name: '성함 · 닉네임', desc: '목록·스케줄에 표시되는 고객명. 내부 톤(색)으로 구분 가능' },
      { name: '유입(리드)', desc: '광고·플랫폼 등 접수 경로 — 목록 유입 열과 연동' },
      { name: '연락처', desc: '전화·문자. 모바일 목록 「전화」 버튼과 연결' },
      { name: '주소 검색', desc: '도로명/지번 검색 후 상세 주소 입력' },
    ],
  },
  {
    num: 2,
    title: '유형 · 면적 · 방·주방',
    summary: '원룸·평수·방/화/베/주방 — 견적·스케줄 표시에 반영',
    fields: [
      { name: '원룸 · 건축물 유형', desc: '원룸 라벨·면적 기준에 영향' },
      { name: '평수 · 기준', desc: '공급/전용 면적. 목록에서 더블클릭 빠른 수정 가능' },
      { name: '방 · 화 · 베 · 주방', desc: '현장 규모 파악용' },
    ],
  },
  {
    num: 3,
    title: '일정',
    summary: '예약일·시간대·사이청소·이사일',
    fields: [
      { name: '예약일', desc: '「달력·분배 가능일」로 팀장 TO 확인. 목록·스케줄 기준일' },
      { name: '시간대 · 사이청소 확정', desc: '오전/오후/사이 — 스케줄 슬롯·미배정 구역에 반영' },
      { name: '이사일 · 신축/구축', desc: '입주·이사 청소 맥락' },
      { name: '고객 발주서 특이사항', desc: '고객이 발주서에 적은 일정 메모(읽기 전용)' },
    ],
  },
  {
    num: 4,
    title: '정산 · 옵션',
    summary: '총액·예약금·잔금·타업체·정보공유',
    fields: [
      { name: '총액 · 예약금 · 잔금', desc: '목록·정산·발주서와 동기화' },
      { name: '타업체 담당 · 수수료', desc: '자사 팀장과 상호 배타. EXTERNAL_PARTNER 배정' },
      { name: '파트너 연계', desc: 'SOURCE/TARGET 연계 접수 표시' },
      { name: '정보공유 등록', desc: 'DB 마켓플레이스 — 목록 카트 아이콘과 연동' },
    ],
  },
  {
    num: 5,
    title: '결제 금액 내역',
    summary: '추가 결제·옵션 금액 라인',
    fields: [{ name: '추가 결제 항목', desc: '전문시공 옵션 등 금액 내역 — 검토 배지와 연동' }],
  },
  {
    num: 6,
    title: '상태 · 배정 · 팀원 · 메모',
    summary: '상태 변경·팀장·팀원·특이사항(6번)',
    fields: [
      { name: '상태', desc: '목록 StatusQuickPicker 와 동일 값' },
      { name: '마케터 · 브랜드', desc: '접수 귀속·운영사 표시' },
      { name: '팀장 · 팀원', desc: '다중 팀장/팀원. 스케줄 배정과 동기화' },
      { name: '권역', desc: '서비스 권역 규칙' },
      { name: '특이사항(6번)', desc: '관리자·팀장 공유 메모 — 목록 「특이사항 O/X」 와 별도' },
      { name: '일정 메모', desc: '스케줄 카드 「메모」 버튼과 연동' },
    ],
  },
  {
    num: 7,
    title: '상담·참고 (사진·마케터 메모)',
    summary: '상담 중 촬영·내부 참고',
    fields: [
      { name: '상담 사진', desc: '마케터가 올린 참고 사진' },
      { name: '마케터 메모', desc: '고객 비노출 내부 메모' },
    ],
  },
  {
    num: 8,
    title: '발주서 첨부 사진',
    summary: '고객이 발주서에 업로드한 사진',
    fields: [{ name: '고객 업로드', desc: '목록 「사진첨부 O/X」 — orderForm 사진 기준' }],
  },
  {
    num: 9,
    title: '현장 검수 · 완료',
    summary: '검수 템플릿·완료 처리(모듈 사용 시)',
    fields: [{ name: '검수 진행', desc: '목록 현장검수 열 배지와 동일' }],
  },
  {
    num: 10,
    title: '현장 사진 (청소 전·후)',
    summary: '팀장·크루 현장 사진',
    fields: [
      { name: '청소 전 · 후', desc: '현장 검수·고객 전달용' },
    ],
  },
  {
    num: 11,
    title: '변경 이력',
    summary: '날짜·금액·상태 변경 로그',
    fields: [{ name: 'InquiryChangeLog', desc: '최고 관리자만 이력 삭제 가능(비밀번호 확인)' }],
  },
];
