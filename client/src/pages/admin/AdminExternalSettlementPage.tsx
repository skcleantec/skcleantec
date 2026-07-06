import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStaffAppScrollPreserve } from '../../hooks/useStaffAppScrollPreserve';
import { useOperatingCompanies } from '../../hooks/useOperatingCompanies';
import { beginListRefresh, shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { getToken } from '../../stores/auth';
import {
  getExternalSettlementCompanyDetail,
  getExternalSettlementCompanyOverviewList,
  getExternalSettlementCompanyPayments,
  getExternalSettlementMonthlyOverview,
  postExternalSettlementPayment,
  type ExternalSettlementCompanyOverviewRow,
} from '../../api/externalCompanies';

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

/** 정산 금액 입력 — 맨 앞 마이너스·숫자·콤마만 허용 (과납·오기입 보정용 음수) */
function sanitizeExternalPayAmountInput(raw: string): string {
  let s = raw.replace(/[^\d,-]/g, '');
  if (!s) return '';
  const neg = s.charAt(0) === '-';
  s = s.replace(/-/g, '');
  return neg ? `-${s}` : s;
}

/** 콤마·부호 제외 숫자 부분만 파싱 (빈 문자열은 0) */
function payAmountAbsDigits(raw: string): number {
  const d = raw.replace(/,/g, '').replace(/^-/, '').replace(/\D/g, '');
  if (!d) return 0;
  const n = Number(d);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function payAmountIsNegative(raw: string): boolean {
  return raw.replace(/,/g, '').trim().startsWith('-');
}

/** 표시용 — 한국어 천단위, 부호는 맨 앞만 */
function formatExternalPayAmountDisplay(abs: number, negative: boolean): string {
  const a = Math.abs(Math.trunc(abs));
  if (a === 0 && !negative) return '';
  if (a === 0 && negative) return '-';
  const formatted = a.toLocaleString('ko-KR');
  return negative ? `-${formatted}` : formatted;
}

/** 마이너스 토글 (`-` 단독 입력 상태 지원) */
function toggleExternalPayAmountMinus(raw: string): string {
  const compact = raw.replace(/,/g, '').trim();
  if (compact === '') return '-';
  if (compact === '-') return '';
  const neg = compact.startsWith('-');
  const abs = payAmountAbsDigits(raw);
  return formatExternalPayAmountDisplay(abs, !neg);
}

/** 부호 유지한 채 절댓값에 단위만 더함 (모바일 패드용) */
function addExternalPayAmountUnit(raw: string, unit: number): string {
  const neg = payAmountIsNegative(raw);
  const abs = payAmountAbsDigits(raw) + unit;
  return formatExternalPayAmountDisplay(abs, neg);
}

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** 정산완료 내역 조회 시작일 — 최근 36개월(과거 전량 inquiry 스캔 방지) */
function externalSettlementHistoryFromYmd(): string {
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

/** 정산 `paidAt` — 내역에 날짜(한국)만 읽기 쉽게 */
function formatKstDateLabel(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' });
}

function monthStartEnd(month: string): { from: string; to: string } {
  const [yy, mm] = month.split('-').map(Number);
  const last = new Date(yy, mm, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
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

function historyCacheKey(externalCompanyId: string, operatingCompanyId: string): string {
  return `${externalCompanyId}|${operatingCompanyId}`;
}

export function AdminExternalSettlementPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ExternalSettlementCompanyOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { preserveScroll } = useStaffAppScrollPreserve();
  const [error, setError] = useState<string | null>(null);
  const operatingCompanies = useOperatingCompanies(token);
  const [operatingCompanyId, setOperatingCompanyId] = useState(
    () => searchParams.get('operatingCompanyId') ?? ''
  );

  const [selected, setSelected] = useState<ExternalSettlementCompanyOverviewRow | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMemoInput, setPayMemoInput] = useState('');
  /** 정산일(한국) — `paidAt`에 반영, 정산완료 내역에 표시 */
  const [payDateInput, setPayDateInput] = useState(() => kstTodayYmd());
  const [payConfirm, setPayConfirm] = useState<PayConfirmState | null>(null);
  /** 첫 정산 모달: 검증(alert 대신·임베딩 환경에서도 보임) */
  const [payFormError, setPayFormError] = useState<string | null>(null);
  /** 확정 모달: API 실패 메시지 */
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyCacheByCompany, setHistoryCacheByCompany] = useState<Record<string, HistoryRow[]>>({});

  const [periodLoading, setPeriodLoading] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [periodRows, setPeriodRows] = useState<
    Array<{ month: string; payableAmount: number; paidAmount: number; remainingAmount: number }>
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
      viaMarketplace?: boolean;
    }>
  >([]);
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

  const activeOperatingCompanies = useMemo(
    () => operatingCompanies.filter((oc) => oc.isActive),
    [operatingCompanies],
  );

  const resolvedOperatingCompanyId = useMemo(() => {
    if (operatingCompanyId && activeOperatingCompanies.some((oc) => oc.id === operatingCompanyId)) {
      return operatingCompanyId;
    }
    const fromDefault = activeOperatingCompanies.find((oc) => oc.isDefault)?.id;
    if (fromDefault) return fromDefault;
    return activeOperatingCompanies[0]?.id ?? '';
  }, [operatingCompanyId, activeOperatingCompanies]);

  useEffect(() => {
    if (!resolvedOperatingCompanyId) return;
    if (operatingCompanyId === resolvedOperatingCompanyId) return;
    setOperatingCompanyId(resolvedOperatingCompanyId);
  }, [operatingCompanyId, resolvedOperatingCompanyId]);

  useEffect(() => {
    if (!resolvedOperatingCompanyId) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('operatingCompanyId', resolvedOperatingCompanyId);
        return next;
      },
      { replace: true },
    );
  }, [resolvedOperatingCompanyId, setSearchParams]);

  const loadList = useCallback(async () => {
    if (!token || !resolvedOperatingCompanyId) return;
    beginListRefresh({
      showLoading: true,
      itemCount: rows.length,
      setLoading,
      preserveScroll,
    });
    setError(null);
    try {
      const r = await getExternalSettlementCompanyOverviewList(token, resolvedOperatingCompanyId);
      setRows(r.items);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : '업체 정산 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, resolvedOperatingCompanyId, rows.length, preserveScroll]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.companyName.toLowerCase().includes(q));
  }, [rows, search]);

  const openPayModal = (row: ExternalSettlementCompanyOverviewRow) => {
    setSelected(row);
    setPayAmountInput('');
    setPayMemoInput('');
    setPayDateInput(kstTodayYmd());
    setPayConfirm(null);
    setPayFormError(null);
    setSaveError(null);
    setPayModalOpen(true);
  };

  const openHistoryModal = async (row: ExternalSettlementCompanyOverviewRow) => {
    if (!token || !resolvedOperatingCompanyId) return;
    setSelected(row);
    setHistoryModalOpen(true);
    const cacheKey = historyCacheKey(row.externalCompanyId, resolvedOperatingCompanyId);
    const cached = historyCacheByCompany[cacheKey];
    if (cached) {
      setHistoryRows(cached);
      setHistoryLoading(false);
    } else {
      setHistoryRows([]);
      setHistoryLoading(true);
    }
    try {
      const historyFrom = externalSettlementHistoryFromYmd();
      const detail = await getExternalSettlementCompanyPayments(token, {
        externalCompanyId: row.externalCompanyId,
        from: historyFrom,
        to: kstTodayYmd(),
        operatingCompanyId: resolvedOperatingCompanyId,
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
      setHistoryCacheByCompany((prev) => ({ ...prev, [cacheKey]: merged }));
    } catch {
      if (!cached) setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openPeriodModal = async (row: ExternalSettlementCompanyOverviewRow, targetYear = year) => {
    if (!token || !resolvedOperatingCompanyId) return;
    setSelected(row);
    setPeriodModalOpen(true);
    setPeriodLoading(true);
    try {
      const summary = await getExternalSettlementMonthlyOverview(token, {
        fromMonth: `${targetYear}-01`,
        toMonth: `${targetYear}-12`,
        operatingCompanyId: resolvedOperatingCompanyId,
      });
      const items = summary.months.map((m) => {
        const c = m.companies.find((x) => x.externalCompanyId === row.externalCompanyId);
        return {
          month: m.month,
          payableAmount: c?.payableAmount ?? 0,
          paidAmount: c?.paidAmount ?? 0,
          remainingAmount: c?.remainingAmount ?? 0,
        };
      });
      setPeriodRows(items);
    } finally {
      setPeriodLoading(false);
    }
  };

  const openDetailModal = async (row: ExternalSettlementCompanyOverviewRow, targetMonth = detailMonth) => {
    if (!token || !resolvedOperatingCompanyId) return;
    setSelected(row);
    setDetailModalOpen(true);
    setDetailSearch('');
    setDetailLoading(true);
    try {
      const range = monthStartEnd(targetMonth);
      const detail = await getExternalSettlementCompanyDetail(token, {
        externalCompanyId: row.externalCompanyId,
        from: range.from,
        to: range.to,
        operatingCompanyId: resolvedOperatingCompanyId,
      });
      setDetailAllItems(
        detail.items.map((it) => ({
          inquiryId: it.inquiryId,
          inquiryNumber: it.inquiryNumber,
          customerName: it.customerName,
          signedFeeAmount: it.signedFeeAmount,
          viaMarketplace: it.viaMarketplace,
        })),
      );
    } catch {
      setDetailAllItems([]);
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
      setPayFormError('정산 금액은 정수로 입력해 주세요. (과납·오기입 보정 시 맨 앞에 - 를 붙일 수 있습니다)');
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
    if (!token || !selected || !payConfirm || !resolvedOperatingCompanyId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payYmd = /^\d{4}-\d{2}-\d{2}$/.test(payDateInput) ? payDateInput.trim() : kstTodayYmd();
      const result = await postExternalSettlementPayment(token, {
        externalCompanyId: selected.externalCompanyId,
        amount: payConfirm.inputAmount,
        memo: payMemoInput.trim() || undefined,
        paidDate: payYmd,
        operatingCompanyId: resolvedOperatingCompanyId,
      });
      const cacheKey = historyCacheKey(selected.externalCompanyId, resolvedOperatingCompanyId);
      const optimisticHistoryRow: HistoryRow = {
        id: result.payment.id,
        amount: result.payment.amount,
        paidAt: result.payment.paidAt,
        memo: payMemoInput.trim(),
        actorName: null,
      };
      setHistoryCacheByCompany((prev) => ({
        ...prev,
        [cacheKey]: mergeHistoryRows(prev[cacheKey] ?? [], [optimisticHistoryRow]),
      }));
      if (historyModalOpen && historyRows.some((row) => row.id === optimisticHistoryRow.id) === false) {
        setHistoryRows((prev) => mergeHistoryRows(prev, [optimisticHistoryRow]));
      }
      setPayModalOpen(false);
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
        <h1 className="text-xl font-semibold text-gray-800">타업체 정산</h1>
        <p className="mt-1 text-sm text-gray-500">
          영업 브랜드별로 타업체 정산·지급 내역을 분리해 관리합니다.
        </p>
      </div>

      {activeOperatingCompanies.length > 1 ? (
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {activeOperatingCompanies.map((oc) => {
            const active = oc.id === resolvedOperatingCompanyId;
            return (
              <button
                key={oc.id}
                type="button"
                onClick={() => setOperatingCompanyId(oc.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {oc.displayName || oc.name}
              </button>
            );
          })}
        </div>
      ) : activeOperatingCompanies.length === 1 ? (
        <p className="text-xs text-gray-500">
          브랜드: <span className="font-medium text-gray-700">{activeOperatingCompanies[0].displayName || activeOperatingCompanies[0].name}</span>
        </p>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="업체명 검색"
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
        {shouldShowListBlockingLoading(loading, filteredRows.length) ? (
          <div className="px-3 py-10 text-center text-gray-500">불러오는 중...</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-3 py-10 text-center text-gray-500">표시할 업체가 없습니다.</div>
        ) : (
          <>
            <div className="lg:hidden p-3 space-y-3">
              {filteredRows.map((r) => (
                <div key={r.externalCompanyId} className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-sm font-semibold text-gray-900">{r.companyName}</p>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <p className="flex items-center justify-between">
                      <span className="text-gray-500">결재받을 누적금액</span>
                      <strong className="tabular-nums text-gray-900">{won(r.payableAmount)}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-gray-500">결재받은금액</span>
                      <strong className="tabular-nums text-emerald-700">{won(r.paidAmount)}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-gray-500">미수금액</span>
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
                    <th className="px-3 py-2 text-center font-medium">업체명</th>
                    <th className="px-3 py-2 text-center font-medium">결재받을 누적금액</th>
                    <th className="px-3 py-2 text-center font-medium">결재받은금액</th>
                    <th className="px-3 py-2 text-center font-medium">미수금액</th>
                    <th className="px-3 py-2 text-center font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.externalCompanyId} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-center font-medium text-gray-900">{r.companyName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{won(r.payableAmount)}</td>
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
              <p className="mt-1 text-xs text-gray-600">{selected.companyName}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {payFormError ? (
                <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800" role="alert">
                  {payFormError}
                </p>
              ) : null}
              <p className="text-xs text-gray-600">
                현재 누적 미수금:{' '}
                <strong className="text-rose-700 tabular-nums">{won(selected.remainingAmount)}</strong>
                {selected.remainingAmount < 0 ? (
                  <span className="block mt-0.5 text-[11px] text-gray-500">
                    음수는 과납 등으로 미수가 마이너스인 상태입니다. 0으로 맞출 때 동일 금액을 앞에{' '}
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
                <p className="mt-0.5 text-[11px] text-gray-400">기본은 오늘 날짜이며, 변경 시 해당일로 정산·내역에 저장됩니다.</p>
              </div>
              <label className="block text-xs text-gray-500 mb-1">정산 금액</label>
              <input
                aria-label="정산 금액"
                value={payAmountInput}
                onChange={(e) => setPayAmountInput(sanitizeExternalPayAmountInput(e.target.value))}
                placeholder="정산 금액 (보정 시 -금액)"
                inputMode="numeric"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm tabular-nums"
              />
              <div className="flex w-full min-w-0 flex-nowrap gap-1 pt-1 sm:gap-1.5">
                <button
                  type="button"
                  aria-label="마이너스 전환"
                  title="마이너스 전환"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-gray-50 px-0.5 py-2 text-fluid-2xs font-medium leading-none text-gray-800 active:bg-gray-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput((v) => sanitizeExternalPayAmountInput(toggleExternalPayAmountMinus(v)))}
                >
                  <span className="sm:hidden">−</span>
                  <span className="hidden sm:inline">− 마이너스</span>
                </button>
                <button
                  type="button"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-white px-0.5 py-2 text-fluid-2xs font-medium leading-none text-gray-800 active:bg-gray-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput((v) => sanitizeExternalPayAmountInput(addExternalPayAmountUnit(v, 10_000)))}
                >
                  만
                </button>
                <button
                  type="button"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-white px-0.5 py-2 text-fluid-2xs font-medium leading-none text-gray-800 active:bg-gray-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput((v) => sanitizeExternalPayAmountInput(addExternalPayAmountUnit(v, 100_000)))}
                >
                  십만
                </button>
                <button
                  type="button"
                  className="flex min-h-[40px] min-w-0 flex-1 basis-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-white px-0.5 py-2 text-fluid-2xs font-medium leading-none text-gray-800 active:bg-gray-100 sm:px-1.5 sm:min-h-[42px]"
                  onClick={() => setPayAmountInput((v) => sanitizeExternalPayAmountInput(addExternalPayAmountUnit(v, 1_000_000)))}
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
              <p className="text-[11px] text-gray-400">
                일반 정산은 양수만 입력합니다. 잘못 입력한 정산을 되돌리거나 미수가 음수일 때는 「− 마이너스」 또는 앞에{' '}
                <span className="font-medium text-gray-600">-</span> 를 붙인 정수를 입력할 수 있습니다. 「만·십만·백만」은
                현재 부호를 유지한 채 금액만 더합니다.
              </p>
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
            <h4 className="text-sm font-semibold text-gray-900">정산완료 확인 - {selected.companyName}</h4>
            <p className="mt-2 text-sm flex justify-between">
              <span>현재 누적 미수금</span>
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
            <p className="mt-2 text-sm flex justify-between text-gray-600">
              <span>정산일</span>
              <span className="tabular-nums">
                {payDateInput
                  ? new Date(`${payDateInput}T12:00:00+09:00`).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
                  : '—'}
              </span>
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
              <h3 className="text-sm font-semibold text-gray-900">정산내역 - {selected.companyName}</h3>
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
                          <strong
                            className={`tabular-nums ${p.amount < 0 ? 'text-amber-800' : 'text-emerald-700'}`}
                          >
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
              <h3 className="text-sm font-semibold text-gray-900">기간별정산보기 - {selected.companyName}</h3>
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
                  <div className="lg:hidden space-y-2">
                    {periodRows.map((m) => (
                      <div key={m.month} className="rounded border border-gray-200 p-3 text-xs">
                        <p className="font-semibold text-gray-900">{m.month}</p>
                        <p className="mt-1 flex items-center justify-between">
                          <span className="text-gray-500">결제대상</span>
                          <span className="tabular-nums text-gray-900">{won(m.payableAmount)}</span>
                        </p>
                        <p className="mt-1 flex items-center justify-between">
                          <span className="text-gray-500">정산완료</span>
                          <span className="tabular-nums text-emerald-700">{won(m.paidAmount)}</span>
                        </p>
                        <p className="mt-1 flex items-center justify-between">
                          <span className="text-gray-500">미수금</span>
                          <span className="tabular-nums text-rose-700">{won(m.remainingAmount)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600">
                          <th className="px-3 py-2 text-center">월</th>
                          <th className="px-3 py-2 text-center">결제대상</th>
                          <th className="px-3 py-2 text-center">정산완료</th>
                          <th className="px-3 py-2 text-center">미수금</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodRows.map((m) => (
                          <tr key={m.month} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-center tabular-nums">{m.month}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{won(m.payableAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{won(m.paidAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-rose-700">{won(m.remainingAmount)}</td>
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
              <h3 className="text-sm font-semibold text-gray-900">정산 상세내역 - {selected.companyName}</h3>
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
                <p className="flex items-center justify-between">
                  <span className="text-gray-600">해당 월 합계 수수료</span>
                  <strong className={`tabular-nums ${detailMonthTotalFee < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {detailMonthTotalFee < 0 ? '-' : '+'}
                    {won(Math.abs(detailMonthTotalFee))}
                  </strong>
                </p>
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
                          <strong className={`tabular-nums ${it.signedFeeAmount < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {it.signedFeeAmount < 0 ? '-' : '+'}
                            {won(Math.abs(it.signedFeeAmount))}
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
                            <td className={`px-3 py-2 text-right tabular-nums font-semibold ${it.signedFeeAmount < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {it.signedFeeAmount < 0 ? '-' : '+'}
                              {won(Math.abs(it.signedFeeAmount))}
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
