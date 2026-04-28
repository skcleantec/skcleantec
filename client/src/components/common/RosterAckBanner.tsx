import type { RosterAckPayload } from '../../hooks/useInboxRealtime';

type Props = {
  payload: RosterAckPayload;
  onDismiss: () => void;
};

/** 현장 팀원 구성 변경 알림 — 한글(위)·태국어(아래), 우측 확인으로만 닫기 */
export function RosterAckBanner({ payload, onDismiss }: Props) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="shrink-0 border-b border-amber-700/30 bg-gradient-to-r from-amber-500 to-amber-600 text-white"
    >
      <div className="max-w-6xl mx-auto px-3 py-2.5 sm:px-4 flex items-start gap-3 min-w-0">
        <div className="min-w-0 flex-1 leading-snug pr-1">
          <div className="text-fluid-sm font-medium [text-wrap:pretty]">{payload.messageKo}</div>
          <div className="text-fluid-xs mt-1 opacity-95 [text-wrap:pretty]">{payload.messageTh}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 self-center px-3 py-1.5 rounded-md text-fluid-sm font-semibold bg-white/20 hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          확인
        </button>
      </div>
    </div>
  );
}
