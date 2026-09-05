import type { WorkflowGuideSurface } from '../../../utils/staffWorkflowGuideStorage';

export type WorkflowGuideSection = {
  title: string;
  items: readonly string[];
};

export type WorkflowGuideStep = {
  id: string;
  n: number;
  label: string;
  tip: string;
  sections: readonly WorkflowGuideSection[];
  /** 클릭 시 이동. 없으면 현재 화면에서 안내만 */
  to?: string;
  scrollSection?: 'status' | 'settlement';
  match?: (pathname: string) => boolean;
};

export const INQUIRY_WORKFLOW_STEPS: readonly WorkflowGuideStep[] = [
  {
    id: 'register',
    n: 1,
    label: '등록',
    to: '/admin/inquiries',
    tip: '전화로 받은 건은 접수목록 「일반 등록」으로 넣습니다. 아직 예약이 아니면 옆 「부재·보류」입니다.',
    match: (p) => p === '/admin/inquiries',
    sections: [
      {
        title: '사용법',
        items: [
          '접수목록에서 「일반 등록」을 눌러 고객·일정·금액을 적습니다.',
          '아직 연락이 안 되거나 고민 중이면 옆 메뉴 「부재·보류」에 둡니다.',
          '행(모바일은 카드)을 누르면 상세가 열립니다.',
        ],
      },
      {
        title: '아이콘',
        items: [
          '🔗 미제출 — 발주서 링크만 보냄',
          '📝 예약완료 — 고객이 발주서를 낸 뒤',
          '📌 분배완료 — 팀장 배정 끝',
        ],
      },
      {
        title: '색',
        items: [
          '목록 맨 위 줄 색은 아직 처리 전입니다. 분홍 미제출 · 초록 입금완료 · 하늘 입금대기 · 노란 대기.',
          '그 아래가 날짜 필터에 맞는 일반 접수입니다.',
        ],
      },
      {
        title: '설정',
        items: [
          '목록 제목 옆 「?」에서 접수 목록·상세를 봅니다.',
          '이 안내를 숨겼다면 「페이지설정」에서 「서비스접수에서 이용 순서 보기」를 켜세요.',
        ],
      },
    ],
  },
  {
    id: 'followup',
    n: 2,
    label: '부재·보류',
    to: '/admin/inquiries/followup',
    tip: '아직 예약이 안 된 전화 건을 여기서 추적합니다. 「입금 완료」로 바꾸면 접수목록으로 이어집니다.',
    match: (p) => p.startsWith('/admin/inquiries/followup'),
    sections: [
      {
        title: '사용법',
        items: [
          '「+ 등록」으로 부재·보류 건을 넣거나, 목록 행을 눌러 상태를 바꿉니다.',
          '다시 전화했는데 또 없으면 「부재+1」로 횟수를 쌓습니다.',
          '예약금을 받기로 하면 「예약금 대기」→「입금 완료」 순으로 바꿉니다.',
        ],
      },
      {
        title: '아이콘',
        items: [
          '부재 · 보류·고민 — 아직 확정 전',
          '예약금 대기 — 입금 기다리는 중',
          '입금 완료 — 접수목록으로 넘어간 뒤',
          '골드DB — 집중 관리할 건(노란 배경 행)',
        ],
      },
      {
        title: '색',
        items: ['골드DB로 표시한 행은 노란 배경입니다. 「골드DB만」을 켜면 그 행만 보입니다.'],
      },
      {
        title: '설정',
        items: [
          '위쪽 기간에서 「등록일」 또는 「희망일」을 고른 뒤 오늘·전체·월별·일별로 좁힙니다.',
          '전체 흐름은 도움말 「이용 순서 → 접수부터 팀장 배정까지」를 보세요.',
        ],
      },
    ],
  },
  {
    id: 'issue',
    n: 3,
    label: '발주서 발급',
    to: '/admin/inquiries/order-issue',
    tip: '「대기 접수 연결」을 하면 접수목록·스케줄이 한 줄로 이어집니다. 연결 없이 내면 발주서 목록에만 남을 수 있습니다.',
    match: (p) => p.startsWith('/admin/inquiries/order-issue'),
    sections: [
      {
        title: '사용법',
        items: [
          '양식을 고른 뒤 「대기 접수 연결」에서 접수목록의 대기·미제출 건을 잇습니다.',
          '상담에서 이미 아는 칸만 채우고 발급합니다. 빈 칸은 고객이 적습니다.',
          '발급이 끝나면 「링크 복사」로 카카오·문자에 붙여 보냅니다.',
        ],
      },
      {
        title: '아이콘',
        items: ['「설정」 — 칸마다 고객·마케터·필수를 정합니다.', '「?」 — 그 칸이 무엇을 묻는지 봅니다.'],
      },
      {
        title: '색',
        items: ['잠긴 칸은 상담사가 이미 채운 값입니다. 고객 화면에서는 고칠 수 없습니다.'],
      },
      {
        title: '설정',
        items: [
          '발급 화면 「설정」에서 누가 어떤 칸을 적는지 정합니다. 면적(공급·전용·평수)은 상담사가 꼭 적어야 링크가 만들어집니다.',
          '양식 추가는 「발주서 양식」 메뉴입니다.',
        ],
      },
    ],
  },
  {
    id: 'send',
    n: 4,
    label: '링크 보내기',
    to: '/admin/inquiries/order-forms',
    tip: '발급 후 「메시지 복사」·「링크 복사」로 보냅니다. 고객이 제출해야 예약완료입니다.',
    match: (p) => p.startsWith('/admin/inquiries/order-forms'),
    sections: [
      {
        title: '사용법',
        items: [
          '발주서 목록에서 해당 줄을 찾아 「메시지 복사」 또는 「링크 복사」를 누릅니다.',
          '카카오·문자에 붙여 보냅니다. 고객이 폼을 끝내야 접수 상태가 예약완료로 바뀝니다.',
          '다시 보내려면 같은 복사를 쓰거나, 발주서 발급에서 새 링크를 만듭니다.',
        ],
      },
      {
        title: '아이콘',
        items: ['미제출 / 제출 완료 — 고객이 폼을 끝냈는지입니다.'],
      },
      {
        title: '색',
        items: ['접수목록과 이어진 미제출은 목록 맨 위 분홍 줄로도 보입니다.'],
      },
      {
        title: '설정',
        items: ['기간은 「발급일」 또는 「제출일」 기준으로 고릅니다. 당일·전체·월별·날짜별과 페이지당 건수를 바꿀 수 있습니다.'],
      },
    ],
  },
  {
    id: 'pending',
    n: 5,
    label: '미제출 확인',
    to: '/admin/inquiries',
    tip: '접수목록 맨 위가 미제출입니다. 링크를 다시 보내거나 「미리 작성」으로 도와드릴 수 있습니다.',
    sections: [
      {
        title: '사용법',
        items: [
          '날짜 필터를 바꿔도 미제출·입금완료·입금대기·대기는 맨 위에 남아 있습니다.',
          '줄을 열어 링크를 다시 보내거나, 「미리 작성」으로 상담사가 대신 채울 수 있습니다.',
          '고객이 제출하면 그 줄은 내려가고 예약완료로 이어집니다.',
        ],
      },
      {
        title: '아이콘',
        items: ['🔗 미제출', '✅ 입금완료', '💰 입금대기', '🕒 대기'],
      },
      {
        title: '색',
        items: [
          '분홍 — 미제출',
          '초록 — 입금완료',
          '하늘 — 입금대기',
          '노랑 — 대기',
        ],
      },
      {
        title: '설정',
        items: ['목록 아래 범례와 제목 옆 「?」의 「접수 목록」 탭에서 같은 색을 다시 볼 수 있습니다.'],
      },
    ],
  },
  {
    id: 'assign',
    n: 6,
    label: '팀장·팀원 배정',
    to: '/admin/inquiries',
    scrollSection: 'status',
    tip: '예약완료 건의 「상세보기」→「배정 · 팀원」에서 지정합니다. 대기·미제출은 배정할 수 없습니다.',
    sections: [
      {
        title: '사용법',
        items: [
          '예약완료 줄을 눌러 상세를 연 뒤 「배정 · 팀원」에서 담당 팀장을 고릅니다.',
          '같은 칸에서 팀원 인원과 이름을 지정합니다. 팀장 앱에는 팀원 고르는 칸이 없습니다.',
          '스케줄의 「팀장조정」은 그날 휴무이지, 이 접수에 팀장을 넣는 칸이 아닙니다.',
        ],
      },
      {
        title: '아이콘',
        items: ['📌 분배완료 — 팀장 배정이 끝난 상태입니다.', '목록 「전화」 — 고객에게 바로 겁니다.'],
      },
      {
        title: '색',
        items: ['배정이 끝나면 스케줄에서 분홍 「팀장 미배정」을 떠나 오전(노랑)·오후(하늘) 구역으로 갑니다.'],
      },
      {
        title: '설정',
        items: ['상세 「?」의 「접수 상세」 탭에서 「배정 · 팀원」 칸 설명을 볼 수 있습니다.'],
      },
    ],
  },
  {
    id: 'schedule',
    n: 7,
    label: '스케줄 보기',
    to: '/admin/schedule',
    tip: '예약일 기준으로 달력을 봅니다. 팀장 배정은 카드 상세의 「배정 · 팀원」입니다.',
    match: (p) => p.startsWith('/admin/schedule'),
    sections: [
      {
        title: '사용법',
        items: [
          '달력에서 날을 누르면 그날 접수가 나옵니다. PC는 오른쪽, 모바일은 아래입니다.',
          '고객명 줄을 열어 「배정 · 팀원」을 확인합니다.',
          '이어서 스케줄 이용 순서(날짜 고르기부터)를 누르면 달력 아이콘·색을 더 볼 수 있습니다.',
        ],
      },
      {
        title: '아이콘',
        items: [
          '⚠️ 미배 — 시간은 있는데 팀장이 없음',
          '⚡ 사이 · ◇ 조율 — 오전/오후가 아직 없음',
          '「팀장조정」 — 그날 휴무·자리 조정',
        ],
      },
      {
        title: '색',
        items: ['AM은 노란 오전 자리, PM은 하늘 오후 자리입니다. 숫자가 0보다 작으면 자리가 모자랍니다.'],
      },
      {
        title: '설정',
        items: [
          '스케줄 제목 옆 「?」에서 달력·일정 목록·맞춤 캘린더를 봅니다.',
          '이 안내를 숨겼다면 「페이지설정」에서 「스케줄에서 이용 순서 보기」를 켜세요.',
        ],
      },
    ],
  },
];

export const SCHEDULE_WORKFLOW_STEPS: readonly WorkflowGuideStep[] = [
  {
    id: 'pick-day',
    n: 1,
    label: '날짜 고르기',
    tip: '달력에서 예약일을 누릅니다. 오른쪽(모바일은 아래)에 그날 접수가 나옵니다.',
    sections: [
      {
        title: '사용법',
        items: [
          '위쪽 ◀▶ 또는 연·월로 달을 옮깁니다. 좁은 화면에서는 달력을 좌우로 밀어도 됩니다.',
          '칸을 누르면 그날 목록이 열립니다. PC는 오른쪽, 모바일은 달력 아래입니다.',
          '자리가 모자라면 「인원조정」「팀장조정」으로 그날 휴무·인원을 맞춥니다.',
        ],
      },
      {
        title: '아이콘',
        items: [
          '👥 팀원 — 그날 나갈 수 있는 팀원 남은 수',
          '⚠️ 미배 — 시간대는 있는데 팀장이 없는 자사 접수',
          '⚡ 사이 — 사이청소인데 오전/오후가 아직 없음',
          '◇ 조율 — 조율인데 오전/오후가 아직 없음(깜빡임)',
          '손없는날 — 음력 관행상 작업을 피하는 날',
        ],
      },
      {
        title: '색',
        items: [
          'AM 숫자(노란 칸) — 오전 팀장 남은 자리',
          'PM 숫자(하늘 칸) — 오후 팀장 남은 자리',
          '빨간 마이너스 — 배정이 자리보다 많음',
          '칸 아래 작은 점 — 미제출(분홍) · 보류(노랑) · 취소(회색)',
        ],
      },
      {
        title: '설정',
        items: [
          '달력 위 범례와 옆 「?」에서 숫자·배지 설명을 다시 봅니다.',
          '「맞춤 캘린더」 탭으로 지역·업체별로 나눠 볼 수 있습니다.',
          '이 안내를 숨겼다면 「페이지설정」에서 「스케줄에서 이용 순서 보기」를 켜세요.',
        ],
      },
    ],
  },
  {
    id: 'open-card',
    n: 2,
    label: '카드 열기',
    tip: '고객명 줄을 누르면 상세가 열립니다. 배정은 이 안에서 합니다.',
    sections: [
      {
        title: '사용법',
        items: [
          '선택한 날 목록에서 고객명 줄을 누릅니다.',
          '상세에서 주소·금액·배정·상태를 보고 고칩니다. 접수목록과 같은 접수입니다.',
          '닫은 뒤에도 목록 위치는 그대로입니다.',
        ],
      },
      {
        title: '아이콘',
        items: [
          '줄에 보이는 배지(사이·조율·미배정 등)는 그 접수의 시간대·배정 상태입니다.',
          '정보공유 아이콘에 마우스를 올리면 지금 단계가 나옵니다.',
        ],
      },
      {
        title: '색',
        items: [
          '왼쪽 굵은 띠 — 초록 종일 · 노랑 오전 · 하늘 오후 · 보라 사이·조율',
          '빨간 테두리 — 아직 처리 전(대기·입금·미제출)',
          '노란 테두리 — 보류. 흐린 카드 — 취소',
        ],
      },
      {
        title: '설정',
        items: ['제목 옆 「?」의 「일정 목록」 탭에 구역·카드 색 범례가 있습니다.'],
      },
    ],
  },
  {
    id: 'assign-leader',
    n: 3,
    label: '팀장 배정',
    scrollSection: 'status',
    tip: '상세 「배정 · 팀원」에서 담당 팀장을 고릅니다. 위 「팀장조정」은 그날 휴무입니다.',
    sections: [
      {
        title: '사용법',
        items: [
          '카드를 연 뒤 「배정 · 팀원」에서 팀장을 고르고 저장합니다.',
          '예약완료가 아닌 건(대기·미제출)은 배정할 수 없습니다.',
          '위쪽 「팀장조정」은 그날 누가 쉬는지만 정합니다. 접수에 팀장을 넣는 칸이 아닙니다.',
        ],
      },
      {
        title: '아이콘',
        items: [
          '⚠️ 미배 — 아직 팀장이 없는 건. 배정하면 달력에서 줄어듭니다.',
          '「일정마감」 — 그날 또는 그 시간대에 더 받지 않음',
        ],
      },
      {
        title: '색',
        items: [
          '배정 전 — 목록 위쪽 분홍 「팀장 미배정」',
          '배정 후 — 노란 오전 또는 하늘 오후 구역으로 이동합니다.',
        ],
      },
      {
        title: '설정',
        items: ['휴무·자리는 「팀장조정」에서, 이 접수 담당은 상세 「배정 · 팀원」에서 따로 정합니다.'],
      },
    ],
  },
  {
    id: 'assign-crew',
    n: 4,
    label: '팀원 지정',
    scrollSection: 'status',
    tip: '같은 「배정 · 팀원」에서 인원과 이름을 지정합니다. 팀장 앱에는 이 칸이 없습니다.',
    sections: [
      {
        title: '사용법',
        items: [
          '상세 「배정 · 팀원」에서 인원 수와 이름을 적습니다.',
          '팀장 화면에는 확인·미팅시간만 있고, 팀원을 고르는 칸은 없습니다.',
          '달력 「👥 팀원」 숫자는 그날 나갈 수 있는 남은 인원입니다.',
        ],
      },
      {
        title: '아이콘',
        items: ['👥 팀원 — 휴무를 뺀 남은 인원. 표준 접수는 보통 2명 단위로 셉니다.'],
      },
      {
        title: '색',
        items: ['팀원 숫자는 달력 칸의 회색 줄입니다. AM/PM 색과 다릅니다.'],
      },
      {
        title: '설정',
        items: ['범례 옆 「?」에서 팀원 숫자 세는 법을 다시 볼 수 있습니다.'],
      },
    ],
  },
  {
    id: 'confirm',
    n: 5,
    label: '목록에서 확인',
    tip: '팀장이 없으면 「팀장 미배정」에 있습니다. 배정 후 오전·오후 구역으로 이동합니다.',
    sections: [
      {
        title: '사용법',
        items: [
          '선택한 날 목록을 위에서 아래로 봅니다. 미배정이 남아 있으면 아직 팀장을 넣지 않은 겁니다.',
          '배정·저장 후 그 줄이 오전 또는 오후 구역으로 갔는지 확인합니다.',
          '달력에 「⚠️ 미배」가 남으면 다른 건도 팀장이 비어 있는 것입니다.',
        ],
      },
      {
        title: '아이콘',
        items: [
          '⚠️ 미배 — 달력에 아직 팀장 없는 건이 있음',
          '⚡ 사이 · ◇ 조율 — 오전/오후를 아직 정하지 않음',
        ],
      },
      {
        title: '색',
        items: [
          '분홍 머리 — 팀장 미배정',
          '초록 머리 — 종일',
          '노란 머리 — 오전',
          '하늘 머리 — 오후',
          '보라 머리 — 사이·조율·일정 미확정',
          '아래 선반 — 취소·보류. 빨간 머리 — A/S(C/S 예정)',
        ],
      },
      {
        title: '설정',
        items: [
          '「?」의 「일정 목록」에서 구역·카드 색을 다시 봅니다.',
          '더 자세한 화면 설명은 같은 「?」와 도움말 「스케줄」입니다.',
        ],
      },
    ],
  },
];

export function workflowStepsFor(surface: WorkflowGuideSurface): readonly WorkflowGuideStep[] {
  return surface === 'inquiry' ? INQUIRY_WORKFLOW_STEPS : SCHEDULE_WORKFLOW_STEPS;
}

export function activeWorkflowStepId(
  surface: WorkflowGuideSurface,
  pathname: string,
  selectedId: string | null,
): string {
  const steps = workflowStepsFor(surface);
  if (selectedId) {
    const selected = steps.find((s) => s.id === selectedId);
    if (selected) {
      if (selected.match?.(pathname)) return selectedId;
      if (!selected.match && selected.to && pathname === selected.to) return selectedId;
      if (!selected.match && !selected.to) return selectedId;
    }
  }
  const matched = steps.find((s) => s.match?.(pathname));
  return matched?.id ?? steps[0].id;
}
