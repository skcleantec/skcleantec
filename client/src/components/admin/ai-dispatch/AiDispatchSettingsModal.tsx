import { useRef, type FocusEvent } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { LineMdIcon } from '../../ui/LineMdIcon';

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-fluid-xs font-medium text-slate-800">{label}</span>
      <span className="mt-0.5 block text-fluid-2xs text-slate-500">{hint}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        className="login-field-input mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-fluid-sm tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      />
    </label>
  );
}

export function AiDispatchSettingsModal({
  minPyeong,
  leaderCount,
  twoRoom,
  includeCrew,
  normalDays,
  normalJobs,
  onMinPyeong,
  onLeaderCount,
  onTwoRoom,
  onIncludeCrew,
  onNormalDays,
  onNormalJobs,
  onSave,
  onClose,
}: {
  minPyeong: string;
  leaderCount: string;
  twoRoom: string;
  includeCrew: boolean;
  normalDays: string;
  normalJobs: string;
  onMinPyeong: (value: string) => void;
  onLeaderCount: (value: string) => void;
  onTwoRoom: (value: string) => void;
  onIncludeCrew: (value: boolean) => void;
  onNormalDays: (value: string) => void;
  onNormalJobs: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dispatch-settings-title"
        className="modal-mobile-fullscreen-panel flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border border-slate-200 bg-white shadow-xl lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
          <h2 id="ai-dispatch-settings-title" className="text-fluid-sm font-semibold text-slate-900">
            배정 규칙
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
        <div
          ref={scrollRef}
          onFocusCapture={onFieldFocus as (event: FocusEvent<HTMLDivElement>) => void}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
        >
          <p className="text-fluid-2xs leading-snug text-slate-500">
            휴무 달력의 쉰 날 다음부터 다시 세고, 그 뒤 하루 2건이면 보통입니다. 휴무가 없는 주만 아래 주간 정상 근무일·건수를 봅니다. 팀 평균보다 먼 이동은 점수를 올립니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="주간 정상 근무일" hint="휴무가 없는 주의 기준입니다" value={normalDays} onChange={onNormalDays} />
            <Field label="주간 정상 건수" hint="휴무가 없을 때만 이 건수가 보통입니다" value={normalJobs} onChange={onNormalJobs} />
            <Field label="이 평수 이상" hint="이 크기부터 팀장을 더 붙입니다" value={minPyeong} onChange={onMinPyeong} />
            <Field label="팀장 수" hint="위 평수일 때 붙는 인원" value={leaderCount} onChange={onLeaderCount} />
            <Field label="투룸 상한" hint="이 평수 이하는 작은 집으로 봅니다" value={twoRoom} onChange={onTwoRoom} />
          </div>
          <div>
            <p className="text-fluid-xs font-medium text-slate-800">팀원 점수</p>
            <p className="mt-0.5 text-fluid-2xs text-slate-500">
              켜면 팀원 없이 간 날에 피로를 더합니다. 팀원을 안 쓰는 업체는 끄세요.
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={includeCrew}
              onClick={() => onIncludeCrew(!includeCrew)}
              className={`mt-1.5 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                includeCrew
                  ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className={`inline-block size-3 rounded-full ${includeCrew ? 'bg-white' : 'bg-slate-300'}`} aria-hidden />
              {includeCrew ? '팀원 점수 포함' : '팀원 점수 제외'}
            </button>
          </div>
        </div>
        <footer className="shrink-0 border-t border-slate-200 px-3 py-2.5">
          <button
            type="button"
            onClick={() => {
              onSave();
              onClose();
            }}
            className="min-h-10 w-full rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            규칙 저장
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
