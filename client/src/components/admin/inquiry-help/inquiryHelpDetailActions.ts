/** 접수 상세(ScheduleInquiryDetailModal) — 버튼·액션 도움말 */

export type InquiryHelpActionRow = {
  label: string;
  meaning: string;
  when?: string;
};

export type InquiryHelpActionSection = {
  title: string;
  intro?: string;
  rows: readonly InquiryHelpActionRow[];
};

const btn = (label: string, meaning: string, when?: string): InquiryHelpActionRow => ({
  label,
  meaning,
  when,
});

/** 자사 팀장 · 타업체 · 파트너 직접연계 · 정보공유 — 상호 배타 관계 */
export const INQUIRY_HELP_DETAIL_ASSIGNMENT_MODEL: readonly InquiryHelpActionRow[] = [
  btn(
    '자사 팀장·팀원 (6번 배정)',
    '우리 업체 팀장·크루에 현장을 배정합니다. 스케줄·팀장 앱과 동기화됩니다.',
  ),
  btn(
    '타업체 담당 (4번 select)',
    'EXTERNAL_PARTNER 역할의 타업체 담당자에게 넘깁니다. 파트너 직접 연계·정보공유와 동시에 쓸 수 없습니다. 해제 후 다른 방식을 선택하세요.',
  ),
  btn(
    '파트너 직접 연계 (4번 「파트너에 접수 연계」)',
    '연결된 파트너 업체 1곳에 접수를 복제합니다. 수정·완료·취소는 양쪽에 반영됩니다. 타업체 담당과 둘 중 하나만 가능합니다.',
  ),
  btn(
    '정보공유 — DB 마켓 (4번 패널)',
    '여러 파트너·타업체에 공개해 인수 신청을 받습니다. 인계 확정 후 파트너 연계와 동일하게 mirror 접수가 생깁니다. 직접 연계 중이거나 타업체 담당이 있으면 비활성화됩니다.',
  ),
];

export const INQUIRY_HELP_DETAIL_HEADER_ACTIONS: readonly InquiryHelpActionRow[] = [
  btn('보기', '고객 정보 시트를 엽니다. 카카오·문자에 붙여넣기 좋은 형식으로 정리되어 있으며, 시트 안에서도 배정·저장·복사가 가능합니다.'),
  btn('복사', '접수 요약(고객·일정·금액 등)을 클립보드에 복사합니다. 「보기」 시트의 「정보 복사」와 유사합니다.'),
  btn('수기등록', '신규 접수 전용 — 체크 시 발주서 없이 수기로 등록하는 모드입니다.', '신규 접수'),
  btn('HC완료 / HC초과 / HC미완', '해피콜(작업 전날 밤까지 연락) 상태입니다. 목록 행색·스케줄과 연동됩니다.', '팀장 배정·예약일 있을 때'),
  btn('파트너 연계 배지', 'SOURCE(내가 연계) / TARGET(받은 접수). 정보공유 경로면 「정보공유」 칩이 함께 표시됩니다.', '연계·인계 건'),
  btn('정보공유 배지', '준비 · 공유 중 · 인계 대기 · 인계 완료 등 마켓 단계를 헤더에서 확인합니다.', '정보공유 등록 건'),
  btn('금액 설정 필요 / 완료', '고객이 전문 시공 옵션을 선택했을 때 — 상단 배너에서 「추가 시공 금액 저장」으로 5번 추가결재에 반영합니다.', '전문 시공 옵션'),
  btn('팀장 1슬롯 경고', '해당 예약일 팀장 TO(정원)를 초과하면 헤더에 경고가 뜹니다. 3번 달력·6번 배정과 함께 확인하세요.', 'TO 초과'),
];

export const INQUIRY_HELP_DETAIL_FAB_ACTIONS: readonly InquiryHelpActionRow[] = [
  btn('▲ 이전 섹션', '바로 위 번호 섹션으로 스크롤합니다.'),
  btn('⋮ 드래그', 'FAB 위치를 세로로 옮깁니다. 긴 폼에서 가리는 필드를 피할 때 사용합니다.'),
  btn('▼ 다음 섹션', '바로 아래 번호 섹션으로 스크롤합니다.'),
  btn('1~11 점', '고정 번호 섹션으로 즉시 이동합니다. 제목은 「고객·주소」~「변경 이력」과 동일합니다.'),
];

export const INQUIRY_HELP_DETAIL_PARTNER_ACTIONS: readonly InquiryHelpActionRow[] = [
  btn(
    '정보공유로 등록하기',
    '파트너 1곳 직접 연계 대신, 아래 정보공유 패널로 넘어가며 파트너·수수료 값을 미리 채웁니다. 여러 업체에 공개할 때 사용합니다.',
    '파트너 미연계 · 타업체 담당 없음',
  ),
  btn('파트너 업체 + 파트너 수수료', '연계할 파트너 1곳과 정산 수수료(원)를 입력합니다.'),
  btn(
    '고객·일정만 연계 (체크)',
    '금액·메모·상담사진은 보내지 않고 고객·일정만 복제·동기화합니다. 상담사진은 체크 해제(전체 연계)일 때만 공유됩니다.',
  ),
  btn(
    '접수 연계',
    '선택한 파트너 접수 목록에 mirror 접수를 만듭니다. 이후 고객·일정·금액 등(연계 범위) 수정이 양쪽에 반영되고, 완료·취소도 연동됩니다.',
  ),
  btn('파트너 수수료 저장', '이미 연계된 SOURCE 건의 수수료만 수정합니다. 파트너 정산·수신 업체 잔금에 반영됩니다.', '연계 후 SOURCE'),
  btn('접수연계 취소', '파트너 mirror 접수 연계를 끊습니다. 파트너 쪽 접수 처리 상태에 따라 제한될 수 있습니다.', '연계 후 SOURCE'),
];

export const INQUIRY_HELP_DETAIL_MARKETPLACE_ACTIONS: readonly InquiryHelpActionRow[] = [
  btn('공유 준비', '수수료·노출 대상을 입력한 뒤 draft로 저장합니다. 아직 다른 업체에 보이지 않습니다.'),
  btn('노출 / 노출 대상', '「연결된 전체」 또는 특정 파트너·타업체 선택, 「동시 노출」 vs 「순위 노출」을 설정합니다.'),
  btn('정보공유 게시 / 다시 공유', '설정한 대상에게 접수가 노출됩니다. 인수 신청을 받을 수 있습니다.'),
  btn('공유 철회', '공유 중인 listing을 내립니다. 인수 전이면 다시 게시할 수 있습니다.'),
  btn('인계 확정', '인수 신청을 받은 뒤, 공유 측(판매자)이 최종 확정합니다. 파트너 mirror 접수가 생성·연계됩니다.', '인수 신청 후'),
  btn('인수 신청 거절', '인수 신청을 거절합니다. 순위 노출이면 다음 순위 업체로 넘어갈 수 있습니다.', '인수 신청 후'),
  btn(
    '완전 회수',
    '인계 완료 건을 일반 접수(TO 포함)로 되돌립니다. 비밀번호 확인 후 실행. 하위 재공유가 있으면 함께 처리됩니다.',
    '인계 완료(CONFIRMED)',
  ),
  btn('공유 준비로', '인계 완료 건을 정보공유 준비 상태로만 되돌립니다(TO 제외). 비밀번호 확인 후 실행.', '인계 완료(CONFIRMED)'),
  btn('정보공유 목록에서 보기', '관리 → 정보공유 메뉴의 해당 listing으로 이동합니다.'),
  btn('스케줄에서 접수 보기', '관리 스케줄에서 이 접수 카드를 엽니다.'),
];

export const INQUIRY_HELP_DETAIL_SECTION_ACTIONS: readonly InquiryHelpActionSection[] = [
  {
    title: '3. 일정',
    intro: '예약일·TO·팀장 분배 가능일을 확인합니다.',
    rows: [
      btn('달력·분배 가능일 →', '예약일 선택 모달을 엽니다. 팀장 TO·분배 가능일·권역을 달력에서 확인하며 날짜를 고릅니다.'),
      btn('날짜 변경', '신규 접수에서 예약일이 잠겨 있을 때 잠금을 풀고 다시 고릅니다.', '신규 + 날짜 잠금'),
      btn('미정 (추후 확정)', '이사일 등을 아직 모를 때 체크합니다.'),
    ],
  },
  {
    title: '4. 정산 · 옵션 — 타업체',
    rows: [
      btn('타업체 담당 (select)', '타업체 EXTERNAL_PARTNER 1명을 지정합니다. 자사 팀장 배정·파트너 연계·정보공유와 배타적입니다.'),
      btn('타업체 수수료 (원)', '타업체 정산 수수료입니다. 타업체 담당 선택 시 입력합니다.'),
    ],
  },
  {
    title: '4. 정산 · 옵션 — 전문 시공',
    rows: [
      btn('다시 불러오기', '전문 시공 옵션 카탈로그를 서버에서 다시 가져옵니다.'),
      btn('옵션 체크 / 제거', '선택한 전문 시공 옵션 ID를 접수에 붙입니다. 비활성 항목은 「제거」로 정리합니다.'),
    ],
  },
  {
    title: '5. 결제 금액 내역 (추가결재)',
    rows: [
      btn('펼치기 / 접기', '추가결재 블록을 접거나 펼칩니다.'),
      btn('수정 / − 삭제', '기존 추가결재 행을 편집·삭제합니다. 즉시 API 반영.'),
      btn('저장 (행)', '새 추가결재 또는 편집 내용을 저장합니다.'),
      btn('+1천 / +5천 / +1만 / +10만 / ±부호 / 지우기', '금액 빠른 입력 패드입니다.'),
      btn('현장결재 / 회사입금', '수금 방식 라디오 — 저장 전 선택해야 합니다.'),
    ],
  },
  {
    title: '6. 상태 · 배정 · 팀원 · 메모',
    intro: '상태 변경 후 하단 「저장」이 필요합니다. 배정은 파트너·타업체와 배타 규칙을 확인하세요.',
    rows: [
      btn('상태 (select)', '대기·접수·입금대기·입금완료·미제출·분배완료·진행중·완료·보류·취소·C/S 처리중 등. 목록 StatusQuickPicker와 동일 값.'),
      btn('발주서 강제 매칭', '펼치면 미매칭 발주서를 이 접수에 강제로 연결합니다. 「이 접수에 강제 매칭」은 즉시 API.'),
      btn('+ 팀장·팀원 세트 추가', '팀장 1명 + 팀원 N명 세트를 추가합니다. 다중 팀장 현장에 사용합니다.'),
      btn('제거 / ×', '해당 팀장·팀원 세트를 삭제합니다.'),
      btn('팀장변경', '다른 접수와 팀장을 교차 스왑합니다. 후보 선택 후 「교환」.', '교차 변경 가능 시'),
      btn('팀원변경', '다른 접수와 팀원을 교차 스왑합니다.', '교차 변경 가능 시'),
      btn('팀장 단독 · 크루 없음', '팀장만 배정하고 크루 슬롯을 비웁니다.'),
      btn('크게보기 →', '특이사항·일정 메모 textarea를 큰 창으로 펼칩니다.'),
    ],
  },
  {
    title: '7. 상담·참고',
    rows: [
      btn('파일에서 선택', '상담 중 촬영·참고 사진 업로드 영역을 펼칩니다.'),
      btn('이미지 선택 (여러 장)', '마케터 상담 사진을 업로드합니다. 고객 발주서 사진(8번)과 별도입니다.'),
      btn('삭제 (썸네일)', '상담 사진 삭제 — 비밀번호 확인 후 영구 삭제.'),
    ],
  },
  {
    title: '8. 발주서 첨부 사진',
    rows: [
      btn('다시 시도', '고객 업로드 사진 목록 재로드.'),
      btn('전체 보기 (N장)', '라이트박스로 고객 발주서 사진을 봅니다. 목록 「사진 O/X」 기준과 동일.'),
    ],
  },
  {
    title: '9. 현장 검수·완료',
    rows: [
      btn('PDF 다운로드 / 사진 ZIP', '검수 결과 PDF·사진 묶음 다운로드.', '검수 모듈 사용 시'),
      btn('고객 열람 링크 복사', '고객에게 보낼 검수 열람 URL 복사.'),
      btn('이메일 재발송', '검수 완료 메일을 다시 보냅니다.'),
      btn('무효 처리', '관리자만 — 검수본을 VOID로 처리합니다.'),
    ],
  },
  {
    title: '10. 현장 사진',
    rows: [
      btn('사진 올리기', '청소 전·후 현장 사진 업로드 영역.'),
      btn('삭제 (썸네일)', '현장 사진 삭제 — 비밀번호 확인.'),
    ],
  },
  {
    title: '번호 없음 · 추가 블록',
    rows: [
      btn('일반 접수 / 예약금 대기 / 부재 후속 / 보류 후속', '신규 등록 시 첫 단계(워크플로)를 고릅니다. 이후 상태·입금 흐름이 달라집니다.', '신규 접수'),
      btn('추가 시공 금액 저장', '전문 시공 옵션 금액을 확정해 총액·5번 추가결재에 반영합니다. 하단 「저장」과 별도 API.', '금액 설정 필요'),
      btn('+ 견적서 만들기', '이 접수에 연결할 견적서 작성 페이지로 이동.', '견적 기능'),
      btn('내 추가 캘린더 (체크)', '맞춤 캘린더에 이 접수를 수동으로 pin/unpin합니다.', '맞춤 캘린더'),
      btn('클레임 (참고)', '읽기 전용 — 목록 ● 표시와 연동. 목록 「클레임」 버튼으로 등록.'),
    ],
  },
];

/** 모달 스크롤 순 — 1번 섹션 위 */
export const INQUIRY_HELP_DETAIL_PRE_SECTION1_ACTIONS: readonly InquiryHelpActionRow[] =
  INQUIRY_HELP_DETAIL_SECTION_ACTIONS.find((s) => s.title === '번호 없음 · 추가 블록')!.rows.filter((r) =>
    ['일반 접수 / 예약금 대기 / 부재 후속 / 보류 후속', '추가 시공 금액 저장'].includes(r.label),
  );

/** 3번 일정 다음 — 번호 없음 */
export const INQUIRY_HELP_DETAIL_AFTER_SCHEDULE_ACTIONS: readonly InquiryHelpActionRow[] =
  INQUIRY_HELP_DETAIL_SECTION_ACTIONS.find((s) => s.title === '번호 없음 · 추가 블록')!.rows.filter((r) =>
    r.label.includes('내 추가 캘린더'),
  );

/** 8번 발주서 사진 다음 — 견적서 */
export const INQUIRY_HELP_DETAIL_AFTER_ORDER_PHOTOS_ACTIONS: readonly InquiryHelpActionRow[] =
  INQUIRY_HELP_DETAIL_SECTION_ACTIONS.find((s) => s.title === '번호 없음 · 추가 블록')!.rows.filter((r) =>
    r.label.includes('견적서'),
  );

/** 7번과 8번 사이 — 클레임 */
export const INQUIRY_HELP_DETAIL_CLAIM_ACTIONS: readonly InquiryHelpActionRow[] =
  INQUIRY_HELP_DETAIL_SECTION_ACTIONS.find((s) => s.title === '번호 없음 · 추가 블록')!.rows.filter((r) =>
    r.label.includes('클레임'),
  );

export const INQUIRY_HELP_DETAIL_FOOTER_ACTIONS: readonly InquiryHelpActionRow[] = [
  btn('저장 / 저장 중…', '폼 필드(상태·배정·금액·메모 등) 변경을 반영합니다. 목록·스케줄·팀장 화면에 WebSocket으로 갱신됩니다.'),
  btn('등록 / 등록 중…', '신규 접수를 처음 DB에 만듭니다.', '신규 접수'),
  btn('삭제', '1차 확인 → 비밀번호 확인 → 휴지통(또는 영구 삭제 정책). 권한·역할에 따릅니다.'),
  btn('닫기 (하단·헤더 X)', '모달을 닫습니다. 저장하지 않은 변경이 있으면 확인합니다.'),
];

export const INQUIRY_HELP_DETAIL_COPY_SHEET_ACTIONS: readonly InquiryHelpActionRow[] = [
  btn('저장', '시트를 연 채로 접수 폼 저장 — 모달은 닫히지 않습니다.'),
  btn('정보 복사', '시트 내용 클립보드 복사.'),
  btn('배정 패널', '시트 안에서도 팀장·팀원·교차변경 UI를 쓸 수 있습니다(6번과 동일 규칙).'),
];
