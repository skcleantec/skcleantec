const INPUT =
  'min-w-0 min-h-9 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const BTN_GHOST =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const BTN_DANGER =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white px-2 py-1 text-fluid-2xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

type Props = {
  options: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

export function OrderFormDraftOptionsEditor({ options, onChange, className }: Props) {
  return (
    <div className={className}>
      <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">하위 항목 (선택지)</span>
      <div className="space-y-1.5">
        {options.length === 0 ? (
          <p className="text-fluid-2xs text-slate-400">아직 없습니다. 「+ 항목 추가」로 넣으세요.</p>
        ) : (
          options.map((opt, optIdx) => (
            <div key={optIdx} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-fluid-2xs tabular-nums text-slate-400">{optIdx + 1}</span>
              <input
                value={opt}
                onChange={(e) => onChange(options.map((o, i) => (i === optIdx ? e.target.value : o)))}
                maxLength={128}
                placeholder={`항목 ${optIdx + 1}`}
                className={INPUT}
              />
              <button type="button" onClick={() => onChange(options.filter((_, i) => i !== optIdx))} className={BTN_DANGER}>
                삭제
              </button>
            </div>
          ))
        )}
      </div>
      <button type="button" onClick={() => onChange([...options, ''])} className={`${BTN_GHOST} mt-2`}>
        + 항목 추가
      </button>
    </div>
  );
}
