import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  applyTelecrmAiQuoteCorrection,
  dismissTelecrmAiQuoteCorrection,
  fetchTelecrmAiQuoteBaseRows,
  fetchTelecrmAiQuoteCorrections,
  updateTelecrmAiQuoteBaseRow,
  type TelecrmAiQuoteBaseRowDto,
  type TelecrmAiQuoteCorrectionItem,
} from '../../../api/telecrmQuoteCrewLearning';
import { SettingsCard } from './DeletePasswordModal';

function manLabel(won: number): string {
  const man = won / 10000;
  return Number.isInteger(man) ? `${man}만` : `${man.toLocaleString('ko-KR')}만`;
}

export function CrmAiQuoteBaseSection() {
  const token = getToken();
  const [rows, setRows] = useState<TelecrmAiQuoteBaseRowDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [items, setItems] = useState<TelecrmAiQuoteCorrectionItem[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [base, corrections] = await Promise.all([
        fetchTelecrmAiQuoteBaseRows(token),
        fetchTelecrmAiQuoteCorrections(token),
      ]);
      setRows(base.items);
      setDrafts(Object.fromEntries(base.items.map((row) => [row.id, String(row.amountWon)])));
      setItems(corrections.items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '기준표를 불러오지 못했습니다.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAmount(row: TelecrmAiQuoteBaseRowDto) {
    if (!token) return;
    const amountWon = Math.round(Number(drafts[row.id]));
    if (!Number.isFinite(amountWon) || amountWon <= 0) return;
    await updateTelecrmAiQuoteBaseRow(token, row.id, { amountWon });
    await load();
  }

  async function toggle(row: TelecrmAiQuoteBaseRowDto) {
    if (!token) return;
    await updateTelecrmAiQuoteBaseRow(token, row.id, { isActive: !row.isActive });
    await load();
  }

  return (
    <>
      <SettingsCard title="기준표">
        {error ? <p className="mb-2 text-fluid-xs text-rose-600">{error}</p> : null}
        {rows.length === 0 ? (
          <p className="text-fluid-sm text-slate-500">등록된 기준표가 없습니다. 이 업체는 예약 학습 금액을 씁니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-fluid-xs">
              <thead>
                <tr className="h-9 border-b border-slate-200 bg-slate-50 text-left text-fluid-2xs font-semibold text-slate-600">
                  <th className="px-3">조건</th>
                  <th className="px-3">금액</th>
                  <th className="px-3">사용</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-700">
                      <div>{row.condition}</div>
                      <div className="text-fluid-2xs text-slate-500">{row.label}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={drafts[row.id] ?? ''}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          className="w-28 rounded-lg border border-slate-300 px-2 py-1 tabular-nums"
                          inputMode="numeric"
                        />
                        <button
                          type="button"
                          onClick={() => void saveAmount(row)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
                        >
                          저장
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void toggle(row)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
                      >
                        {row.isActive ? '켜짐' : '꺼짐'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="상담사 견적과 달랐던 것">
        {items.length === 0 ? (
          <p className="text-fluid-sm text-slate-500">최근 30일 동안 같은 금액으로 3번 이상 다르게 보낸 줄이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={`${item.baseRowId}-${item.sentAmountWon}`} className="flex flex-wrap items-center gap-2 py-2 text-fluid-xs">
                <span className="text-slate-800">{item.label}</span>
                <span className="tabular-nums text-slate-600">기준 {manLabel(item.tableAmountWon)}</span>
                <span className="tabular-nums text-slate-800">보낸 금액 {manLabel(item.sentAmountWon)} · {item.count}번</span>
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-2 py-1 text-white hover:bg-slate-800"
                  onClick={() => {
                    if (!token) return;
                    void applyTelecrmAiQuoteCorrection(token, item.baseRowId, item.sentAmountWon).then(() => load());
                  }}
                >
                  기준표를 {manLabel(item.sentAmountWon)}으로
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    if (!token) return;
                    void dismissTelecrmAiQuoteCorrection(token, item.baseRowId, item.sentAmountWon).then(() => load());
                  }}
                >
                  그대로
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </>
  );
}
