import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchUsageFeeCardPayments, type UsageFeeCardPaymentRow } from '../../api/platformCardPayment';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { CARD_SECTION } from '../../utils/platformUi';
import { INQUIRY_LIST_PAGE_SIZE_OPTIONS, parseInquiryListPageSize, parseListPage } from '../../utils/listPagination';

const METHODS = [
  { id: '', label: '전체' },
  { id: 'BANK', label: '통장' },
  { id: 'CARD', label: '카드' },
] as const;

const METHOD_LABEL: Record<UsageFeeCardPaymentRow['payMethod'], string> = {
  BANK: '통장',
  KEYIN: '카드 수기',
  PAY_WINDOW: '카드 결제창',
};

function statusLabel(status: UsageFeeCardPaymentRow['status']): string {
  if (status === 'PENDING') return '승인 대기';
  if (status === 'FAILED') return '실패';
  return '승인';
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function PlatformBillingSettlementPage() {
  const [params, setParams] = useSearchParams();
  const page = parseListPage(params.get('page'));
  const pageSize = parseInquiryListPageSize(params.get('pageSize'));
  const method = METHODS.some((item) => item.id === (params.get('method') ?? '')) ? (params.get('method') ?? '') : '';
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<UsageFeeCardPaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetchUsageFeeCardPayments(pageSize, (page - 1) * pageSize, method || undefined)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '정산 기록을 불러오지 못했습니다.'));
  }, [page, pageSize, method]);

  useEffect(() => {
    load();
  }, [load]);

  function writeQuery(next: { page?: number; pageSize?: number; method?: string }) {
    const query = new URLSearchParams(params);
    query.set('page', String(next.page ?? page));
    query.set('pageSize', String(next.pageSize ?? pageSize));
    const nextMethod = next.method ?? method;
    if (nextMethod) query.set('method', nextMethod);
    else query.delete('method');
    setParams(query, { replace: true });
  }

  return (
    <div className="min-w-0 w-full max-w-6xl space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">정산</h1>
          <p className="mt-1 text-sm text-gray-500">
            입금 확인은 통장, 카드 승인은 카드로 남습니다. 카드 금액은 이용료에 부가세 10%를 더한 금액입니다.
          </p>
        </div>
        <Link
          to="/platform/billing"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          결제 관리
        </Link>
      </div>
      <section className={CARD_SECTION}>
        <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {METHODS.map((item) => (
            <button
              key={item.id || 'all'}
              type="button"
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
                method === item.id ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-white',
              ].join(' ')}
              onClick={() => writeQuery({ page: 1, method: item.id })}
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
              <p className="truncate text-sm font-medium text-gray-900">{row.tenantName ?? '업체 없음'}</p>
              <p className="text-xs text-gray-500">
                {formatWhen(row.paidAt)} · {METHOD_LABEL[row.payMethod]} · {statusLabel(row.status)}
              </p>
              <p className="text-right text-sm tabular-nums text-gray-900">{won(row.amountKrw)}</p>
            </article>
          ))}
        </div>
        <div className="hidden w-full min-w-0 overflow-x-auto lg:block">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="px-2 py-2 text-center">결제일</th>
                <th className="px-2 py-2 text-center">업체</th>
                <th className="px-2 py-2 text-center">수단</th>
                <th className="px-2 py-2 text-center">상태</th>
                <th className="px-2 py-2 text-center">구분</th>
                <th className="px-2 py-2 text-center">공급가</th>
                <th className="px-2 py-2 text-center">부가세</th>
                <th className="px-2 py-2 text-center">결제금액</th>
                <th className="px-2 py-2 text-center">청구</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-2 py-2 text-center text-xs">{formatWhen(row.paidAt)}</td>
                  <td className="px-2 py-2 text-center">{row.tenantName ?? '—'}</td>
                  <td className="px-2 py-2 text-center">{METHOD_LABEL[row.payMethod]}</td>
                  <td className="px-2 py-2 text-center">{statusLabel(row.status)}</td>
                  <td className="px-2 py-2 text-center">{row.purpose === 'INVOICE' ? '이용료' : '기타'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.supplyAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.vatAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.amountKrw)}</td>
                  <td className="px-2 py-2 text-center">{row.purpose === 'INVOICE' ? (row.invoiceApplied ? '반영' : '미반영') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">아직 정산 기록이 없습니다.</p> : null}
        <ListPaginationBar
          mode="nav"
          page={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={INQUIRY_LIST_PAGE_SIZE_OPTIONS}
          onPageChange={(next) => writeQuery({ page: next })}
          onPageSizeChange={(size) => writeQuery({ page: 1, pageSize: size })}
        />
      </section>
    </div>
  );
}
