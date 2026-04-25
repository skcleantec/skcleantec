import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  getExternalSettlementCompanyDetail,
  getExternalSettlementCompanyOverviewList,
  getExternalSettlementMonthlyOverview,
  postExternalSettlementPayment,
  type ExternalSettlementCompanyOverviewRow,
} from '../../api/externalCompanies';

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

type PayConfirmState = {
  currentRemaining: number;
  inputAmount: number;
  afterRemaining: number;
};

export function AdminExternalSettlementPage() {
  const token = getToken();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ExternalSettlementCompanyOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ExternalSettlementCompanyOverviewRow | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);

  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMemoInput, setPayMemoInput] = useState('');
  const [payConfirm, setPayConfirm] = useState<PayConfirmState | null>(null);
  const [saving, setSaving] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<
    Array<{ id: string; amount: number; paidAt: string; memo: string | null; actorName: string | null }>
  >([]);

  const [periodLoading, setPeriodLoading] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [periodRows, setPeriodRows] = useState<
    Array<{ month: string; payableAmount: number; paidAmount: number; remainingAmount: number }>
  >([]);

  const loadList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getExternalSettlementCompanyOverviewList(token);
      setRows(r.items);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : '업체 정산 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

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
    setPayConfirm(null);
    setPayModalOpen(true);
  };

  const openHistoryModal = async (row: ExternalSettlementCompanyOverviewRow) => {
    if (!token) return;
    setSelected(row);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const detail = await getExternalSettlementCompanyDetail(token, {
        externalCompanyId: row.externalCompanyId,
        from: '2000-01-01',
        to: kstTodayYmd(),
      });
      setHistoryRows(detail.payments);
    } catch {
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openPeriodModal = async (row: ExternalSettlementCompanyOverviewRow, targetYear = year) => {
    if (!token) return;
    setSelected(row);
    setPeriodModalOpen(true);
    setPeriodLoading(true);
    try {
      const summary = await getExternalSettlementMonthlyOverview(token, {
        fromMonth: `${targetYear}-01`,
        toMonth: `${targetYear}-12`,
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

  const preparePaymentConfirm = () => {
    if (!selected) return;
    const amount = Number(payAmountInput.replace(/[^\d]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert('정산 금액은 0원보다 커야 합니다.');
      return;
    }
    if (!payMemoInput.trim()) {
      window.alert('메모를 입력해주세요.');
      return;
    }
    const currentRemaining = Math.max(0, selected.remainingAmount);
    setPayConfirm({
      currentRemaining,
      inputAmount: Math.floor(amount),
      afterRemaining: Math.max(0, currentRemaining - Math.floor(amount)),
    });
  };

  const submitPayment = async () => {
    if (!token || !selected || !payConfirm) return;
    setSaving(true);
    try {
      await postExternalSettlementPayment(token, {
        externalCompanyId: selected.externalCompanyId,
        amount: payConfirm.inputAmount,
        memo: payMemoInput.trim(),
      });
      setPayModalOpen(false);
      setPayConfirm(null);
      await loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '정산완료 처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0 w-full max-w-full">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">타업체 정산</h1>
        <p className="mt-1 text-sm text-gray-500">
          업체를 선택한 뒤 정산 금액을 입력해 정산완료 처리합니다.
        </p>
      </div>

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
        {loading ? (
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
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">정산 처리</h3>
              <p className="mt-1 text-xs text-gray-600">{selected.companyName}</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-gray-600">
                현재 누적 미수금:{' '}
                <strong className="text-rose-700 tabular-nums">{won(Math.max(0, selected.remainingAmount))}</strong>
              </p>
              <input
                value={payAmountInput}
                onChange={(e) => setPayAmountInput(e.target.value.replace(/[^\d,]/g, ''))}
                placeholder="정산 금액"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={payMemoInput}
                onChange={(e) => setPayMemoInput(e.target.value)}
                placeholder="메모"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="px-4 pb-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={preparePaymentConfirm}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white"
              >
                정산완료
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payConfirm && selected ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-900">정산완료 확인 - {selected.companyName}</h4>
            <p className="mt-2 text-sm flex justify-between">
              <span>현재 누적 미수금</span>
              <strong>{won(payConfirm.currentRemaining)}</strong>
            </p>
            <p className="text-sm flex justify-between">
              <span>입력금액</span>
              <strong>{won(payConfirm.inputAmount)}</strong>
            </p>
            <p className="text-sm flex justify-between">
              <span>처리 후 남은 금액</span>
              <strong>{won(payConfirm.afterRemaining)}</strong>
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayConfirm(null)}
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
                확정
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyModalOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">정산내역 - {selected.companyName}</h3>
              <button type="button" onClick={() => setHistoryModalOpen(false)} className="text-xs text-gray-500">
                닫기
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              {historyLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">불러오는 중...</div>
              ) : historyRows.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">정산내역이 없습니다.</div>
              ) : (
                <>
                  <div className="lg:hidden space-y-2">
                    {historyRows.map((p) => (
                      <div key={p.id} className="rounded border border-gray-200 p-3 text-xs">
                        <p className="text-gray-500">
                          {new Date(p.paidAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                        <p className="mt-1 flex items-center justify-between">
                          <span className="text-gray-500">금액</span>
                          <strong className="tabular-nums text-emerald-700">{won(p.amount)}</strong>
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
                            <td className="px-3 py-2 text-center tabular-nums">
                              {new Date(p.paidAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{won(p.amount)}</td>
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
          <div className="w-full max-w-3xl rounded-lg bg-white border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">기간별정산보기 - {selected.companyName}</h3>
              <button type="button" onClick={() => setPeriodModalOpen(false)} className="text-xs text-gray-500">
                닫기
              </button>
            </div>
            <div className="p-4">
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
    </div>
  );
}
