import { useState } from 'react';
import { ReceiptCopyButtons } from './ReceiptCopyButtons';

const ITEM =
  'block w-full min-h-9 rounded-md px-2 text-left text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none';

export function ReceiptRowMenu({
  kind,
  issueId,
  official,
  publicToken,
  copyReady,
  canCancel,
  cancelling,
  onCancel,
  onLinkInquiry,
}: {
  kind: 'cashbill' | 'taxinvoice';
  issueId: string;
  official: boolean;
  publicToken: string | null;
  copyReady: boolean;
  canCancel: boolean;
  cancelling: boolean;
  onCancel: () => void;
  onLinkInquiry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-fluid-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        aria-label="더보기"
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <ReceiptCopyButtons kind={kind} issueId={issueId} official={official} publicToken={publicToken} copyReady={copyReady} menu />
          {onLinkInquiry ? (
            <button type="button" className={ITEM} onClick={() => { setOpen(false); onLinkInquiry(); }}>접수 연결</button>
          ) : null}
          {canCancel ? (
            <button type="button" className={ITEM} disabled={cancelling} onClick={onCancel}>
              {cancelling ? '취소 중…' : '취소'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
