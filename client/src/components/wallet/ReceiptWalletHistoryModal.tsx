import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { WALLET_USAGE_LABEL, type WalletUsageType } from '@shared/walletPolicy';
import { fetchReceiptWalletLedger, type ReceiptWalletLedgerItem } from '../../api/receiptWallet';

const FILTERS = [
  ['all', '전체'],
  ['charge', '충전'],
  ['cashbill', '현금영수증'],
  ['taxinvoice', '세금계산서'],
  ['alimtalk', '알림톡'],
] as const;

const PAGE = 30;

function won(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${Number(n).toLocaleString('ko-KR')}원`;
}

function labelOf(row: ReceiptWalletLedgerItem): string {
  if (row.kind === 'CHARGE') return '충전';
  if (row.type && row.type in WALLET_USAGE_LABEL) return WALLET_USAGE_LABEL[row.type as WalletUsageType];
  return '사용';
}

function Trend({ points }: { points: { balanceAfterKrw: number }[] }) {
  if (points.length < 2) return <p className="text-fluid-2xs text-slate-500">잔액 추이는 기록이 두 건 이상일 때 선으로 보입니다.</p>;
  const values = points.map((point) => point.balanceAfterKrw);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 28 - ((value - min) / span) * 24;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 100 32" className="h-12 w-full" role="img" aria-label="잔액 추이">
      <polyline fill="none" stroke="#0f172a" strokeWidth="1.5" points={coords.join(' ')} />
    </svg>
  );
}

export function ReceiptWalletHistoryModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<(typeof FILTERS)[number][0]>('all');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ReceiptWalletLedgerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [trend, setTrend] = useState<{ at: string; balanceAfterKrw: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReceiptWalletLedger(type, PAGE, page * PAGE)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setTrend(res.trend);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '내역을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [page, type]);

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 lg:items-center">
      <div className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-white lg:max-h-[90vh] lg:max-w-lg lg:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">충전·사용 내역</h2>
          <button type="button" className="min-h-10 rounded-lg px-3 text-fluid-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={onClose}>닫기</button>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`min-h-9 rounded-lg px-2 text-fluid-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${type === id ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                onClick={() => { setType(id); setPage(0); }}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <p className="text-fluid-2xs text-slate-500">잔액 추이</p>
            <Trend points={trend} />
          </div>
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
          <ul className="space-y-1.5">
            {items.map((row) => (
              <li key={`${row.kind}-${row.id}`} className="rounded-lg border border-slate-200 px-2 py-1.5">
                <p className="flex items-center justify-between gap-2 text-fluid-xs text-slate-900">
                  <span className="truncate">{labelOf(row)}{row.memo ? ` · ${row.memo}` : ''}</span>
                  <span className="shrink-0 tabular-nums">{won(row.amountKrw)}</span>
                </p>
                <p className="text-fluid-2xs text-slate-500">
                  {new Date(row.createdAt).toLocaleString('ko-KR')} · 잔액 {row.balanceAfterKrw.toLocaleString('ko-KR')}원
                </p>
              </li>
            ))}
          </ul>
          {items.length === 0 && !error ? <p className="text-fluid-xs text-slate-500">내역이 없습니다.</p> : null}
          {total > PAGE ? (
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none" disabled={page === 0} onClick={() => setPage((n) => Math.max(0, n - 1))}>이전</button>
              <span className="text-fluid-2xs tabular-nums text-slate-600">{page + 1} / {Math.ceil(total / PAGE)}</span>
              <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((n) => n + 1)}>다음</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
