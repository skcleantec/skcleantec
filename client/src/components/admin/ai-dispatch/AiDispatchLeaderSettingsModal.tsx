import { useRef, useState, type FocusEvent } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import type { AiDispatchLeader } from '../../../api/aiDispatch';
import {
  TeamLeaderDispatchFields,
  type TeamLeaderDispatchFormValue,
} from '../TeamLeaderDispatchFields';
import { LineMdIcon } from '../../ui/LineMdIcon';

export function AiDispatchLeaderSettingsModal({
  leader,
  saving,
  error,
  onClose,
  onSave,
}: {
  leader: AiDispatchLeader;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (value: TeamLeaderDispatchFormValue) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const [value, setValue] = useState<TeamLeaderDispatchFormValue>({
    homeAddress: leader.homeAddress,
    homeAddressDetail: leader.homeAddressDetail,
    jobsPerDay: leader.jobsPerDay === 1 ? '1' : '2',
    sizePolicy: leader.sizePolicy,
  });

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dispatch-leader-settings-title"
        className="modal-mobile-fullscreen-panel flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
          <h2 id="ai-dispatch-leader-settings-title" className="truncate text-fluid-sm font-semibold text-slate-900">
            {leader.name} 설정
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
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
          <TeamLeaderDispatchFields value={value} onChange={setValue} />
          {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
        </div>
        <footer className="shrink-0 border-t border-slate-200 px-3 py-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(value)}
            className="min-h-10 w-full rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? '저장 중…' : '이 팀장 설정 저장'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
