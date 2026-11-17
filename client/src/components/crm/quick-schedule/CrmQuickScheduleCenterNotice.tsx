export function CrmQuickScheduleCenterNotice({
  text,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  onClose,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white px-5 py-4 text-center shadow-xl" role="dialog" aria-modal="true">
        <p className="text-[13px] leading-relaxed text-slate-800">{text}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-3 text-[12px] font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {actionLabel}
            </button>
          ) : null}
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {secondaryLabel}
            </button>
          ) : null}
          {onClose && !onSecondary ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              닫기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
