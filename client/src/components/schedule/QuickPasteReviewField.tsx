import type { QuickPasteFieldEvidence } from '../../api/quickPaste';

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l1.2 5.1L18 8.7l-4.2 2.4L12 16l-1.8-4.9L6 8.7l4.8-1.1L12 2.5z" opacity="0.95" />
    </svg>
  );
}

function formatDisplayValue(
  value: string | number | null | undefined,
  kind: 'text' | 'amount' | 'date' | 'number' | 'time',
): string {
  if (value == null || value === '') return '—';
  if (kind === 'amount') {
    const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(n)) return String(value);
    return `${n.toLocaleString('ko-KR')}원`;
  }
  if (kind === 'time' && value === '사이청소') return '사이';
  return String(value);
}

export function formatAmountInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return Number(value).toLocaleString('ko-KR');
}

export function parseAmountInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  label: string;
  displayValue: string | number | null | undefined;
  kind?: 'text' | 'amount' | 'date' | 'number' | 'time';
  evidence?: QuickPasteFieldEvidence | null;
  aiFilled?: boolean;
  aiCorrected?: boolean;
  isMissing?: boolean;
  highlightMissing?: boolean;
  emptyEditable?: boolean;
  editing: boolean;
  markedWrong: boolean;
  editValue: string;
  inputType?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  onMarkWrong: () => void;
  onCancelEdit: () => void;
  onConfirmEdit: () => void;
  onEditValueChange: (value: string) => void;
  /** 방·화·베 한 칸 — 촘촘한 패딩 */
  dense?: boolean;
  /** 시간대 선택 옵션 */
  selectOptions?: Array<{ value: string; label: string }>;
};

export function QuickPasteReviewField({
  label,
  displayValue,
  kind = 'text',
  evidence,
  aiFilled,
  aiCorrected,
  isMissing,
  highlightMissing,
  emptyEditable,
  editing,
  markedWrong,
  editValue,
  inputType = 'text',
  inputRef,
  onMarkWrong,
  onCancelEdit,
  onConfirmEdit,
  onEditValueChange,
  dense,
  selectOptions,
}: Props) {
  const showAlert = Boolean(highlightMissing && isMissing);
  const isEmpty =
    displayValue == null || (typeof displayValue === 'string' && !String(displayValue).trim());
  const canDirectEdit = Boolean(emptyEditable && isEmpty);

  return (
    <div
      className={`rounded-lg border ${
        dense ? 'space-y-0.5 px-1.5 py-1' : 'space-y-1 px-2.5 py-1.5'
      } ${
        showAlert
          ? 'border-amber-400 bg-amber-50/90'
          : markedWrong
            ? 'border-violet-300 bg-violet-50/50'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="min-w-0 flex flex-wrap items-center gap-0.5">
          <span
            className={`font-semibold ${dense ? 'text-[12px]' : 'text-fluid-2xs'} ${
              showAlert ? 'text-amber-900' : 'text-slate-700'
            }`}
          >
            {label}
            {isMissing ? <span className="ml-0.5 font-medium text-amber-700">(필수)</span> : null}
          </span>
          {aiCorrected ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 px-1 py-px text-[9px] font-semibold text-white">
              <SparkleIcon className="h-2 w-2" />
              AI
            </span>
          ) : null}
          {aiFilled && !aiCorrected ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 px-1 py-px text-[9px] font-semibold text-white">
              <SparkleIcon className="h-2 w-2" />
              AI
            </span>
          ) : null}
          {markedWrong ? (
            <span className="rounded-full border border-violet-200 bg-violet-50 px-1 py-px text-[9px] font-semibold text-violet-800">
              수정됨
            </span>
          ) : null}
        </div>
        {!editing && !canDirectEdit ? (
          <button
            type="button"
            onClick={onMarkWrong}
            className={`shrink-0 rounded-md border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 ${
              dense ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-fluid-2xs'
            }`}
          >
            수정
          </button>
        ) : null}
      </div>

      {editing || canDirectEdit ? (
        <div className={dense ? 'space-y-1' : 'space-y-1.5'}>
          {editing && !dense ? (
            <p className="text-fluid-2xs text-violet-800">
              수정하면 AI가 틀린 것으로 보고, 고친 표기를 다음에 기억합니다.
            </p>
          ) : null}
          {selectOptions ? (
            <div className="flex gap-1">
              {selectOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onEditValueChange(opt.value)}
                  className={`min-h-8 flex-1 rounded-lg border text-fluid-2xs font-semibold ${
                    editValue === opt.value
                      ? 'border-violet-500 bg-violet-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <input
              ref={inputRef}
              type={inputType}
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className={`w-full rounded-lg border px-2 text-fluid-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${
                dense ? 'min-h-8 text-center' : 'min-h-9 px-3'
              } ${showAlert ? 'border-amber-500 bg-amber-50' : 'border-violet-200 bg-white'}`}
            />
          )}
          {editing ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onConfirmEdit}
                className={`flex-1 rounded-lg bg-violet-700 font-semibold text-white ${
                  dense ? 'min-h-7 text-[11px]' : 'min-h-8 text-fluid-2xs'
                }`}
              >
                저장
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className={`rounded-lg border border-slate-200 text-slate-600 ${
                  dense ? 'min-h-7 px-2 text-[11px]' : 'min-h-8 px-2.5 text-fluid-2xs'
                }`}
              >
                취소
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p
          className={`font-medium tabular-nums text-slate-900 ${
            dense ? 'text-fluid-xs text-center' : 'text-fluid-sm'
          } ${kind === 'amount' ? 'text-right' : ''}`}
        >
          {formatDisplayValue(displayValue, kind)}
        </p>
      )}

      {/* dense(방화베)는 섹션 상단 원문 배너를 쓰므로 칸마다 중복 표시하지 않음 */}
      {!dense ? (
        <p className="text-fluid-2xs leading-snug text-slate-500">
          {evidence?.snippet ? (
            <>
              <span className="font-medium text-slate-600">원문 </span>
              <span className="text-slate-600">「{evidence.snippet}」</span>
            </>
          ) : (
            <span className="text-slate-400">원문에서 못 찾음 · 직접 확인</span>
          )}
        </p>
      ) : null}
    </div>
  );
}
