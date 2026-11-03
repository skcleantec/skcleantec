export function CrmDispatchNotice({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="pointer-events-auto fixed bottom-6 left-1/2 z-50 flex max-w-[min(28rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-fluid-sm text-white shadow-lg">
      <span className="min-w-0 leading-snug">{text}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-7 shrink-0 items-center rounded-lg border border-white/30 bg-white/10 px-2 text-fluid-2xs font-semibold text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
