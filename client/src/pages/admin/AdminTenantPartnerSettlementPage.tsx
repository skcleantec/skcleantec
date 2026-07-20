import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStaffAppScrollPreserve } from '../../hooks/useStaffAppScrollPreserve';
import { beginListRefresh, shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { getToken } from '../../stores/auth';
import {
  getTenantPartnerBuyerSummary,
  getTenantPartnerSellerSummary,
  getTenantPartnerSettlementDetail,
  getTenantPartnerSettlementMonthlyOverview,
  getTenantPartnerSettlementPayments,
  postTenantPartnerSettlementPayment,
  type TenantPartnerSettlementOverviewRow,
  type TenantPartnerSettlementRole,
} from '../../api/tenantPartnerSettlement';

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function sanitizePayAmountInput(raw: string): string {
  let s = raw.replace(/[^\d,-]/g, '');
  if (!s) return '';
  const neg = s.charAt(0) === '-';
  s = s.replace(/-/g, '');
  return neg ? `-${s}` : s;
}

function payAmountAbsDigits(raw: string): number {
  const d = raw.replace(/,/g, '').replace(/^-/, '').replace(/\D/g, '');
  if (!d) return 0;
  const n = Number(d);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function payAmountIsNegative(raw: string): boolean {
  return raw.replace(/,/g, '').trim().startsWith('-');
}

function formatPayAmountDisplay(abs: number, negative: boolean): string {
  const a = Math.abs(Math.trunc(abs));
  if (a === 0 && !negative) return '';
  if (a === 0 && negative) return '-';
  const formatted = a.toLocaleString('ko-KR');
  return negative ? `-${formatted}` : formatted;
}

function togglePayAmountMinus(raw: string): string {
  const compact = raw.replace(/,/g, '').trim();
  if (compact === '') return '-';
  if (compact === '-') return '';
  const neg = compact.startsWith('-');
  const abs = payAmountAbsDigits(raw);
  return formatPayAmountDisplay(abs, !neg);
}

function addPayAmountUnit(raw: string, unit: number): string {
  const neg = payAmountIsNegative(raw);
  const abs = payAmountAbsDigits(raw) + unit;
  return formatPayAmountDisplay(abs, neg);
}

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function settlementHistoryFromYmd(): string {
  const today = kstTodayYmd();
  const [y, m] = today.split('-').map(Number);
  let year = y;
  let month = m - 36;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function formatKstDateLabel(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' });
}

function settlementDetailFeeLabel(it: {
  signedFeeAmount: number;
  isCancelled?: boolean;
  feeAmount?: number;
}): { text: string; className: string } {
  if (it.isCancelled) {
    const base = it.feeAmount ? `취소 · 정산 0원 (${won(it.feeAmount)} 수수료)` : '취소 · 정산 0원';
    return { text: base, className: 'text-gray-500 font-normal' };
  }
  return {
    text: `+${won(it.signedFeeAmount)}`,
    className: it.signedFeeAmount < 0 ? 'text-rose-700' : 'text-emerald-700',
  };
}

function monthStartEnd(month: string): { from: string; to: string } {
  const [yy, mm] = month.split('-').map(Number);
  const last = new Date(yy, mm, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

function rowPayableAmount(r: TenantPartnerSettlementOverviewRow): number {
  return r.payableAmount ?? r.accruedAmount;
}

type PayConfirmState = {
  currentRemaining: number;
  inputAmount: number;
  afterRemaining: number;
};

type HistoryRow = {
  id: string;
  amount: number;
  paidAt: string;
  memo: string | null;
  actorName: string | null;
};

function mergeHistoryRows(prev: HistoryRow[], next: HistoryRow[]): HistoryRow[] {
  const map = new Map<string, HistoryRow>();
  for (const row of prev) map.set(row.id, row);
  for (const row of next) map.set(row.id, { ...map.get(row.id), ...row });
  return Array.from(map.values()).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

function historyCacheKey(partnerTenantId: string, role: TenantPartnerSettlementRole): string {
  return `${partnerTenantId}|${role}`;
}

type Tab = TenantPartnerSettlementRole;

export function AdminTenantPartnerSettlementPage() {
  const token = getToken();
  const [tab, setTab] = useState<Tab>('SELLER');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TenantPartnerSettlementOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { preserveScroll } = useStaffAppScrollPreserve();
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TenantPartnerSettlementOverviewRow | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMemoInput, setPayMemoInput] = useState('');
  const [payDateInput, setPayDateInput] = useState(() => kstTodayYmd());
  const [payConfirm, setPayConfirm] = useState<PayConfirmState | null>(null);
  const [payFormError, setPayFormError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyCacheByPartner, setHistoryCacheByPartner] = useState<Record<string, HistoryRow[]>>({});

  const [periodLoading, setPeriodLoading] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [periodRows, setPeriodRows] = useState<
    Array<{
      month: string;
      payableAmount: number;
      paidAmount: number;
      remainingAmount: number;
      cumulativeRemaining: number;
    }>
  >([]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMonth, setDetailMonth] = useState(kstTodayYmd().slice(0, 7));
  const [detailSearch, setDetailSearch] = useState('');
  const [detailAllItems, setDetailAllItems] = useState<
    Array<{
      inquiryId: string;
      inquiryNumber: string | null;
      customerName: string;
      signedFeeAmount: number;
      isCancelled?: boolean;
      feeAmount?: number;
      viaMarketplace?: boolean;
    }>
  >([]);
  const [detailSummary, setDetailSummary] = useState<{
    month: string;
    carryOverAmount: number;
    totalFee: number;
    payableAmount: number;
    periodPaidAmount: number;
    remainingAmount: number;
  } | null>(null);

  const currentMonthKey = kstTodayYmd().slice(0, 7);
  const detailItems = useMemo(() => {
    const q = detailSearch.trim().toLowerCase();
    if (!q) return detailAllItems;
    return detailAllItems.filter(
      (it) =>
        it.customerName.toLowerCase().includes(q) ||
        (it.inquiryNumber?.toLowerCase().includes(q) ?? false),
    );
  }, [detailAllItems, detailSearch]);
  const detailTotalFee = useMemo(
    () => detailItems.reduce((sum, it) => sum + (it.signedFeeAmount ?? 0), 0),
    [detailItems],
  );
  const detailMonthTotalFee = useMemo(
    () => detailAllItems.reduce((sum, it) => sum + (it.signedFeeAmount ?? 0), 0),
    [detailAllItems],
  );

  const labels = useMemo(() => {
    if (tab === 'SELLER') {
      return {
        payable: '결재받을 누적금액',
        paid: '결재받은금액',
        remaining: '누적 미수금',
      };
    }
    return {
      payable: '지급할 누적금액',
      paid: '지급한 금액',
      remaining: '미지급 잔액',
    };
  }, [tab]);

  const loadList = useCallback(async () => {
    if (!token) return;
    beginListRefresh({
      showLoading: true,
      itemCount: rows.length,
      setLoading,
      preserveScroll,
    });
    setError(null);
    try {
      const r =
        tab === 'SELLER'
          ? await getTenantPartnerSellerSummary(token)
          : await getTenantPartnerBuyerSummary(token);
      setRows(r.items);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : '정산 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [tab, token, rows.length, preserveScroll]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.partnerName.toLowerCase().includes(q) || r.partnerSlug.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openPayModal = (row: TenantPartnerSettlementOverviewRow) => {
    setSelected(row);
    setPayAmountInput('');
    setPayMemoInput('');
    setPayDateInput(kstTodayYmd());
    setPayConfirm(null);
    setPayFormError(null);
    setSaveError(null);
    setPayModalOpen(true);
  };

  const openHistoryModal = async (row: TenantPartnerSettlementOverviewRow) => {
    if (!token) return;
    setSelected(row);
    setHistoryModalOpen(true);
    const cacheKey = historyCacheKey(row.partnerTenantId, tab);
    const cached = historyCacheByPartner[cacheKey];
    if (cached) {
      setHistoryRows(cached);
      setHistoryLoading(false);
    } else {
      setHistoryRows([]);
      setHistoryLoading(true);
    }
    try {
      const historyFrom = settlementHistoryFromYmd();
      const detail = await getTenantPartnerSettlementPayments(token, {
        role: tab,
        partnerTenantId: row.partnerTenantId,
        from: historyFrom,
        to: kstTodayYmd(),
        limit: 300,
      });
      const merged = mergeHistoryRows(
        cached ?? [],
        detail.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          paidAt: p.paidAt,
          memo: p.memo,
          actorName: p.actorName,
        })),
      );
      setHistoryRows(merged);
      setHistoryCacheByPartner((prev) => ({ ...prev, [cacheKey]: merged }));
    } catch {
      if (!cached) setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openPeriodModal = async (row: TenantPartnerSettlementOverviewRow, targetYear = year) => {
    if (!token) return;
    setSelected(row);
    setPeriodModalOpen(true);
    setPeriodLoading(true);
    try {
      const summary = await getTenantPartnerSettlementMonthlyOverview(token, {
        role: tab,
        partnerTenantId: row.partnerTenantId,
        fromMonth: `${targetYear}-01`,
        toMonth: `${targetYear}-12`,
      });
      setPeriodRows(summary.months);
    } finally {
      setPeriodLoading(false);
    }
  };

  const openDetailModal = async (row: TenantPartnerSettlementOverviewRow, targetMonth = detailMonth) => {
    if (!token) return;
    setSelected(row);
    setDetailMonth(targetMonth);
    setDetailModalOpen(true);
    setDetailSearch('');
    setDetailSummary(null);
    setDetailLoading(true);
    try {
      const range = monthStartEnd(targetMonth);
      const detail = await getTenantPartnerSettlementDetail(token, {
        role: tab,
        partnerTenantId: row.partnerTenantId,
        from: range.from,
        to: range.to,
      });
      setDetailSummary({
        month: detail.month ?? targetMonth,
        carryOverAmount: detail.carryOverAmount ?? 0,
        totalFee: detail.totalFee ?? 0,
        payableAmount: detail.payableAmount,
        periodPaidAmount: detail.periodPaidAmount,
        remainingAmount: detail.remainingAmount,
      });
      setDetailAllItems(
        detail.items.map((it) => ({
          inquiryId: it.inquiryId ?? it.shareId,
          inquiryNumber: it.inquiryNumber,
          customerName: it.customerName,
          signedFeeAmount: it.signedFeeAmount,
          isCancelled: it.isCancelled,
          feeAmount: it.feeAmount,
          viaMarketplace: it.viaMarketplace,
        })),
      );
    } catch {
      setDetailAllItems([]);
      setDetailSummary(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const preparePaymentConfirm = () => {
    if (!selected) return;
    setPayFormError(null);
    const todayK = kstTodayYmd();
    let ymd: string;
    if (!payDateInput?.trim()) {
      ymd = todayK;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(payDateInput)) {
      setPayFormError('정산일을 올바르게 선택해 주세요.');
      return;
    } else {
      ymd = payDateInput;
    }
    if (ymd > todayK) {
      setPayFormError('정산일은 오늘(한국) 이후로 설정할 수 없습니다.');
      return;
    }
    const compact = payAmountInput.replace(/,/g, '').trim();
    if (!/^-?\d+$/.test(compact)) {
      setPayFormError(
        '정산 금액은 정수로 입력해 주세요. (과납·오기입 보정 시 맨 앞에 - 를 붙일 수 있습니다)',
      );
      return;
    }
    const amount = Number(compact);
    if (!Number.isFinite(amount) || amount === 0) {
      setPayFormError('0원은 입력할 수 없습니다.');
      return;
    }
    if (!token) {
      setPayFormError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }
    const currentRemaining = selected.remainingAmount;
    const floored = Math.trunc(amount);
    if (ymd !== payDateInput) setPayDateInput(ymd);
    setPayConfirm({
      currentRemaining,
      inputAmount: floored,
      afterRemaining: currentRemaining - floored,
    });
    setPayModalOpen(false);
  };

  const submitPayment = async () => {
    if (!token || !selected || !payConfirm) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payYmd = /^\d{4}-\d{2}-\d{2}$/.test(payDateInput) ? payDateInput.trim() : kstTodayYmd();
      const result = await postTenantPartnerSettlementPayment(token, {
        partnerTenantId: selected.partnerTenantId,
        role: tab,
        amount: payConfirm.inputAmount,
        memo: payMemoInput.trim() || undefined,
        paidDate: payYmd,
      });
      const cacheKey = historyCacheKey(selected.partnerTenantId, tab);
      const optimisticHistoryRow: HistoryRow = {
        id: result.payment.id,
        amount: result.payment.amount,
        paidAt: result.payment.paidAt,
        memo: payMemoInput.trim(),
        actorName: null,
      };
      setHistoryCacheByPartner((prev) => ({
        ...prev,
        [cacheKey]: mergeHistoryRows(prev[cacheKey] ?? [], [optimisticHistoryRow]),
      }));
      if (historyModalOpen) {
        setHistoryRows((prev) => mergeHistoryRows(prev, [optimisticHistoryRow]));
      }
      setPayConfirm(null);
      setPayFormError(null);
      await loadList();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '정산완료 처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0 w-full max-w-full">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">파트너 정산</h1>
        <p className="mt-1 text-sm text-gray-500">
          접수 연계 수수료로 파트너별 잔액을 확인하고 정산합니다. 미수금은 월별 마감이 아니라{' '}
          <span className="font-medium text-gray-700">전 기간 누적(정산 기준 수수료 − 전체 정산)</span>
          입니다. 일반 연계는 예약일, 정보공유는 인계 확정일 기준이며{' '}
          <span className="font-medium text-gray-700">취소 건</span>은 미수에 반영하지 않습니다(순 0).
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('SELLER')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'SELLER'
              ? 'bg-indigo-600 text-white'
              : 'border border-gray-300 bg-white text-gray-700'
          }`}
        >
          판매 (받을 금액)
        </button>
        <button
          type="button"
          onClick={() => setTab('BUYER')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'BUYER'
              ? 'bg-indigo-600 text-white'
              : 'border border-gray-300 bg-white text-gray-700'
          }`}
        >
          구매 (지급할 금액)
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="파트너 업체명·코드 검색"
            className="w-full sm:w-80 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void loadList()}
            className="rounded bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
          >
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading && filteredRows.length > 0 ? (
          <p className="px-3 py-1.5 text-center text-fluid-xs text-gray-500 border-b border-gray-100" aria-live="polite">
            갱신 중…
          </p>
        ) : null}
        {shouldShowListBlockingLoading(loading, filteredRows.length) ? (
          <div className="px-3 py-10 text-center text-gray-500">불러오는 중...</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-3 py-10 text-center text-gray-500">
            표시할 파트너가 없습니다. 접수 연계 건이 있거나 정산 이력이 있어야 합니다.
          </div>
        ) : (
          <>
            <div className="lg:hidden p-3 space-y-3">
              {filteredRows.map((r) => (
                <div key={r.partnerTenantId} className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-sm font-semibold text-gray-900">{r.partnerName}</p>
                  <p className="text-xs text-gray-500">{r.partnerSlug}</p>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <p className="flex items-center justify-between">
                      <span className="text-gray-500">{labels.payable}</span>
                      <strong className="tabular-nums text-gray-900">{won(rowPayableAmount(r))}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-gray-500">{labels.paid}</span>
                      <strong className="tabular-nums text-emerald-700">{won(r.paidAmount)}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-gray-500">{labels.remaining}</span>
                      <strong className="tabular-nums text-rose-700">{won(r.remainingAmount)}</strong>
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => openPayModal(r)}
                      className="rounded bg-gray-900 px-2 py-1.5 text-[11px] font-medium text-white"
                    >
                      정산
                    </button>
                    <button
                      type="button"
                      onClick={() => void openHistoryModal(r)}
                      className="rounded border border-gray-300 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-700"
                    >
                      정산내역
                    </button>
                    <button
                      type="button"
                      onClick={() => void openPeriodModal(r)}
                      className="rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-[11px] font-medium text-blue-700"
                    >
                      기간별정산
                    </button>
                    <button
                      type="button"
                      onClick={() => void openDetailModal(r)}
                      className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-[11px] font-medium text-indigo-700"
                    >
                      정산상세내역
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden lg:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-3 py-2 text-center font-medium">파트너</th>
                    <th className="px-3 py-2 text-center font-medium">{labels.payable}</th>
                    <th className="px-3 py-2 text-center font-medium">{labels.paid}</th>
                    <th className="px-3 py-2 text-center font-medium">{labels.remaining}</th>
                    <th className="px-3 py-2 text-center font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.partnerTenantId} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-center">
                        <div className="font-medium text-gray-900">{r.partnerName}</div>
                        <div className="text-xs text-gray-500">{r.partnerSlug}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{won(rowPayableAmount(r))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{won(r.paidAmount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-700">{won(r.remainingAmount)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openPayModal(r)}
                            className="rounded bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800"
                          >
                            정산
                          </button>
                          <button
                            type="button"
                            onClick={() => void openHistoryModal(r)}
                            className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            정산내역
                          </button>
                          <button
                            type="button"
                            onClick={() => void openPeriodModal(r)}
                            className="rounded border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            기간별정산보기
                          </button>
                          <button
                            type="button"
                            onClick={() => void openDetailModal(r)}
                            className="rounded border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            정산상세내역
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {payModalOpen && selected ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md max-h-[85vh] flex-col overflow-hidden rounded-lg bg-white border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">정산 처리</h3>
              <p className="mt-1 text-xs text-gray-600">{selected.partnerName}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {payFormError ? (
                <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800" role="alert">
                  {payFormError}
                </p>
              ) : null}
              <p className="text-xs text-gray-600">
                현재 누적 {labels.remaining}:{' '}
                <strong className="text-rose-700 tabular-nums">{won(selected.remainingAmount)}</strong>
                {selected.remainingAmount < 0 ? (
                  <span className="block mt-0.5 text-[11px] text-gray-500">
                    음수는 과납 등으로 잔액이 마이너스인 상태입니다. 0으로 맞출 때 동일 금액을 앞에{' '}
                    <span className="font-medium text-gray-700">-</span> 를 붙여 입력하세요.
                  </span>
                ) : null}
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">정산일 (한국 기준)</label>
                <input
                  type="date"
                  value={payDateInput}
                  min="2000-01-01"
                  max={kstTodayYmd()}
                  onChange={(e) => setPayDateInput(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="block text-xs text-gray-500 mb-1">정산 금액</label>
              <input
                aria-label="정산 금액"
                value={payAmountInput}
                onChange={(e) => setPayAmountInput(sanitizePayAmountInput(e.target.value))}
                placeholder="정산 금액 (보정 시 -금액)"
                inputMode="numeric"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm tabular-nums"
              />
              <div className="flex w-full min-w-0 flex-nowrap gap-1 pt-1 sm:gap-1.5">
                <button
                  type="button"
                  aria-label="마이너스 전환"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-gray-50 px-0.5 py-2 text-fluid-2xs font-medium leading-none text-gray-800 active:bg-gray-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput((v) => sanitizePayAmountInput(togglePayAmountMinus(v)))}
                >
                  <span className="sm:hidden">−</span>
                  <span className="hidden sm:inline">− 마이너스</span>
                </button>
                <button
                  type="button"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-white px-0.5 py-2 text-fluid-2xs font-medium leading-none text-gray-800 active:bg-gray-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput((v) => sanitizePayAmountInput(addPayAmountUnit(v, 10_000)))}
                >
                  만
                </button>
                <button
                  type="button"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-white px-0.5 py-2 text-fluid-2xs font-medium leading-none text-gray-800 active:bg-gray-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput((v) => sanitizePayAmountInput(addPayAmountUnit(v, 100_000)))}
                >
                  십만
                </button>
                <button
                  type="button"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-white px-0.5 py-2 text-fluid-2xs font-medium leading-none text-gray-800 active:bg-gray-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput((v) => sanitizePayAmountInput(addPayAmountUnit(v, 1_000_000)))}
                >
                  백만
                </button>
                <button
                  type="button"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-amber-200 bg-amber-50 px-0.5 py-2 text-fluid-2xs font-medium leading-none text-amber-900 active:bg-amber-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput('')}
                >
                  정정
                </button>
              </div>
              <input
                value={payMemoInput}
                onChange={(e) => setPayMemoInput(e.target.value)}
                placeholder="메모 (선택)"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="px-4 pb-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayModalOpen(false);
                  setPayFormError(null);
                }}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={preparePaymentConfirm}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payConfirm && selected ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-900">정산완료 확인 - {selected.partnerName}</h4>
            <p className="mt-2 text-sm flex justify-between">
              <span>현재 {labels.remaining}</span>
              <strong>{won(payConfirm.currentRemaining)}</strong>
            </p>
            <p className="text-sm flex justify-between">
              <span>입력금액</span>
              <strong className={payConfirm.inputAmount < 0 ? 'text-amber-800' : ''}>
                {won(payConfirm.inputAmount)}
              </strong>
            </p>
            <p className="text-sm flex justify-between">
              <span>처리 후 남은 금액</span>
              <strong>{won(payConfirm.afterRemaining)}</strong>
            </p>
            {saveError ? (
              <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800" role="alert">
                {saveError}
              </p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayConfirm(null);
                  setSaveError(null);
                  setPayModalOpen(true);
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void submitPayment()}
                disabled={saving}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                {saving ? '처리 중…' : '확정'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyModalOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-lg bg-white border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">정산내역 - {selected.partnerName}</h3>
              <button type="button" onClick={() => setHistoryModalOpen(false)} className="text-xs text-gray-500">
                닫기
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {historyLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">불러오는 중...</div>
              ) : historyRows.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">정산내역이 없습니다.</div>
              ) : (
                <>
                  <div className="lg:hidden space-y-2">
                    {historyRows.map((p) => (
                      <div key={p.id} className="rounded border border-gray-200 p-3 text-xs">
                        <p className="text-gray-500">{formatKstDateLabel(p.paidAt)}</p>
                        <p className="mt-1 flex items-center justify-between">
                          <span className="text-gray-500">금액</span>
                          <strong className={`tabular-nums ${p.amount < 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                            {won(p.amount)}
                          </strong>
                        </p>
                        <p className="mt-1 text-gray-700">처리자: {p.actorName ?? '-'}</p>
                        <p className="mt-1 text-gray-700">메모: {p.memo ?? '-'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600">
                          <th className="px-3 py-2 text-center">정산일</th>
                          <th className="px-3 py-2 text-center">금액</th>
                          <th className="px-3 py-2 text-center">처리자</th>
                          <th className="px-3 py-2 text-center">메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((p) => (
                          <tr key={p.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-center tabular-nums">{formatKstDateLabel(p.paidAt)}</td>
                            <td
                              className={`px-3 py-2 text-right tabular-nums ${p.amount < 0 ? 'text-amber-800' : 'text-emerald-700'}`}
                            >
                              {won(p.amount)}
                            </td>
                            <td className="px-3 py-2 text-center">{p.actorName ?? '-'}</td>
                            <td className="px-3 py-2 text-center">{p.memo ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {periodModalOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-lg bg-white border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">기간별정산보기 - {selected.partnerName}</h3>
              <button type="button" onClick={() => setPeriodModalOpen(false)} className="text-xs text-gray-500">
                닫기
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-end gap-2">
                <label className="text-xs text-gray-600">
                  연도
                  <input
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                    className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void openPeriodModal(selected, year)}
                  className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white"
                >
                  조회
                </button>
              </div>
              {periodLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">조회 중...</div>
              ) : (
                <>
                  <div className="mb-3 rounded border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs">
                    <p className="flex items-center justify-between">
                      <span className="text-gray-700">목록 {labels.remaining} (현재)</span>
                      <strong className="tabular-nums text-rose-700">{won(selected.remainingAmount)}</strong>
                    </p>
                  </div>
                  <div className="lg:hidden space-y-2">
                    {periodRows.map((m) => (
                      <div key={m.month} className="rounded border border-gray-200 p-3 text-xs">
                        <p className="font-semibold text-gray-900">{m.month}</p>
                        <p className="mt-1 flex items-center justify-between">
                          <span className="text-gray-500">당월 발생</span>
                          <span className="tabular-nums text-gray-900">{won(m.payableAmount)}</span>
                        </p>
                        <p className="mt-1 flex items-center justify-between">
                          <span className="text-gray-500">당월 정산</span>
                          <span className="tabular-nums text-emerald-700">{won(m.paidAmount)}</span>
                        </p>
                        <p className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1">
                          <span className="font-medium text-gray-700">기말 누적</span>
                          <span className="tabular-nums text-rose-700">{won(m.cumulativeRemaining)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600">
                          <th className="px-3 py-2 text-center">월</th>
                          <th className="px-3 py-2 text-center">당월 발생</th>
                          <th className="px-3 py-2 text-center">당월 정산</th>
                          <th className="px-3 py-2 text-center">당월 차액</th>
                          <th className="px-3 py-2 text-center">기말 누적</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodRows.map((m) => (
                          <tr key={m.month} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-center tabular-nums">{m.month}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{won(m.payableAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{won(m.paidAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">{won(m.remainingAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-rose-700">{won(m.cumulativeRemaining)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {detailModalOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-lg bg-white border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">정산 상세내역 - {selected.partnerName}</h3>
              <button type="button" onClick={() => setDetailModalOpen(false)} className="text-xs text-gray-500">
                닫기
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <label className="text-xs text-gray-600">
                  월
                  <input
                    type="month"
                    value={detailMonth}
                    onChange={(e) => setDetailMonth(e.target.value)}
                    className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void openDetailModal(selected, detailMonth)}
                  className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white"
                >
                  조회
                </button>
                <label className="min-w-[12rem] flex-1 text-xs text-gray-600">
                  고객명·접수번호 검색
                  <input
                    type="search"
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="이름 또는 접수번호"
                    className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <div className="mb-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs space-y-1">
                {detailSummary ? (
                  <>
                    <p className="flex items-center justify-between">
                      <span className="text-gray-600">이월 미수금</span>
                      <strong className="tabular-nums text-gray-900">{won(detailSummary.carryOverAmount)}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-gray-600">해당 월 발생 수수료</span>
                      <strong
                        className={`tabular-nums ${detailSummary.totalFee < 0 ? 'text-rose-700' : 'text-emerald-700'}`}
                      >
                        {detailSummary.totalFee < 0 ? '-' : '+'}
                        {won(Math.abs(detailSummary.totalFee))}
                      </strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-gray-600">해당 월 정산완료</span>
                      <strong className="tabular-nums text-emerald-700">{won(detailSummary.periodPaidAmount)}</strong>
                    </p>
                    <p className="flex items-center justify-between border-t border-gray-200 pt-1">
                      <span className="font-medium text-gray-700">해당 월 기말 미수</span>
                      <strong className="tabular-nums text-rose-700">{won(detailSummary.remainingAmount)}</strong>
                    </p>
                    {detailSummary.month === currentMonthKey ? (
                      <p className="border-t border-gray-200 pt-1 text-[11px] leading-relaxed text-gray-500">
                        목록의 {labels.remaining}({won(selected.remainingAmount)})은 정산 기준 수수료에서
                        정산완료액을 뺀 금액입니다. 취소 건은 미수 합계에서 제외됩니다(정산 반영 0원).
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="flex items-center justify-between">
                    <span className="text-gray-600">해당 월 합계 수수료</span>
                    <strong className={`tabular-nums ${detailMonthTotalFee < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {detailMonthTotalFee < 0 ? '-' : '+'}
                      {won(Math.abs(detailMonthTotalFee))}
                    </strong>
                  </p>
                )}
                {detailSearch.trim() ? (
                  <p className="flex items-center justify-between">
                    <span className="text-gray-500">검색 결과 ({detailItems.length}건)</span>
                    <strong className={`tabular-nums ${detailTotalFee < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {detailTotalFee < 0 ? '-' : '+'}
                      {won(Math.abs(detailTotalFee))}
                    </strong>
                  </p>
                ) : null}
              </div>

              {detailLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">조회 중...</div>
              ) : detailAllItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">해당 월 정산 상세내역이 없습니다.</div>
              ) : detailItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">검색 조건에 맞는 내역이 없습니다.</div>
              ) : (
                <>
                  <div className="lg:hidden space-y-2">
                    {detailItems.map((it, idx) => (
                      <div key={it.inquiryId} className="rounded border border-gray-200 p-3 text-xs">
                        <p className="font-semibold text-gray-900">
                          {idx + 1}. {it.customerName}
                          {it.viaMarketplace ? (
                            <span className="ml-1.5 inline-block rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-800">
                              정보공유
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-gray-600">접수번호: {it.inquiryNumber ?? '-'}</p>
                        <p className="mt-1 flex items-center justify-between">
                          <span className="text-gray-500">수수료</span>
                          <strong className={`tabular-nums text-xs ${settlementDetailFeeLabel(it).className}`}>
                            {settlementDetailFeeLabel(it).text}
                          </strong>
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600">
                          <th className="px-3 py-2 text-center">순번</th>
                          <th className="px-3 py-2 text-center">접수번호</th>
                          <th className="px-3 py-2 text-center">이름</th>
                          <th className="px-3 py-2 text-center">수수료</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailItems.map((it, idx) => (
                          <tr key={it.inquiryId} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-center tabular-nums">{idx + 1}</td>
                            <td className="px-3 py-2 text-center tabular-nums">{it.inquiryNumber ?? '-'}</td>
                            <td className="px-3 py-2 text-center">
                              {it.customerName}
                              {it.viaMarketplace ? (
                                <span className="ml-1 inline-block rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-800">
                                  정보공유
                                </span>
                              ) : null}
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums text-xs ${settlementDetailFeeLabel(it).className}`}>
                              {settlementDetailFeeLabel(it).text}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
