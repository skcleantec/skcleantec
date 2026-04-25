import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DATE_RANGE_PRESET_LABELS,
  computeDateRangeFromPreset,
  type DateRangePresetId,
} from '../../utils/dateRangePresets';
import { isAuthSessionExpiredError } from '../../api/auth';
import {
  getTeamExternalSettlement,
  getTeamMe,
  postTeamExternalSettlementPayment,
  type TeamExternalSettlementResponse,
} from '../../api/team';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

type SettlementTab = 'summary' | 'history';

export function TeamExternalSettlementPage() {
  const token = getTeamToken();
  const navigate = useNavigate();
  const location = useLocation();
  const initialRange = computeDateRangeFromPreset('thisMonth')!;
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [preset, setPreset] = useState<DateRangePresetId>('thisMonth');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TeamExternalSettlementResponse | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewCompanyId, setPreviewCompanyId] = useState('');
  const [previewCompanyName, setPreviewCompanyName] = useState('');
  const [activeTab, setActiveTab] = useState<SettlementTab>('summary');
  const [canRecordPayment, setCanRecordPayment] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentMemoInput, setPaymentMemoInput] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setPreviewMode(q.get('previewRole') === 'external');
    setPreviewCompanyId(q.get('externalCompanyId') ?? '');
    setPreviewCompanyName((q.get('previewExternalName') ?? '').trim());
  }, [location.search]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const me = await getTeamMe(token);
        const viewerRole = me.viewerRole ?? me.role;
        const isPreviewStaff =
          (viewerRole === 'ADMIN' || viewerRole === 'MARKETER') && previewMode;
        setCanRecordPayment(viewerRole === 'ADMIN' || viewerRole === 'MARKETER');
        if (me.role !== 'EXTERNAL_PARTNER' && !isPreviewStaff) {
          setData(null);
          setError('타업체 계정 전용 메뉴입니다.');
          return;
        }
        const res = await getTeamExternalSettlement(token, {
          from,
          to,
          externalCompanyId: isPreviewStaff && previewCompanyId ? previewCompanyId : undefined,
          externalCompanyName: isPreviewStaff && previewCompanyName ? previewCompanyName : undefined,
        });
        setData(res);
        setError(null);
      } catch (e) {
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
        setData(null);
        setError(e instanceof Error ? e.message : '정산 정보를 불러오지 못했습니다.');
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [from, to, navigate, previewCompanyId, previewCompanyName, previewMode, token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const silentRefresh = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  const { connected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !connected ? 20000 : 0);

  const totalPositive = useMemo(
    () => (data?.items ?? []).reduce((s, it) => s + (it.signedFeeAmount > 0 ? it.signedFeeAmount : 0), 0),
    [data?.items]
  );
  const totalNegative = useMemo(
    () => (data?.items ?? []).reduce((s, it) => s + (it.signedFeeAmount < 0 ? Math.abs(it.signedFeeAmount) : 0), 0),
    [data?.items]
  );
  const applyPreset = (id: DateRangePresetId) => {
    setPreset(id);
    if (id === 'custom') return;
    const r = computeDateRangeFromPreset(id);
    if (!r) return;
    setFrom(r.from);
    setTo(r.to);
  };
  const payableAmount = data?.payableAmount ?? 0;
  const remainingAmount = data?.remainingAmount ?? 0;
  const historyRows = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    let remain = data.payableAmount;
    return sorted.map((row) => {
      remain -= row.amount;
      return { ...row, remainingAfter: remain };
    }).reverse();
  }, [data]);
  const handleRecordPayment = async () => {
    if (!token || !data || !canRecordPayment) return;
    const n = Number(paymentAmountInput.replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n <= 0) {
      window.alert('정산완료 금액은 0원보다 커야 합니다.');
      return;
    }
    setPaymentSaving(true);
    try {
      await postTeamExternalSettlementPayment(token, {
        externalCompanyId: data.externalCompanyId,
        amount: Math.floor(n),
        memo: paymentMemoInput.trim() || undefined,
      });
      setPaymentAmountInput('');
      setPaymentMemoInput('');
      await load();
      setActiveTab('history');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '정산완료 처리에 실패했습니다.');
    } finally {
      setPaymentSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-500 text-fluid-sm">로딩 중...</div>;
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-4 pb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">정산</h1>
          <p className="mt-1 text-fluid-xs text-gray-500">
            취소는 관리자/마케터만 처리합니다. 취소 건 수수료는 자동 차감 반영됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {DATE_RANGE_PRESET_LABELS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={`rounded px-2.5 py-1.5 text-fluid-xs font-medium border ${
                preset === id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <label className="text-fluid-xs text-gray-600">
          시작일
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset('custom');
            }}
            className="mt-1 block rounded border border-gray-300 bg-white px-2 py-2 text-fluid-sm"
          />
        </label>
        <span className="mt-5 text-gray-400">~</span>
        <label className="text-fluid-xs text-gray-600">
          종료일
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset('custom');
            }}
            className="mt-1 block rounded border border-gray-300 bg-white px-2 py-2 text-fluid-sm"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-900">{error}</div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-fluid-2xs text-gray-500">업체</p>
              <p className="mt-1 truncate text-fluid-sm font-semibold text-gray-900" title={data.externalCompanyName ?? '-'}>
                {data.externalCompanyName ?? '-'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-fluid-2xs text-gray-500">총 수수료</p>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">{won(data.totalFee)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-fluid-2xs text-gray-500">정상/취소 건수</p>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">
                {data.inquiryCount} / {data.cancelledInquiryCount}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-fluid-2xs text-gray-500">총 건수</p>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">{data.totalCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-fluid-2xs text-gray-500">전월 이월금액</p>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">
                {won(data.carryOverAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-fluid-2xs text-gray-500">결제대상 금액</p>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">
                {won(data.payableAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-fluid-2xs text-gray-500">기간 정산완료</p>
              <p className="mt-1 text-fluid-sm font-semibold text-emerald-700 tabular-nums">
                {won(data.periodPaidAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-fluid-2xs text-gray-500">남은 결제금액</p>
              <p className={`mt-1 text-fluid-sm font-semibold tabular-nums ${remainingAmount > 0 ? 'text-rose-700' : 'text-gray-900'}`}>
                {won(remainingAmount > 0 ? remainingAmount : 0)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3 text-fluid-xs text-gray-600">
            +수수료 합계 <strong className="text-emerald-700 tabular-nums">{won(totalPositive)}</strong>
            {' · '}
            취소 차감 <strong className="text-rose-700 tabular-nums">-{won(totalNegative)}</strong>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className={`rounded px-2.5 py-1 text-fluid-xs font-medium border ${
                    activeTab === 'summary'
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  정산 내역
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`rounded px-2.5 py-1 text-fluid-xs font-medium border ${
                    activeTab === 'history'
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  정산완료내역
                </button>
              </div>
            </div>

            {activeTab === 'history' ? (
              <div className="p-3">
                {canRecordPayment ? (
                  <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-fluid-xs font-semibold text-gray-700">관리자 정산완료 처리</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="text-fluid-2xs text-gray-600">
                        정산완료 금액
                        <input
                          type="text"
                          inputMode="numeric"
                          value={paymentAmountInput}
                          onChange={(e) => setPaymentAmountInput(e.target.value.replace(/[^\d,]/g, ''))}
                          placeholder="예: 150000"
                          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-2 text-fluid-sm"
                        />
                      </label>
                      <label className="text-fluid-2xs text-gray-600">
                        메모(선택)
                        <input
                          type="text"
                          value={paymentMemoInput}
                          onChange={(e) => setPaymentMemoInput(e.target.value)}
                          placeholder="부분 지급 / 계좌이체"
                          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-2 text-fluid-sm"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={paymentSaving}
                        onClick={() => void handleRecordPayment()}
                        className="min-h-[40px] rounded bg-gray-900 px-3 text-fluid-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        {paymentSaving ? '처리 중…' : '정산완료 기록'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-600">
                    {data.month} 기준 · 결제대상 {won(payableAmount)} / 정산완료 {won(data.periodPaidAmount)} / 남은 금액{' '}
                    <strong className={remainingAmount > 0 ? 'text-rose-700' : 'text-gray-900'}>
                      {won(remainingAmount > 0 ? remainingAmount : 0)}
                    </strong>
                  </div>
                  {historyRows.length === 0 ? (
                    <div className="px-3 py-8 text-center text-fluid-sm text-gray-500">
                      해당 기간 정산완료 내역이 없습니다.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] border-collapse text-fluid-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-100">
                            <th className="px-3 py-2 text-center font-medium text-gray-700">정산일</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700">정산완료 금액</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700">처리자</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700">메모</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700">처리 후 남은 금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyRows.map((row) => (
                            <tr key={row.id} className="border-b border-gray-100">
                              <td className="px-3 py-2 text-center tabular-nums text-gray-700">
                                {formatDateCompactWithWeekday(row.paidAt)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">
                                {won(row.amount)}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-700">{row.actorName ?? '-'}</td>
                              <td className="px-3 py-2 text-center text-gray-700">{row.memo ?? '-'}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">
                                {won(row.remainingAfter > 0 ? row.remainingAfter : 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {activeTab === 'summary' ? <div className="space-y-3 lg:hidden">
            {data.items.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-10 text-center text-gray-500">
                해당 기간 정산 내역이 없습니다.
              </div>
            ) : (
              data.items.map((it) => (
                <article
                  key={`${it.inquiryId}-${it.isCancelled ? 'C' : 'N'}`}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-fluid-sm font-semibold text-gray-900">{it.customerName}</p>
                      <p className="mt-0.5 text-fluid-2xs text-gray-500 tabular-nums">{it.inquiryNumber ?? '-'}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded px-2 py-0.5 text-fluid-2xs font-medium ${
                        it.isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {it.isCancelled ? '취소(차감)' : it.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-fluid-xs text-gray-600">
                    <span className="tabular-nums">
                      예약일 {it.preferredDate ? formatDateCompactWithWeekday(it.preferredDate) : '-'}
                    </span>
                    <span
                      className={`tabular-nums font-semibold ${
                        it.signedFeeAmount < 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {it.signedFeeAmount < 0 ? '-' : '+'}
                      {won(Math.abs(it.signedFeeAmount))}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div> : null}

          {activeTab === 'summary' ? <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white lg:block">
            <table className="w-full min-w-[640px] border-collapse text-fluid-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100">
                  <th className="px-3 py-2 text-center font-medium text-gray-700">예약일</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">접수번호</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">고객명</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">상태</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">수수료</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                      해당 기간 정산 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  data.items.map((it) => (
                    <tr key={`${it.inquiryId}-${it.isCancelled ? 'C' : 'N'}`} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-center text-gray-700 tabular-nums">
                        {it.preferredDate ? formatDateCompactWithWeekday(it.preferredDate) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-700 tabular-nums">{it.inquiryNumber ?? '-'}</td>
                      <td className="px-3 py-2 text-center text-gray-900">{it.customerName}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-fluid-2xs font-medium ${
                            it.isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {it.isCancelled ? '취소(차감)' : it.status}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-semibold ${
                          it.signedFeeAmount < 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {it.signedFeeAmount < 0 ? '-' : '+'}
                        {won(Math.abs(it.signedFeeAmount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div> : null}
        </>
      ) : null}
    </div>
  );
}
