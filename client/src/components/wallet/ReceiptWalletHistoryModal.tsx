import { createPortal } from 'react-dom';
import { ReceiptWalletHistoryPanel } from './ReceiptWalletHistoryPanel';

export function ReceiptWalletHistoryModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 lg:items-center">
      <div className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-white lg:max-h-[90vh] lg:max-w-lg lg:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">충전·사용 내역</h2>
          <button
            type="button"
            className="min-h-10 rounded-lg px-3 text-fluid-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={onClose}
          >
            닫기
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ReceiptWalletHistoryPanel />
        </div>
      </div>
    </div>,
    document.body,
  );
}
