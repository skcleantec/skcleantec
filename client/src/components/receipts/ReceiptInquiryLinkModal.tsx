import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchCashbillInquiries } from '../../api/cashbillIssues';
import { searchTaxInvoiceInquiries } from '../../api/taxInvoices';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

const GHOST =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-left text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type Hit = { id: string; customerName: string; inquiryNumber: string | null };

export function ReceiptInquiryLinkModal({
  kind,
  onClose,
  onPick,
}: {
  kind: 'taxinvoice' | 'cashbill';
  onClose: () => void;
  onPick: (inquiryId: string) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let stop = false;
    const timer = window.setTimeout(() => {
      const run = kind === 'taxinvoice' ? searchTaxInvoiceInquiries(q) : searchCashbillInquiries(q);
      run
        .then((items) => {
          if (!stop) setHits(items.map((item) => ({ id: item.id, customerName: item.customerName, inquiryNumber: item.inquiryNumber })));
        })
        .catch((err: unknown) => {
          if (!stop) setError(err instanceof Error ? err.message : '접수를 찾지 못했습니다.');
        });
    }, 300);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [kind, query]);

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="접수 연결">
      <div className="modal-mobile-fullscreen-panel flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">접수 연결</h2>
          <button type="button" className="min-h-11 rounded-lg px-3 text-fluid-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={onClose}>닫기</button>
        </header>
        <div ref={scrollRef} className="modal-form-scroll-surface min-h-0 flex-1 space-y-2 overflow-y-auto p-3" onFocusCapture={onFieldFocus}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="고객명 또는 전화번호"
            aria-label="접수 검색"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-fluid-xs"
          />
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
          <ul className="space-y-1.5">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className={GHOST}
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setError(null);
                    onPick(hit.id)
                      .then(onClose)
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : '접수를 연결하지 못했습니다.'))
                      .finally(() => setBusy(false));
                  }}
                >
                  {hit.customerName}{hit.inquiryNumber ? ` · ${hit.inquiryNumber}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
