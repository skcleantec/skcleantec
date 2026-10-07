import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

type RefundRow = {
  id: string;
  kind: string;
  tenantName: string;
  title: string;
  detail: string | null;
  amountKrw: number;
  approvalNo: string | null;
  pgOrderId: string | null;
  cardLast4: string | null;
  method: string;
  clerkNo: number | null;
  at: string | null;
  memo: string | null;
};

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function PgPartnerRefundsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RefundRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/public/card-payment/pg-partner/refunds', {
      headers: { Authorization: `Bearer ${readPgPartnerToken()}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return null;
        }
        if (!res.ok) throw new Error('취소·환불 내역을 불러오지 못했습니다.');
        return res.json() as Promise<{ items: RefundRow[] }>;
      })
      .then((data) => {
        if (data) setItems(data.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '취소·환불 내역을 불러오지 못했습니다.'));
  }, [navigate]);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-fluid-base font-semibold text-slate-900">취소·환불</h1>
        <p className="mt-1 text-fluid-xs text-slate-600">취소된 청소 결제와 이용료가 여기에 모입니다. 부분 환불은 이 목록을 보고 처리합니다.</p>
      </div>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {!items && !error ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {items && items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-fluid-sm text-slate-500">취소·환불 내역이 없습니다.</p>
      ) : null}
      {items?.map((row) => (
        <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900">{row.title}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs text-slate-700">{row.kind}</span>
          </div>
          <p className="mt-2 text-right text-fluid-sm font-semibold tabular-nums text-slate-900">
            {Number(row.amountKrw).toLocaleString('ko-KR')}원
          </p>
          <dl className="mt-2 space-y-1 text-fluid-xs text-slate-600">
            <div className="flex justify-between gap-2"><dt>업체</dt><dd className="text-slate-900">{row.tenantName}</dd></div>
            <div className="flex justify-between gap-2"><dt>방식</dt><dd className="text-slate-900">{row.method}</dd></div>
            {row.clerkNo ? <div className="flex justify-between gap-2"><dt>고유번호</dt><dd className="text-slate-900">{row.clerkNo}번</dd></div> : null}
            {row.detail ? <div className="flex justify-between gap-2"><dt>대상</dt><dd className="text-slate-900">{row.detail}</dd></div> : null}
            {row.pgOrderId ? <div className="flex justify-between gap-2"><dt>주문번호</dt><dd className="truncate text-slate-900">{row.pgOrderId}</dd></div> : null}
            {row.approvalNo ? <div className="flex justify-between gap-2"><dt>승인번호</dt><dd className="text-slate-900">{row.approvalNo}</dd></div> : null}
            {row.cardLast4 ? <div className="flex justify-between gap-2"><dt>카드</dt><dd className="text-slate-900">•••• {row.cardLast4}</dd></div> : null}
            {row.at ? <div className="flex justify-between gap-2"><dt>시각</dt><dd className="text-slate-900">{when(row.at)}</dd></div> : null}
            {row.memo ? <div className="flex justify-between gap-2"><dt>메모</dt><dd className="text-right text-slate-900">{row.memo}</dd></div> : null}
          </dl>
        </article>
      ))}
    </div>
  );
}
