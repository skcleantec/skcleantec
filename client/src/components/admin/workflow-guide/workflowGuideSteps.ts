import type { WorkflowGuideSurface } from '../../../utils/staffWorkflowGuideStorage';

export type WorkflowGuideStep = {
  id: string;
  n: number;
  label: string;
  tip: string;
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
    tip: '접수목록에서 「일반 등록」으로 전화 건을 넣습니다. 부재·보류는 옆 메뉴입니다.',
    match: (p) => p === '/admin/inquiries',
  },
  {
    id: 'followup',
    n: 2,
    label: '부재·보류',
    to: '/admin/inquiries/followup',
    tip: '아직 예약이 안 된 전화 건을 여기서 추적합니다. 입금 완료로 바꾸면 접수목록으로 이어집니다.',
    match: (p) => p.startsWith('/admin/inquiries/followup'),
  },
  {
    id: 'issue',
    n: 3,
    label: '발주서 발급',
    to: '/admin/inquiries/order-issue',
    tip: '「대기 접수 연결」을 하면 접수목록·스케줄이 한 줄로 이어집니다. 연결 없이 발급하면 발주서 목록에만 보일 수 있습니다.',
    match: (p) => p.startsWith('/admin/inquiries/order-issue'),
  },
  {
    id: 'send',
    n: 4,
    label: '링크 보내기',
    to: '/admin/inquiries/order-forms',
    tip: '발급 후 「메시지 복사」·「링크 복사」로 카카오·문자에 붙여 보냅니다. 고객이 제출해야 예약완료입니다.',
    match: (p) => p.startsWith('/admin/inquiries/order-forms'),
  },
  {
    id: 'pending',
    n: 5,
    label: '미제출 확인',
    to: '/admin/inquiries',
    tip: '접수목록 맨 위가 미제출입니다. 링크를 다시 보내거나 「미리 작성」으로 도와드릴 수 있습니다.',
  },
  {
    id: 'assign',
    n: 6,
    label: '팀장·팀원 배정',
    to: '/admin/inquiries',
    scrollSection: 'status',
    tip: '예약완료 건의 「상세보기」→「배정 · 팀원」에서 지정합니다. 대기·미제출은 배정할 수 없습니다. 팀장 앱에서는 팀원을 고르지 않습니다.',
  },
  {
    id: 'schedule',
    n: 7,
    label: '스케줄 보기',
    to: '/admin/schedule',
    tip: '예약일 기준으로 달력에서 확인합니다. 팀장 배정은 카드 상세의 「배정 · 팀원」입니다. 「팀장조정」은 그날 휴무입니다.',
    match: (p) => p.startsWith('/admin/schedule'),
  },
];

export const SCHEDULE_WORKFLOW_STEPS: readonly WorkflowGuideStep[] = [
  {
    id: 'pick-day',
    n: 1,
    label: '날짜 고르기',
    tip: '달력에서 예약일을 누릅니다. 오른쪽(모바일은 아래)에 그날 접수가 나옵니다.',
  },
  {
    id: 'open-card',
    n: 2,
    label: '카드 열기',
    tip: '고객명 줄을 누르면 상세가 열립니다. 배정은 이 안에서 합니다.',
  },
  {
    id: 'assign-leader',
    n: 3,
    label: '팀장 배정',
    scrollSection: 'status',
    tip: '상세 「배정 · 팀원」에서 담당 팀장을 고릅니다. 위 「팀장조정」은 그날 휴무·TO이지 접수 배정이 아닙니다.',
  },
  {
    id: 'assign-crew',
    n: 4,
    label: '팀원 지정',
    scrollSection: 'status',
    tip: '같은 「배정 · 팀원」에서 인원과 이름을 지정합니다. 팀장 앱에는 팀원 배정 칸이 없고 확인·미팅시간만 있습니다.',
  },
  {
    id: 'partner',
    n: 5,
    label: '타업체면',
    scrollSection: 'settlement',
    tip: '「정산 · 옵션」→「타업체 담당」에서 고릅니다. 자사 팀장과 같이 지정할 수 없습니다.',
  },
  {
    id: 'confirm',
    n: 6,
    label: '목록에서 확인',
    tip: '팀장 없으면 「팀장 미배정」, 배정 후 오전·오후 구역으로 이동합니다. 달력 「⚠️ 미배」가 남으면 팀장 배정을 다시 확인하세요.',
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
