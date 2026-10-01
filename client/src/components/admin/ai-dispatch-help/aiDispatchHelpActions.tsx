import type { ReactNode } from 'react';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { AiDispatchLaunchButton } from '../ai-dispatch/AiDispatchLaunchButton';

export type AiDispatchHelpActionRow = {
  sample: ReactNode;
  meaning: string;
  when?: string;
};

function Frozen({ children }: { children: ReactNode }) {
  return <div className="pointer-events-none select-none">{children}</div>;
}

export const AI_DISPATCH_HELP_ACTIONS: readonly AiDispatchHelpActionRow[] = [
  {
    sample: (
      <Frozen>
        <AiDispatchLaunchButton onClick={() => undefined}>AI 미리 배정</AiDispatchLaunchButton>
      </Frozen>
    ),
    meaning: '고른 날짜의 예약완료·미배정 일정을 팀장 초안으로 나눕니다. 이 버튼만으로는 배정되지 않습니다.',
    when: '1 날짜, 스케줄 제목 옆',
  },
  {
    sample: (
      <Frozen>
        <span className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700">
          <LineMdIcon name="cog" className="size-5" />
        </span>
      </Frozen>
    ),
    meaning: '「배정 규칙」이 열립니다. 주간 정상 근무일, 주간 정상 건수, 큰 집 인원, 투룸 상한, 팀원 점수를 저장합니다.',
    when: '「AI 미리 배정」 옆',
  },
  {
    sample: (
      <Frozen>
        <span className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800">
          <LineMdIcon name="map-marker" className="size-5" />
        </span>
      </Frozen>
    ),
    meaning: '초안 팀장 이름과 오전·오후 선이 붙은 당일 지도가 열립니다. 승인 전에는 스케줄 배정이 바뀌지 않습니다.',
    when: '3 초안 확인',
  },
  {
    sample: (
      <Frozen>
        <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800">
          배정 이유
        </span>
      </Frozen>
    ),
    meaning: '팀장마다 이름과 피로, 묶인 일정, 거리와 피로 한 줄을 봅니다. 이미 배정된 건은 「수동배정」으로 먼저 나옵니다.',
    when: '3 초안 확인',
  },
  {
    sample: (
      <Frozen>
        <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800">
          전체 선택
        </span>
      </Frozen>
    ),
    meaning: '승인할 수 있는 초안을 모두 고릅니다. 이미 모두 골라져 있으면 「선택 해제」가 됩니다.',
    when: '3 초안 확인',
  },
  {
    sample: (
      <Frozen>
        <span className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white">
          <LineMdIcon name="briefcase-check" className="size-4" />
          선택 승인
        </span>
      </Frozen>
    ),
    meaning: '체크한 초안만 실제 배정으로 저장합니다.',
    when: '3 초안 확인',
  },
  {
    sample: (
      <Frozen>
        <span className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-fluid-2xs font-semibold text-rose-950">
          수동배정
        </span>
      </Frozen>
    ),
    meaning: '이미 사람이 잡아 둔 일정입니다. 초안 승인 대상이 아니고, 그 팀장은 미배정 팀장에 나오지 않습니다.',
    when: '3 초안 확인 위',
  },
];
