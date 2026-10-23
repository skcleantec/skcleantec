import type { ReactNode } from 'react';
import { useLoginScrollSurface } from '../../../hooks/useMobileInputVisibility';

export function PgContractDeskFrame({
  notice,
  onClose,
  children,
}: {
  notice?: string | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-slate-200">
      <header className="pg-no-print flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2 text-white">
        <p className="min-w-0 flex-1 truncate text-fluid-sm font-semibold">청소비서 · 카드결제 전자계약</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 shrink-0 rounded-lg border border-white/30 px-3 text-fluid-xs font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          닫기
        </button>
      </header>
      <div
        ref={scrollRef}
        onFocusCapture={onFieldFocus}
        className="pg-desk-scroll login-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4"
      >
        <div className="mx-auto w-full max-w-[220mm]">
          {notice ? <p className="pg-no-print mb-3 rounded-lg bg-white px-3 py-2 text-fluid-xs text-slate-800 shadow-sm">{notice}</p> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
