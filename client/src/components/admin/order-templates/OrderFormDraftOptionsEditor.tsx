import { getPreferredTimeDetailSelectOptions } from '../../../constants/orderFormPreferredTimeDetail';

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
  title?: string;
  hint?: string;
  /** 시간대별 구체적 시각. 있으면 각 하위 항목 아래에 편집한다. */
  details?: string[][];
  onDetailsChange?: (next: string[][]) => void;
};

function detailFallbackHint(label: string): string {
  const defaults = getPreferredTimeDetailSelectOptions(label);
  if (defaults.length === 0) {
    return '비워 두면 다음 화면에서 시각을 묻지 않습니다. 적으면 그 문구가 그대로 나옵니다.';
  }
  return `비워 두면 손님에게 ${defaults.map((option) => option.label).join(', ')} 이 보입니다. 여기에 적으면 그 문구로 바뀝니다.`;
}

export function OrderFormDraftOptionsEditor({
  options,
  onChange,
  className,
  title,
  hint,
  details,
  onDetailsChange,
}: Props) {
  const showDetails = Boolean(onDetailsChange);
  return (
    <div className={className}>
      <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">
        {title ?? '하위 항목 (선택지)'}
      </span>
      {hint ? <p className="mb-1.5 text-fluid-2xs leading-snug text-slate-500">{hint}</p> : null}
      <div className="space-y-1.5">
        {options.length === 0 ? (
          <p className="text-fluid-2xs text-slate-400">아직 없습니다. 「+ 항목 추가」로 넣으세요.</p>
        ) : (
          options.map((opt, optIdx) => {
            const rowDetails = details?.[optIdx] ?? [];
            return (
            <div key={optIdx} className="space-y-1.5">
              <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-fluid-2xs tabular-nums text-slate-400">{optIdx + 1}</span>
              <input
                value={opt}
                onChange={(e) => onChange(options.map((o, i) => (i === optIdx ? e.target.value : o)))}
                maxLength={128}
                placeholder={`항목 ${optIdx + 1}`}
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => {
                  onChange(options.filter((_, i) => i !== optIdx));
                  onDetailsChange?.(
                    (details ?? options.map(() => [] as string[])).filter((_, i) => i !== optIdx),
                  );
                }}
                className={BTN_DANGER}
              >
                삭제
              </button>
              </div>
              {showDetails ? (
                <div className="ml-7 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <span className="block text-fluid-2xs font-medium text-slate-600">구체적 시각 (다음 화면)</span>
                  <p className="text-fluid-2xs leading-snug text-slate-500">
                    {rowDetails.length > 0
                      ? '이 문구가 다음 화면(구체적인 시각)에 그대로 나옵니다.'
                      : detailFallbackHint(opt)}
                  </p>
                  {rowDetails.map((detail, detailIdx) => (
                    <div key={detailIdx} className="flex items-center gap-2">
                      <input
                        value={detail}
                        onChange={(e) => {
                          const next = options.map((_, i) => [...(details?.[i] ?? [])]);
                          next[optIdx] = next[optIdx].map((item, i) => (i === detailIdx ? e.target.value : item));
                          onDetailsChange?.(next);
                        }}
                        maxLength={80}
                        placeholder={`시각 ${detailIdx + 1}`}
                        className={INPUT}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = options.map((_, i) => [...(details?.[i] ?? [])]);
                          next[optIdx] = next[optIdx].filter((_, i) => i !== detailIdx);
                          onDetailsChange?.(next);
                        }}
                        className={BTN_DANGER}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const next = options.map((_, i) => [...(details?.[i] ?? [])]);
                      next[optIdx] = [...next[optIdx], ''];
                      onDetailsChange?.(next);
                    }}
                    className={BTN_GHOST}
                  >
                    + 시각 추가
                  </button>
                </div>
              ) : null}
            </div>
            );
          })
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          onChange([...options, '']);
          if (onDetailsChange) onDetailsChange([...(details ?? options.map(() => [] as string[])), []]);
        }}
        className={`${BTN_GHOST} mt-2`}
      >
        + 항목 추가
      </button>
    </div>
  );
}
