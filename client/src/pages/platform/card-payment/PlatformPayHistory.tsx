import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchUsageFeeCardPayments, type UsageFeeCardPaymentRow } from '../../../api/platformCardPayment';
import { ListPaginationBar } from '../../../components/ui/ListPaginationBar';
import { UsageFeeSameDayCancelButton } from '../../../components/platform/UsageFeeSameDayCancelButton';
import { INQUIRY_LIST_PAGE_SIZE_OPTIONS, parseInquiryListPageSize, parseListPage } from '../../../utils/listPagination';

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'keyin', label: '수기' },
  { id: 'link', label: '링크' },
  { id: 'invoice', label: '이용료' },
  { id: 'proxy', label: '청소비 대신 받기' },
  { id: 'other', label: '기타' },
] as const;

function chipClass(label: string): string {
  if (label === '결제 완료') return 'border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]';
  if (label === '결제 대기') return 'border-[#f0d27a] bg-[#fff6dc] text-[#7a5300]';
  if (label === '취소' || label === '결제 실패') return 'border-red-200 bg-red-50 text-[#b42318]';
  return 'border-gray-200 bg-gray-100 text-gray-600';
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function party(row: UsageFeeCardPaymentRow): string {
  return [row.tenantName, row.inquiryLabel].filter(Boolean).join(' · ') || '—';
}

export function PlatformPayHistory() {
  const [params, setParams] = useSearchParams();
  const page = parseListPage(params.get('page'));
  const pageSize = parseInquiryListPageSize(params.get('pageSize'));
  const filter = params.get('hist') || 'all';
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<UsageFeeCardPaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const channel = filter === 'keyin' ? 'KEYIN' : filter === 'link' ? 'LINK' : undefined;
  const purpose = filter === 'invoice' ? 'INVOICE' : filter === 'proxy' ? 'CLEANING_PROXY' : filter === 'other' ? 'OTHER' : undefined;

  const load = useCallback(() => {
    void fetchUsageFeeCardPayments(pageSize, (page - 1) * pageSize, undefined, { channel, purpose })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '결제 기록을 불러오지 못했습니다.'));
  }, [page, pageSize, channel, purpose]);

  useEffect(() => {
    load();
  }, [load]);

  function writeQuery(next: { page?: number; pageSize?: number; hist?: string }) {
    const query = new URLSearchParams(params);
    query.set('page', String(next.page ?? page));
    query.set('pageSize', String(next.pageSize ?? pageSize));
    if (next.hist) query.set('hist', next.hist);
    setParams(query, { replace: true });
  }

  function copyLink(row: UsageFeeCardPaymentRow) {
    if (!row.linkUrl) return;
    void navigator.clipboard.writeText(row.linkUrl).then(() => {
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-full border px-2.5 py-1 text-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              filter === item.id ? 'border-[#111a2b] bg-[#111a2b] text-white hover:bg-slate-800' : 'border-gray-200 bg-white text-gray-700'
            }`}
            onClick={() => writeQuery({ page: 1, hist: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ListPaginationBar
        mode="summary"
        page={page}
        pageSize={pageSize}
        total={total}
        pageSizeOptions={INQUIRY_LIST_PAGE_SIZE_OPTIONS}
        onPageChange={(next) => writeQuery({ page: next })}
        onPageSizeChange={(size) => writeQuery({ page: 1, pageSize: size })}
      />
      <div className="space-y-2 lg:hidden">
        {items.map((row) => (
          <article key={row.id} className="rounded-lg border border-gray-200 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-gray-900">{row.goodsName}</p>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${chipClass(row.statusLabel ?? '')}`}>{row.statusLabel}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{formatWhen(row.paidAt)} · {row.methodLabel} · {row.purposeLabel}</p>
            <p className="truncate text-xs text-gray-600" title={party(row)}>{party(row)}</p>
            <p className="text-right text-sm tabular-nums">{row.amountKrw.toLocaleString('ko-KR')}원</p>
            {row.statusLabel === '결제 대기' && row.linkUrl ? (
              <button type="button" className="mt-1 text-xs text-[#1f4fb8] underline" onClick={() => copyLink(row)}>
                {copiedId === row.id ? '복사됨' : '링크 복사'}
              </button>
            ) : null}
            {row.status === 'APPROVED' ? <UsageFeeSameDayCancelButton row={row} onDone={load} /> : null}
          </article>
        ))}
      </div>
      <div className="hidden w-full min-w-0 overflow-x-auto lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              {['날짜', '방식', '용도', '업체·건', '상품명', '금액', '상태'].map((head) => (
                <th key={head} className="px-2 py-2 text-center">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-gray-100">
                <td className="px-2 py-2 text-center text-xs">{formatWhen(row.paidAt)}</td>
                <td className="px-2 py-2 text-center">{row.methodLabel}</td>
                <td className="px-2 py-2 text-center">{row.purposeLabel}</td>
                <td className="max-w-[180px] truncate px-2 py-2 text-center" title={party(row)}>{party(row)}</td>
                <td className="max-w-[160px] truncate px-2 py-2 text-center" title={row.goodsName}>{row.goodsName}</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.amountKrw.toLocaleString('ko-KR')}원</td>
                <td className="px-2 py-2 text-center">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${chipClass(row.statusLabel ?? '')}`}>{row.statusLabel}</span>
                  {row.approvalNo ? <p className="mt-1 text-xs text-gray-500">승인 {row.approvalNo}{row.cardLast4 ? ` · ${row.cardLast4}` : ''}</p> : null}
                  {row.statusLabel === '결제 대기' && row.linkUrl ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-[#1f4fb8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      onClick={() => copyLink(row)}
                    >
                      {copiedId === row.id ? '복사됨' : '링크 복사'}
                    </button>
                  ) : null}
                  {row.status === 'APPROVED' ? <UsageFeeSameDayCancelButton row={row} onDone={load} /> : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-8 text-center text-sm text-gray-500">결제 내역이 없습니다.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <ListPaginationBar
        mode="nav"
        page={page}
        pageSize={pageSize}
        total={total}
        pageSizeOptions={INQUIRY_LIST_PAGE_SIZE_OPTIONS}
        onPageChange={(next) => writeQuery({ page: next })}
        onPageSizeChange={(size) => writeQuery({ page: 1, pageSize: size })}
      />
    </div>
  );
}
