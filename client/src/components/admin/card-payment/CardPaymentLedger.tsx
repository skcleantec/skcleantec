import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CARD_PAYMENT_STATUS_LABEL, CARD_PAYMENT_STATUSES } from '@shared/cardPayment';
import { fetchCardPaymentList, type CardPaymentListResponse } from '../../../api/cardPayment';
import { getToken } from '../../../stores/auth';
import { YearMonthSelect, YmdSelect } from '../../ui/DateQuerySelects';
import { ListPaginationBar } from '../../ui/ListPaginationBar';
import { kstTodayYmd } from '../../../utils/dateFormat';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../../utils/listPagination';
import { CardPaymentFeeSummary } from './CardPaymentFeeSummary';
import { CardPaymentListCards } from './CardPaymentListCards';
import { CardPaymentListTable } from './CardPaymentListTable';

const PRESETS = [
  { id: 'today', label: '당일' },
  { id: 'all', label: '전체' },
  { id: 'month', label: '월별' },
  { id: 'day', label: '날짜' },
] as const;

/** 결제 내역과 PG신청(연결 후)이 같은 표·필터를 쓴다. */
export function CardPaymentLedger() {
  const [params, setParams] = useSearchParams();
  const datePreset = params.get('datePreset') || 'today';
  const month = params.get('month') || kstTodayYmd().slice(0, 7);
  const day = params.get('day') || kstTodayYmd();
  const status = params.get('status') || '';
  const page = parseListPage(params.get('page'));
  const pageSize = parseInquiryListPageSize(params.get('pageSize'));
  const [data, setData] = useState<CardPaymentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const patch = useCallback(
    (next: Record<string, string | null>) => {
      const n = new URLSearchParams(params);
      for (const [k, v] of Object.entries(next)) {
        if (!v) n.delete(k);
        else n.set(k, v);
      }
      if (!('page' in next)) n.set('page', '1');
      setParams(n, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void fetchCardPaymentList(token, {
      datePreset,
      month: datePreset === 'month' ? month : undefined,
      day: datePreset === 'day' ? day : undefined,
      status: status || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datePreset, month, day, status, page, pageSize]);

  const total = data?.total ?? 0;
  const safePage = useMemo(() => clampListPage(page, pageSize, total), [page, pageSize, total]);

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-4">
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
          팀장·고객·금액·수수료(업체 3.3% · 플랫폼 차액)를 한곳에서 봅니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => patch({ datePreset: p.id })}
              className={`rounded-lg border px-2 py-1 text-fluid-2xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                datePreset === p.id ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
          {datePreset === 'month' ? <YearMonthSelect value={month} onChange={(v) => patch({ month: v })} /> : null}
          {datePreset === 'day' ? <YmdSelect value={day} onChange={(v) => patch({ day: v })} /> : null}
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-fluid-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            value={status}
            onChange={(e) => patch({ status: e.target.value || null })}
          >
            <option value="">상태 전체</option>
            {CARD_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CARD_PAYMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <ListPaginationBar
            mode="summary"
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => patch({ page: String(p) })}
            onPageSizeChange={(s) => patch({ pageSize: String(s), page: '1' })}
          />
        </div>
      </div>

      {data ? (
        <CardPaymentFeeSummary
          approvedCount={data.summary.approvedCount}
          amountWon={data.summary.amountWon}
          tenantFeeWon={data.summary.tenantFeeWon}
          platformSpreadWon={data.summary.platformSpreadWon}
          tenantNetWon={data.summary.tenantNetWon}
        />
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-4">
        {error ? <p className="p-6 text-center text-fluid-sm text-red-700">{error}</p> : null}
        {loading && !data ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
        {data && data.items.length === 0 && !loading ? (
          <p className="p-8 text-center text-fluid-sm text-slate-500">결제 내역이 없습니다.</p>
        ) : null}
        {data && data.items.length > 0 ? (
          <>
            <p className="mb-2 text-fluid-2xs text-slate-500 lg:hidden">표는 넓은 화면에서 볼 수 있습니다. 카드로 스크롤하세요.</p>
            <CardPaymentListTable items={data.items} />
            <CardPaymentListCards items={data.items} />
          </>
        ) : null}
        {!loading ? (
          <ListPaginationBar
            mode="nav"
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => patch({ page: String(p) })}
            onPageSizeChange={(s) => patch({ pageSize: String(s), page: '1' })}
          />
        ) : null}
      </div>
    </div>
  );
}
