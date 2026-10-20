import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cancelCardPayment,
  fetchCardPaymentList,
  fetchTenantPgState,
  type CardPaymentListResponse,
  type CardPaymentRow,
} from '../../../api/cardPayment';
import { openSellerCenterLoggedIn } from '../../../utils/openSellerCenterLogin';
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
  const [sellerLogin, setSellerLogin] = useState<{ loginId: string; password: string } | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
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
    void fetchTenantPgState(token)
      .then((res) => {
        const seller = res.sellerCenter;
        if (seller?.loginId && seller.password) setSellerLogin({ loginId: seller.loginId, password: seller.password });
      })
      .catch(() => setSellerLogin(null));
  }, []);

  const cancelPayment = (row: CardPaymentRow) => {
    if (row.cancelVia === 'api') {
      const token = getToken();
      if (!token) return;
      if (!window.confirm('이 인증결재를 전액 취소할까요?')) return;
      setCancelError(null);
      setCancellingId(row.id);
      void cancelCardPayment(token, row.id)
        .then(() => setReloadKey((n) => n + 1))
        .catch((e: unknown) => setCancelError(e instanceof Error ? e.message : '취소하지 못했습니다.'))
        .finally(() => setCancellingId(null));
      return;
    }
    if (!sellerLogin) {
      setCancelError('판매자센터 아이디가 없습니다. PG 연동에서 원성이 아이디와 비밀번호를 넣어야 합니다.');
      return;
    }
    setCancelError(null);
    const opened = openSellerCenterLoggedIn(sellerLogin.loginId, sellerLogin.password);
    if (!opened) setCancelError('팝업이 막혀 판매자센터를 열지 못했습니다.');
  };

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
  }, [datePreset, month, day, status, page, pageSize, reloadKey]);

  const total = data?.total ?? 0;
  const safePage = useMemo(() => clampListPage(page, pageSize, total), [page, pageSize, total]);

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-4">
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
          결재완료만 보거나, 아직 결제되지 않은 대기도 따로 볼 수 있습니다. 오늘 인증결재는 결제 취소로 바로 취소되고, 수기는 판매자센터에서 취소합니다.
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
          <div className="mt-2 flex flex-wrap gap-1">
            {[
              { id: '', label: '전체' },
              { id: 'APPROVED', label: '결재완료' },
              { id: 'PENDING', label: '대기' },
              { id: 'LINK_SENT', label: '결제 대기' },
              { id: 'DRAFT', label: '작성 대기' },
              { id: 'AWAITING_PG', label: 'PG 대기' },
              { id: 'FAILED', label: '실패' },
              { id: 'CANCELLED', label: '취소' },
            ].map((item) => (
              <button
                key={item.id || 'all'}
                type="button"
                onClick={() => patch({ status: item.id || null })}
                className={`rounded-lg border px-2 py-1 text-fluid-2xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                  status === item.id ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
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
        {cancelError ? <p className="px-2 pb-2 text-fluid-xs text-red-700">{cancelError}</p> : null}
        {loading && !data ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
        {data && data.items.length === 0 && !loading ? (
          <p className="p-8 text-center text-fluid-sm text-slate-500">결제 내역이 없습니다.</p>
        ) : null}
        {data && data.items.length > 0 ? (
          <>
            <p className="mb-2 text-fluid-2xs text-slate-500 lg:hidden">표는 넓은 화면에서 볼 수 있습니다. 카드로 스크롤하세요.</p>
            <CardPaymentListTable
              items={data.items}
              onCancel={cancelPayment}
              sellerReady={Boolean(sellerLogin)}
              cancellingId={cancellingId}
            />
            <CardPaymentListCards
              items={data.items}
              onCancel={cancelPayment}
              sellerReady={Boolean(sellerLogin)}
              cancellingId={cancellingId}
            />
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
