import { createPortal } from 'react-dom';
import { LineMdIcon } from '../../ui/LineMdIcon';

const STEPS = [
  '날짜의 일정을 모으고 있습니다.',
  '팀장 집과 피로를 계산하고 있습니다.',
  'AI가 동선과 평수를 보고 있습니다.',
  '빠진 일정에 팀장을 넣고 있습니다.',
  '초안을 저장하고 있습니다.',
];

export function AiDispatchProgressModal({
  step,
  message,
  seconds,
}: {
  step: number;
  message: string;
  seconds: number;
}) {
  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dispatch-progress-title"
        className="modal-mobile-fullscreen-panel flex max-h-[min(92vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="shrink-0 border-b border-slate-200 px-3 py-2.5">
          <h2 id="ai-dispatch-progress-title" className="text-fluid-sm font-semibold text-slate-900">
            AI 미리 배정
          </h2>
          <p className="mt-0.5 text-fluid-2xs text-slate-500">지난 시간 {seconds}초 · 창을 닫지 않아도 됩니다.</p>
        </header>
        <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
          {STEPS.map((label, index) => {
            const n = index + 1;
            const current = n === step;
            const done = n < step;
            return (
              <li
                key={label}
                className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 ${
                  current ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                }`}
              >
                <LineMdIcon
                  name={done ? 'confirm-circle' : current ? 'loading-twotone-loop' : 'circle'}
                  className={`mt-0.5 size-5 shrink-0 ${current ? 'text-slate-900' : 'text-slate-400'}`}
                />
                <p className={`text-fluid-xs leading-snug ${current ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                  {current ? message || label : label}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body,
  );
}
