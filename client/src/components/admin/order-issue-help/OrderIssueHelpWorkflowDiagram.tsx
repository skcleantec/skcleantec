import { ORDER_ISSUE_FLOW_NODES, type OrderIssueFlowNode } from './orderIssueHelpShared';

const TONE_CLASS: Record<OrderIssueFlowNode['tone'], string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-900',
  sky: 'border-sky-200 bg-sky-50 text-sky-950',
  amber: 'border-amber-200 bg-amber-50 text-amber-950',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  violet: 'border-violet-200 bg-violet-50 text-violet-950',
};

function FlowNode({ node, compact }: { node: OrderIssueFlowNode; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-center shadow-sm ${TONE_CLASS[node.tone]} ${
        compact ? 'min-w-[4.5rem]' : 'min-w-[5.5rem] sm:min-w-[6.5rem]'
      }`}
    >
      <p className={`font-semibold leading-snug ${compact ? 'text-[11px]' : 'text-fluid-2xs sm:text-fluid-xs'}`}>
        {node.title}
      </p>
      {node.subtitle ? (
        <p className={`mt-0.5 text-slate-600 leading-snug ${compact ? 'text-[9px]' : 'text-[11px] sm:text-fluid-2xs'}`}>
          {node.subtitle}
        </p>
      ) : null}
    </div>
  );
}

function Arrow({ vertical }: { vertical?: boolean }) {
  if (vertical) {
    return (
      <span className="flex shrink-0 items-center justify-center text-slate-400" aria-hidden>
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center px-0.5 text-slate-400" aria-hidden>
      <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 16 16" fill="none">
        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** 전체 진행 흐름도 — 모바일 세로 · PC 가로 */
export function OrderIssueHelpWorkflowDiagram({ compact = false }: { compact?: boolean }) {
  const nodes = ORDER_ISSUE_FLOW_NODES;

  return (
    <div className="space-y-3">
      <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-y-2">
        {nodes.map((node, i) => (
          <div key={node.id} className="flex items-center">
            <FlowNode node={node} compact={compact} />
            {i < nodes.length - 1 ? <Arrow /> : null}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-stretch gap-1 sm:hidden">
        {nodes.map((node, i) => (
          <div key={node.id} className="flex flex-col items-center">
            <FlowNode node={node} compact />
            {i < nodes.length - 1 ? <Arrow vertical /> : null}
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-fluid-2xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">발주서 vs 접수</strong> — 발급만으로는 「예약완료」가 아닙니다. 고객
        제출 후 「예약완료」가 되며, 그 전에는 「미제출」로 목록 상단에 고정됩니다. 부재·보류 건은 「대기 접수
        연결」로 같은 줄을 이어가는 것이 좋습니다.
      </div>
    </div>
  );
}
