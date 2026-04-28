import type { ReactNode } from 'react';

function SuccessGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export type TeamInlineNoticeVariant = 'success';

/** 팀장 모달 등 — 저장 성공 등 짧은 안내 블록(카드 형태 모듈) */
export function TeamInlineNoticeModule({
  variant,
  children,
  className = '',
}: {
  variant: TeamInlineNoticeVariant;
  children: ReactNode;
  /** 바깥 카드 패딩·너비만 조정할 때 */
  className?: string;
}) {
  const wrap =
    variant === 'success'
      ? 'border border-emerald-200/90 bg-emerald-50 shadow-sm ring-1 ring-emerald-900/[0.05]'
      : '';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`overflow-hidden rounded-xl ${wrap} ${className}`.trim()}
    >
      <div className="flex gap-2.5 px-3 py-2.5 sm:px-3.5">
        <span
          className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          aria-hidden
        >
          <SuccessGlyph className="h-[0.9375rem] w-[0.9375rem] text-white" />
        </span>
        <div className="min-w-0 flex-1 pt-[1px]">
          <p className="text-fluid-xs font-medium leading-snug text-emerald-950">{children}</p>
        </div>
      </div>
    </div>
  );
}
