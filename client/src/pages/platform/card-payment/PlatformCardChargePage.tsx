import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchUsageFeeCardPayments, type UsageFeeCardPaymentRow } from '../../../api/platformCardPayment';
import { ListPaginationBar } from '../../../components/ui/ListPaginationBar';
import { CARD_SECTION } from '../../../utils/platformUi';
import { INQUIRY_LIST_PAGE_SIZE_OPTIONS, parseInquiryListPageSize, parseListPage } from '../../../utils/listPagination';
import { PlatformCardPaymentTabs } from './PlatformCardPaymentTabs';
import { PlatformUsageFeeKeyinForm } from './PlatformUsageFeeKeyinForm';
import { UsageFeeSameDayCancelButton } from '../../../components/platform/UsageFeeSameDayCancelButton';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function PlatformCardChargePage() {
  const [params, setParams] = useSearchParams();
  const page = parseListPage(params.get('page'));
  const pageSize = parseInquiryListPageSize(params.get('pageSize'));
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<UsageFeeCardPaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetchUsageFeeCardPayments(pageSize, (page - 1) * pageSize, 'KEYIN')
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '결제 기록을 불러오지 못했습니다.'));
  }, [page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function writeListQuery(nextPage: number, nextPageSize: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(nextPage));
    next.set('pageSize', String(nextPageSize));
    setParams(next, { replace: true });
  }

  return (
    <div className="min-w-0 w-full max-w-5xl space-y-6 pb-8">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-gray-900">카드결재</h1>
        <PlatformCardPaymentTabs />
      </div>
      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">이용료 수기결재</h2>
        <p className="text-xs text-gray-500">서비스브릿지 수기 가맹으로 승인됩니다. 카드번호는 저장하지 않습니다.</p>
        <PlatformUsageFeeKeyinForm
          onPaid={() => {
            if (page === 1) load();
            else writeListQuery(1, pageSize);
          }}
        />
      </section>
      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">수기 승인 기록</h2>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={INQUIRY_LIST_PAGE_SIZE_OPTIONS}
          onPageChange={(next) => writeListQuery(next, pageSize)}
          onPageSizeChange={(size) => writeListQuery(1, size)}
        />
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-center text-xs text-gray-500">
                <th className="px-2 py-2 text-center">결제일</th>
                <th className="px-2 py-2 text-center">구분</th>
                <th className="px-2 py-2 text-center">업체</th>
                <th className="px-2 py-2 text-center">내용</th>
                <th className="px-2 py-2 text-center">금액</th>
                <th className="px-2 py-2 text-center">승인</th>
                <th className="px-2 py-2 text-center">청구</th>
                <th className="px-2 py-2 text-center">취소</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-2 py-2 text-center text-xs">{formatWhen(row.paidAt)}</td>
                  <td className="px-2 py-2 text-center">{row.purpose === 'INVOICE' ? '이용료' : '기타'}</td>
                  <td className="px-2 py-2 text-center">{row.tenantName ?? '—'}</td>
                  <td className="max-w-[220px] truncate px-2 py-2 text-center" title={row.memo ?? row.goodsName}>
                    {row.memo || row.goodsName}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.amountKrw.toLocaleString('ko-KR')}원</td>
                  <td className="px-2 py-2 text-center">{row.approvalNo ?? '—'}</td>
                  <td className="px-2 py-2 text-center">{row.purpose === 'INVOICE' ? (row.invoiceApplied ? '반영' : '미반영') : '—'}</td>
                  <td className="px-2 py-2 text-center">
                    <UsageFeeSameDayCancelButton row={row} onDone={load} />
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-8 text-center text-sm text-gray-500">
                    아직 수기 승인 기록이 없습니다.
                  </td>
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
          onPageChange={(next) => writeListQuery(next, pageSize)}
          onPageSizeChange={(size) => writeListQuery(1, size)}
        />
      </section>
    </div>
  );
}
