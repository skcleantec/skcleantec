import type { TelecrmScriptKind } from '../../api/telecrm';

const kindBtn =
  'rounded-lg px-3 py-1.5 text-fluid-xs font-medium hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

/** 상담 스크립트 카테고리 — 「누구에게 보이나요」와 같은 세그먼트 */
export function TelecrmScriptKindSegment({
  value,
  onChange,
  disabled,
}: {
  value: TelecrmScriptKind;
  onChange: (kind: TelecrmScriptKind) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <span className="text-fluid-xs font-medium text-slate-600">이 칸은 어디에 쓰나요?</span>
      <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('step')}
          className={`${kindBtn} ${value === 'step' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'}`}
        >
          대본 단계
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('reaction')}
          className={`${kindBtn} ${value === 'reaction' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'}`}
        >
          고객 반응 버튼
        </button>
      </div>
    </div>
  );
}
