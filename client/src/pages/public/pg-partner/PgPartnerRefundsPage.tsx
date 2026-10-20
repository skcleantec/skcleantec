import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CARD_PAYMENT_STATUS_LABEL, type CardPaymentStatus } from '@shared/cardPayment';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

type Payment = {
  id: string;
  kind: '청소' | '이용료';
  tenantName: string;
  customerName: string;
  customerPhone: string | null;
  inquiryNumber: string | null;
  method: string;
  status: string;
  amountWon: number;
  pgOrderId: string | null;
  cardLast4: string | null;
  approvalNo: string | null;
  paidAt: string | null;
  createdAt: string;
  failReason: string | null;
};

const FILTERS = [
  { id: '', label: '전체' },
  { id: 'APPROVED', label: '승인' },
  { id: 'CANCELLED', label: '취소' },
  { id: 'FAILED', label: '실패' },
  { id: 'PENDING', label: '대기' },
] as const;

const CHIP =
  'min-h-9 rounded-lg px-3 text-fluid-xs font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function statusLabel(status: string) {
  return CARD_PAYMENT_STATUS_LABEL[status as CardPaymentStatus] ?? (status === 'PENDING' ? '대기' : status);
}

function kst(iso: string | null) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

function won(n: number) {
  return `${Number(n || 0).toLocaleString('ko-KR')}원`;
}

export function PgPartnerPaymentsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Payment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 50;

  useEffect(() => {
    setItems(null);
    setSelected(null);
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
    if (status) params.set('status', status);
    void fetch(`/api/public/card-payment/pg-partner/payments?${params}`, {
      headers: { Authorization: `Bearer ${readPgPartnerToken()}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return null;
        }
        if (!res.ok) throw new Error('결제 내역을 불러오지 못했습니다.');
        return res.json() as Promise<{ items: Payment[]; total: number }>;
      })
      .then((data) => {
        if (!data) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '결제 내역을 불러오지 못했습니다.'));
  }, [navigate, page, status]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-fluid-base font-semibold text-slate-900">결제 내역</h1>
        <p className="mt-1 text-fluid-xs text-slate-600">모든 업체의 승인·취소·실패·대기가 한 표에 모입니다. 행을 누르면 주문번호와 카드, 시각이 열립니다.</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((item) => (
          <button
            key={item.id || 'all'}
            type="button"
            className={`${CHIP} ${status === item.id ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-700'}`}
            onClick={() => {
              setStatus(item.id);
              setPage(0);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {!items && !error ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {items && items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-fluid-sm text-slate-500">해당 내역이 없습니다.</p>
      ) : null}
      {items && items.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] border-collapse text-fluid-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['업체', '구분', '고객', '방식', '상태', '금액', '주문번호', '카드', '시각'].map((label) => (
                  <th key={label} className="px-2 py-2 text-center font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className={selected?.id === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'}>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="max-w-[10rem] truncate font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      title={row.tenantName}
                    >
                      {row.tenantName}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">{row.kind}</td>
                  <td className="max-w-[8rem] truncate px-2 py-2 text-center" title={row.customerName}>{row.customerName || '—'}</td>
                  <td className="px-2 py-2 text-center">{row.method}</td>
                  <td className="px-2 py-2 text-center">{statusLabel(row.status)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.amountWon)}</td>
                  <td className="max-w-[9rem] truncate px-2 py-2 text-center" title={row.pgOrderId ?? ''}>{row.pgOrderId || '—'}</td>
                  <td className="px-2 py-2 text-center">{row.cardLast4 ? `•••• ${row.cardLast4}` : '—'}</td>
                  <td className="px-2 py-2 text-center">{kst(row.paidAt || row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {total > pageSize ? (
        <div className="flex items-center justify-between gap-2">
          <button type="button" className={`${CHIP} bg-white`} disabled={page <= 0} onClick={() => setPage((n) => Math.max(0, n - 1))}>이전</button>
          <p className="text-fluid-xs text-slate-600">{page + 1} / {pageCount} · {total.toLocaleString('ko-KR')}건</p>
          <button type="button" className={`${CHIP} bg-white`} disabled={(page + 1) * pageSize >= total} onClick={() => setPage((n) => n + 1)}>다음</button>
        </div>
      ) : null}
      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-fluid-sm font-semibold text-slate-900">{selected.tenantName}</h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ['구분', selected.kind],
              ['고객', selected.customerName || '—'],
              ['전화', selected.customerPhone || '—'],
              ['접수번호', selected.inquiryNumber || '—'],
              ['방식', selected.method],
              ['상태', statusLabel(selected.status)],
              ['금액', won(selected.amountWon)],
              ['주문번호', selected.pgOrderId || '—'],
              ['카드', selected.cardLast4 ? `•••• ${selected.cardLast4}` : '—'],
              ['승인번호', selected.approvalNo || '—'],
              ['결제시각', kst(selected.paidAt)],
              ['등록시각', kst(selected.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-fluid-2xs text-slate-500">{label}</dt>
                <dd className="break-all text-fluid-xs text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          {selected.failReason ? <p className="mt-3 text-fluid-xs text-slate-600">메모 · {selected.failReason}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export const PgPartnerRefundsPage = PgPartnerPaymentsPage;
