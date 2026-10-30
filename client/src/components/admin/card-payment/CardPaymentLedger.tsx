import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cancelCardPayment,
  requestCardPaymentCancel,
  deleteCardPayment,
  fetchCardPaymentList,
  type CardPaymentListResponse,
  type CardPaymentRow,
} from '../../../api/cardPayment';
import { useEffectiveStaffAdmin } from '../../../hooks/useEffectiveStaffAdmin';
import { getToken } from '../../../stores/auth';
import { YearMonthSelect, YmdSelect } from '../../ui/DateQuerySelects';
import { ListPaginationBar } from '../../ui/ListPaginationBar';
import { kstTodayYmd } from '../../../utils/dateFormat';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../../utils/listPagination';
import { CardPaymentFeeSummary } from './CardPaymentFeeSummary';
import { CardPaymentListCards } from './CardPaymentListCards';
import { CardPaymentListTable } from './CardPaymentListTable';
import { CardPaymentDeleteDialog } from './CardPaymentDeleteDialog';
import { Button } from '../../ui/Button';
import { InlineConfirm } from '../../ui/InlineConfirm';

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
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<CardPaymentRow | null>(null);
  const [requestRow, setRequestRow] = useState<CardPaymentRow | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CardPaymentRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  const cancelPayment = (row: CardPaymentRow) => {
    setCancelError(null);
    if (row.cancelVia === 'api') {
      setRequestRow(null);
      setConfirmRow(row);
      return;
    }
    setConfirmRow(null);
    setRequestRow(row);
    setRequestReason('');
  };

  const runDirectCancel = () => {
    const token = getToken();
    if (!token || !confirmRow) return;
    setCancellingId(confirmRow.id);
    void cancelCardPayment(token, confirmRow.id)
      .then(() => {
        setConfirmRow(null);
        setReloadKey((n) => n + 1);
      })
      .catch((e: unknown) => setCancelError(e instanceof Error ? e.message : '취소하지 못했습니다.'))
      .finally(() => setCancellingId(null));
  };

  const sendCancelRequest = () => {
    const token = getToken();
    if (!token || !requestRow) return;
    setCancellingId(requestRow.id);
    void requestCardPaymentCancel(token, requestRow.id, requestReason)
      .then(() => {
        setRequestRow(null);
        setRequestReason('');
        setReloadKey((n) => n + 1);
      })
      .catch((e: unknown) => setCancelError(e instanceof Error ? e.message : '취소 요청을 올리지 못했습니다.'))
      .finally(() => setCancellingId(null));
  };

  const { effectiveStaffAdmin } = useEffectiveStaffAdmin();

  const confirmDelete = (password: string) => {
    const token = getToken();
    if (!token || !deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    void deleteCardPayment(token, deleteTarget.id, password)
      .then(() => {
        setDeleteTarget(null);
        setReloadKey((n) => n + 1);
      })
      .catch((e: unknown) => setDeleteError(e instanceof Error ? e.message : '삭제하지 못했습니다.'))
      .finally(() => setDeleting(false));
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
          시각은 한국시간입니다. 오늘 링크 결제는 결제 취소로 바로 취소되고, 수기와 지난 결제는 취소 요청을 올립니다. 결재완료와 취소 건은 삭제할 수 없습니다.
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
        {confirmRow ? (
          <InlineConfirm
            question="이 인증결재를 전액 취소할까요?"
            confirmLabel="전액 취소"
            busy={cancellingId === confirmRow.id}
            onConfirm={runDirectCancel}
            onCancel={() => setConfirmRow(null)}
          />
        ) : null}
        {requestRow ? (
          <div className="mb-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="text-fluid-xs text-slate-700">{requestRow.customerName} 결제의 취소 사유</p>
            <textarea value={requestReason} onChange={(e) => setRequestReason(e.target.value)} className="min-h-16 w-full rounded-lg border border-slate-300 p-2 text-fluid-xs" />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" disabled={!requestReason.trim() || cancellingId === requestRow.id} onClick={sendCancelRequest}>취소 요청</Button>
              <Button size="sm" variant="secondary" onClick={() => setRequestRow(null)}>그만두기</Button>
            </div>
          </div>
        ) : null}
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
              onDelete={effectiveStaffAdmin ? (row) => { setDeleteError(null); setDeleteTarget(row); } : undefined}
              cancellingId={cancellingId}
              deletingId={deleting ? deleteTarget?.id : null}
            />
            <CardPaymentListCards
              items={data.items}
              onCancel={cancelPayment}
              onDelete={effectiveStaffAdmin ? (row) => { setDeleteError(null); setDeleteTarget(row); } : undefined}
              cancellingId={cancellingId}
              deletingId={deleting ? deleteTarget?.id : null}
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
      <CardPaymentDeleteDialog
        open={Boolean(deleteTarget)}
        customerName={deleteTarget?.customerName ?? ''}
        busy={deleting}
        error={deleteError}
        onClose={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
