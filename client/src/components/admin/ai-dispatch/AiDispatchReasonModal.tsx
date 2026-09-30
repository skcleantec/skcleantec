import { createPortal } from 'react-dom';
import { aiDispatchSlotLabel } from '@shared/aiDispatch';
import type { AiDispatchBoard } from '../../../api/aiDispatch';
import { LineMdIcon } from '../../ui/LineMdIcon';

export function AiDispatchReasonModal({
  board,
  onClose,
}: {
  board: AiDispatchBoard;
  onClose: () => void;
}) {
  const proposals = board.run?.proposals ?? [];
  const loops = board.run?.loops ?? [];
  const leaders = new Map(board.leaders.map((leader) => [leader.id, leader]));

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dispatch-reason-title"
        className="modal-mobile-fullscreen-panel flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
          <h2 id="ai-dispatch-reason-title" className="text-fluid-sm font-semibold text-slate-900">
            이렇게 배정한 이유
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            aria-label="닫기"
          >
            <LineMdIcon name="close" className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <p className="text-fluid-xs leading-snug text-slate-700">
            {board.run?.summary?.trim() || '이 날짜 초안입니다.'}
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
            거리는 팀장 집과 현장 좌표의 직선입니다. 하루 2건은 오전·오후를 가깝게 묶고, 하루 1건은 집과의 거리만 봅니다. 피로 점수가 더 높으면 가까운 하루를, 더 낮으면 조금 먼 하루를 줍니다. 휴무 다음부터 0에서 다시 쌓이고, 2주간 휴무가 없으면 매우 나쁨입니다. 하루 칸이 찬 일정은 초안 맨 위에 팀장 없이 둡니다.
          </p>
          {loops.length > 0 ? (
            <ul className="space-y-1.5">
              {loops.map((line) => (
                <li key={line} className="flex items-start gap-1.5 text-fluid-xs leading-snug text-slate-800">
                  <LineMdIcon name="map-marker" className="mt-0.5 size-4 shrink-0 text-slate-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fluid-xs text-slate-600">팀장이 들어간 초안이 없어, 집부터의 동선을 재지 않았습니다.</p>
          )}
          <ul className="space-y-2">
            {proposals.map((proposal) => {
              const leader = proposal.teamLeaderId ? leaders.get(proposal.teamLeaderId) : undefined;
              return (
                <li key={proposal.id} className="rounded-xl border border-slate-200 px-2.5 py-2">
                  <p className="text-fluid-sm font-semibold text-slate-900">
                    {aiDispatchSlotLabel(proposal.slot)} · {proposal.customerName}
                  </p>
                  <p className="mt-0.5 text-fluid-xs text-slate-700">
                    {proposal.teamLeaderName
                      ? `${proposal.teamLeaderName}${leader ? ` · 피로 ${leader.fatigue}` : ''}${proposal.fromHomeKm != null ? ` · 집에서 편도 ${proposal.fromHomeKm}km` : ''}`
                      : '팀장을 넣지 않았습니다.'}
                  </p>
                  <p className="mt-1 text-fluid-xs leading-snug text-slate-600">{proposal.reason}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
