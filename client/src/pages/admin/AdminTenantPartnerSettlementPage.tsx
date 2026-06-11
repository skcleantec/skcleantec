import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../stores/auth';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import {
  downloadTenantPartnerSettlementCsv,
  getTenantPartnerBuyerSummary,
  getTenantPartnerSellerSummary,
  getTenantPartnerSettlementDetail,
  postTenantPartnerSettlementPayment,
  type TenantPartnerSettlementOverviewRow,
  type TenantPartnerSettlementRole,
} from '../../api/tenantPartnerSettlement';

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function kstMonthRange(): { from: string; to: string } {
  const to = kstTodayYmd();
  return { from: `${to.slice(0, 7)}-01`, to };
}

function formatKstDateLabel(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' });
}

function sanitizePayAmountInput(raw: string): string {
  let s = raw.replace(/[^\d,-]/g, '');
  if (!s) return '';
  const neg = s.charAt(0) === '-';
  s = s.replace(/-/g, '');
  return neg ? `-${s}` : s;
}

type Tab = TenantPartnerSettlementRole;

export function AdminTenantPartnerSettlementPage() {
  const token = getToken();
  const [tab, setTab] = useState<Tab>('SELLER');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TenantPartnerSettlementOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TenantPartnerSettlementOverviewRow | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMemo, setPayMemo] = useState('');
  const [payDate, setPayDate] = useState(kstTodayYmd());
  const [payError, setPayError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [csvBusyId, setCsvBusyId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPayments, setHistoryPayments] = useState<
    Array<{ id: string; amount: number; paidAt: string; memo: string | null; actorName: string | null }>
  >([]);

  const loadList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
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
  }, [tab, token]);

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

  const accruedLabel = tab === 'SELLER' ? '받을 누적금액' : '지급할 누적금액';
  const paidLabel = tab === 'SELLER' ? '받은 금액' : '지급한 금액';
  const remainingLabel = tab === 'SELLER' ? '미수금액' : '미지급 잔액';
  const payActionLabel = tab === 'SELLER' ? '수금 기록' : '지급 기록';

  const openPay = (row: TenantPartnerSettlementOverviewRow) => {
    setSelected(row);
    setPayAmount('');
    setPayMemo('');
    setPayDate(kstTodayYmd());
    setPayError(null);
    setPayOpen(true);
  };

  const downloadCsv = async (row: TenantPartnerSettlementOverviewRow) => {
    if (!token) return;
    const { from, to } = kstMonthRange();
    setCsvBusyId(row.partnerTenantId);
    try {
      const blob = await downloadTenantPartnerSettlementCsv(token, {
        role: tab,
        partnerTenantId: row.partnerTenantId,
        from,
        to,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant-settlement-${row.partnerSlug}-${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'CSV 다운로드에 실패했습니다.');
    } finally {
      setCsvBusyId(null);
    }
  };

  const openHistory = async (row: TenantPartnerSettlementOverviewRow) => {
    if (!token) return;
    setSelected(row);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const detail = await getTenantPartnerSettlementDetail(token, {
        role: tab,
        partnerTenantId: row.partnerTenantId,
        from: '2000-01-01',
        to: kstTodayYmd(),
      });
      setHistoryPayments(detail.payments);
    } catch {
      setHistoryPayments([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitPay = async () => {
    if (!token || !selected) return;
    setPayError(null);
    const compact = payAmount.replace(/,/g, '').trim();
    if (!/^-?\d+$/.test(compact)) {
      setPayError('금액은 정수로 입력해 주세요.');
      return;
    }
    const amount = Number(compact);
    if (!Number.isFinite(amount) || amount === 0) {
      setPayError('0원은 입력할 수 없습니다.');
      return;
    }
    if (payDate > kstTodayYmd()) {
      setPayError('정산일은 오늘(한국) 이후로 설정할 수 없습니다.');
      return;
    }
    setSaving(true);
    try {
      await postTenantPartnerSettlementPayment(token, {
        partnerTenantId: selected.partnerTenantId,
        role: tab,
        amount,
        memo: payMemo.trim() || undefined,
        paidDate: payDate,
      });
      setPayOpen(false);
      await loadList();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : '처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0 w-full max-w-full">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">파트너 정산</h1>
        <p className="mt-1 text-sm text-gray-500">
          접수 연계 수수료(예약일 기준)로 파트너별 잔액을 확인하고 수금·지급을 기록합니다.
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

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="px-3 py-10 text-center text-gray-500">불러오는 중...</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-3 py-10 text-center text-gray-500">
            표시할 파트너가 없습니다. 접수 연계 건이 있거나 수금·지급 이력이 있어야 합니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left font-medium">파트너</th>
                  <th className="px-3 py-2 text-right font-medium">{accruedLabel}</th>
                  <th className="px-3 py-2 text-right font-medium">{paidLabel}</th>
                  <th className="px-3 py-2 text-right font-medium">{remainingLabel}</th>
                  <th className="px-3 py-2 text-center font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.partnerTenantId} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{r.partnerName}</div>
                      <div className="text-xs text-gray-500">{r.partnerSlug}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{won(r.accruedAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{won(r.paidAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">{won(r.remainingAmount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openPay(r)}
                          className="rounded bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800"
                        >
                          {payActionLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => void openHistory(r)}
                          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
                        >
                          내역
                        </button>
                        <button
                          type="button"
                          disabled={csvBusyId === r.partnerTenantId}
                          onClick={() => void downloadCsv(r)}
                          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 disabled:opacity-50"
                        >
                          {csvBusyId === r.partnerTenantId ? '…' : 'CSV'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <ModalCloseButton onClick={() => setPayOpen(false)} />
            <h2 className="pr-10 text-lg font-semibold text-gray-900">
              {selected.partnerName} — {payActionLabel}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              현재 잔액: <span className="font-medium text-rose-700">{won(selected.remainingAmount)}</span>
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">금액 (원)</label>
                <input
                  value={payAmount}
                  onChange={(e) => setPayAmount(sanitizePayAmountInput(e.target.value))}
                  className="w-full rounded border border-gray-300 px-3 py-2 tabular-nums"
                  inputMode="numeric"
                  placeholder="정수, 보정 시 -"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">정산일</label>
                <input
                  type="date"
                  value={payDate}
                  max={kstTodayYmd()}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">메모</label>
                <input
                  value={payMemo}
                  onChange={(e) => setPayMemo(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
              {payError ? <p className="text-sm text-red-600">{payError}</p> : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitPay()}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
            <div className="shrink-0 border-b px-5 py-4">
              <ModalCloseButton onClick={() => setHistoryOpen(false)} />
              <h2 className="pr-10 text-lg font-semibold text-gray-900">{selected.partnerName} 정산 내역</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {historyLoading ? (
                <p className="text-sm text-gray-500">불러오는 중...</p>
              ) : historyPayments.length === 0 ? (
                <p className="text-sm text-gray-500">기록이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {historyPayments.map((p) => (
                    <li key={p.id} className="rounded border border-gray-100 px-3 py-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="tabular-nums font-medium">{won(p.amount)}</span>
                        <span className="text-gray-500">{formatKstDateLabel(p.paidAt)}</span>
                      </div>
                      {p.memo ? <p className="mt-1 text-xs text-gray-600">{p.memo}</p> : null}
                      {p.actorName ? (
                        <p className="mt-0.5 text-[11px] text-gray-400">{p.actorName}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
