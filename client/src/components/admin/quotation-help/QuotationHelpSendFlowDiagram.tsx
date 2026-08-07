import { QUOTATION_SEND_FLOW_NODES, type QuotationSendFlowNode } from './quotationHelpShared';

const TONE_CLASS: Record<QuotationSendFlowNode['tone'], string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-900',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-950',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  sky: 'border-sky-200 bg-sky-50 text-sky-950',
};

function FlowNode({ node, compact }: { node: QuotationSendFlowNode; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 text-center shadow-sm ${TONE_CLASS[node.tone]} ${
        compact ? 'min-w-[4rem]' : 'min-w-[4.5rem] sm:min-w-[5.5rem]'
      }`}
    >
      <p className={`font-semibold leading-snug ${compact ? 'text-[10px]' : 'text-fluid-2xs'}`}>{node.title}</p>
      {node.subtitle ? (
        <p className={`mt-0.5 text-slate-600 leading-snug ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
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
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function QuotationHelpSendFlowDiagram({ compact = false }: { compact?: boolean }) {
  const nodes = QUOTATION_SEND_FLOW_NODES;
  return (
    <>
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
    </>
  );
}
