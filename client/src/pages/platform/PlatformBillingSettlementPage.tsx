import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchUsageFeeCardPayments, type UsageFeeCardPaymentRow } from '../../api/platformCardPayment';
import { retryPlatformWalletInvoice } from '../../api/platformReceipts';
import { UsageFeeSameDayCancelButton } from '../../components/platform/UsageFeeSameDayCancelButton';
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

function statusLabel(row: UsageFeeCardPaymentRow): string {
  if (row.needsReconcile) return '반영 확인 필요';
  if (row.status === 'PENDING') return '승인 대기';
  if (row.status === 'FAILED') return '실패';
  if (row.status === 'CANCELLED') return '취소';
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

type WalletInvoiceStatus = NonNullable<UsageFeeCardPaymentRow['walletTaxInvoice']>['status'];

function walletInvoiceBadge(status: WalletInvoiceStatus): { cls: string; label: string } {
  if (status === 'ISSUED') return { cls: 'bg-emerald-50 text-emerald-700', label: '발행됨' };
  if (status === 'FAILED') return { cls: 'bg-red-50 text-red-700', label: '실패' };
  if (status === 'PENDING') return { cls: 'bg-amber-50 text-amber-800', label: '대기' };
  return { cls: 'bg-gray-100 text-gray-500', label: '해당없음' };
}

export function PlatformBillingSettlementPage() {
  const [params, setParams] = useSearchParams();
  const page = parseListPage(params.get('page'));
  const pageSize = parseInquiryListPageSize(params.get('pageSize'));
  const method = METHODS.some((item) => item.id === (params.get('method') ?? '')) ? (params.get('method') ?? '') : '';
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<UsageFeeCardPaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

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

  async function handleRetryInvoice(id: string) {
    setRetryingId(id);
    setRetryMsg(null);
    try {
      await retryPlatformWalletInvoice(id);
      setRetryMsg({ id, msg: '재발행 요청을 보냈습니다.', ok: true });
      load();
    } catch (e) {
      setRetryMsg({ id, msg: e instanceof Error ? e.message : '재발행에 실패했습니다.', ok: false });
    } finally {
      setRetryingId(null);
    }
  }

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
            입금 확인은 통장, 카드 승인은 카드로 남습니다. 카드는 이용료(부가세 10%)와 청소비서 지갑 충전입니다.
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
        {retryMsg ? (
          <p className={`text-sm ${retryMsg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{retryMsg.msg}</p>
        ) : null}
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
          {items.map((row) => {
            const wi = row.walletTaxInvoice;
            const wiBadge = wi ? walletInvoiceBadge(wi.status) : null;
            return (
              <article key={row.id} className="rounded-lg border border-gray-200 p-2">
                <p className="truncate text-sm font-medium text-gray-900">{row.tenantName ?? '업체 없음'}</p>
                <p className="text-xs text-gray-500">
                  {formatWhen(row.paidAt)} · {METHOD_LABEL[row.payMethod]} · {row.goodsName === '청소비서 지갑' ? '지갑' : row.purpose === 'INVOICE' ? '이용료' : '기타'} · {statusLabel(row)}
                </p>
                <p className="text-right text-sm tabular-nums text-gray-900">{won(row.amountKrw)}</p>
                {row.goodsName === '청소비서 지갑' ? (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                    {row.payMethod === 'KEYIN' || row.payMethod === 'PAY_WINDOW' ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">세금계산서 해당없음(카드)</span>
                    ) : wiBadge ? (
                      <>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${wiBadge.cls}`}>세금계산서 {wiBadge.label}</span>
                        {wi?.status === 'FAILED' ? (
                          <button
                            type="button"
                            className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            disabled={retryingId === row.id}
                            onClick={() => void handleRetryInvoice(row.id)}
                          >
                            {retryingId === row.id ? '요청 중…' : '다시 발행'}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">세금계산서 —</span>
                    )}
                  </div>
                ) : null}
                <div className="mt-1 flex justify-end">
                  <UsageFeeSameDayCancelButton row={row} onDone={load} />
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden w-full min-w-0 overflow-x-auto lg:block">
          <table className="w-full min-w-[960px] border-collapse text-sm">
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
                <th className="px-2 py-2 text-center">세금계산서</th>
                <th className="px-2 py-2 text-center">취소</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const wi = row.walletTaxInvoice;
                const wiBadge = wi ? walletInvoiceBadge(wi.status) : null;
                const isCardMethod = row.payMethod === 'KEYIN' || row.payMethod === 'PAY_WINDOW';
                return (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-2 py-2 text-center text-xs">{formatWhen(row.paidAt)}</td>
                  <td className="px-2 py-2 text-center">{row.tenantName ?? '—'}</td>
                  <td className="px-2 py-2 text-center">{METHOD_LABEL[row.payMethod]}</td>
                  <td className="px-2 py-2 text-center">{statusLabel(row)}</td>
                  <td className="px-2 py-2 text-center">{row.goodsName === '청소비서 지갑' ? '지갑' : row.purpose === 'INVOICE' ? '이용료' : '기타'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.supplyAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.vatAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.amountKrw)}</td>
                  <td className="px-2 py-2 text-center">
                    {row.goodsName === '청소비서 지갑'
                      ? row.invoiceApplied
                        ? '잔액 반영'
                        : '미반영'
                      : row.purpose === 'INVOICE'
                        ? row.invoiceApplied
                          ? '반영'
                          : '미반영'
                        : '—'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {isCardMethod ? (
                      <span className="text-xs text-gray-400">해당없음(카드)</span>
                    ) : wiBadge ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${wiBadge.cls}`}>{wiBadge.label}</span>
                        {wi?.status === 'FAILED' ? (
                          <button
                            type="button"
                            className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            disabled={retryingId === row.id}
                            onClick={() => void handleRetryInvoice(row.id)}
                          >
                            {retryingId === row.id ? '요청 중…' : '다시 발행'}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <UsageFeeSameDayCancelButton row={row} onDone={load} />
                  </td>
                </tr>
                );
              })}
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
