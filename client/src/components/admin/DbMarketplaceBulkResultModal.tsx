import { ModalCloseButton } from './ModalCloseButton';

type FailedRow = { id: string; error: string };

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  successLabel: string;
  successCount: number;
  failed: FailedRow[];
};

export function DbMarketplaceBulkResultModal({
  open,
  onClose,
  title,
  successLabel,
  successCount,
  failed,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="flex w-full max-w-md max-h-[min(90vh,100dvh)] flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">{title}</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-3 text-fluid-xs" style={{ WebkitOverflowScrolling: 'touch' }}>
          <p className="text-emerald-800 font-medium">
            {successLabel}: {successCount}건
          </p>
          {failed.length > 0 ? (
            <div className="rounded-lg border border-red-100 bg-red-50/50 p-3 space-y-2">
              <p className="font-medium text-red-800">실패 {failed.length}건</p>
              <ul className="max-h-40 overflow-y-auto space-y-1 text-[11px] text-red-700">
                {failed.map((f) => (
                  <li key={f.id} className="break-words">
                    <span className="font-mono text-[10px]">{f.id.slice(0, 8)}…</span> — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="sticky bottom-0 -mx-4 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[2.75rem] w-full rounded-lg bg-slate-900 px-4 py-2 text-[11px] font-medium text-white hover:bg-slate-800 sm:min-h-0 sm:w-auto"
            >
              확인
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
