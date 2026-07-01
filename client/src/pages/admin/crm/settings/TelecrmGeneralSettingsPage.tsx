import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../../stores/auth';
import { getEstimateConfig, updateEstimateConfig } from '../../../../api/estimate';
import { SettingsCard } from '../../../../components/crm/settings/DeletePasswordModal';
import { parsePriceInt, formatWon } from '../../../../components/crm/settings/telecrmSettingsUi';
import { computeEstimateTotalFromPyeong } from '@shared/estimateTotal';

export function TelecrmGeneralSettingsPage() {
  const token = getToken();
  const [pricePerPyeong, setPricePerPyeong] = useState('');
  const [minimumTotalAmount, setMinimumTotalAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const cfg = await getEstimateConfig(token);
      setPricePerPyeong(String(cfg.pricePerPyeong ?? ''));
      setMinimumTotalAmount(String(cfg.minimumTotalAmount ?? 0));
      setDepositAmount(String(cfg.depositAmount ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token) return;
    const ppp = parsePriceInt(pricePerPyeong);
    const minTotal = parsePriceInt(minimumTotalAmount);
    const dep = parsePriceInt(depositAmount);
    if (ppp == null || minTotal == null || dep == null) {
      setError('평당 단가·최소 금액·예약금을 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await updateEstimateConfig(token, {
        pricePerPyeong: ppp,
        minimumTotalAmount: minTotal,
        depositAmount: dep,
      });
      setMsg('저장했습니다. 텔레CRM 계산기·발주 견적에 동일하게 적용됩니다.');
      window.setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const previewPpp = parsePriceInt(pricePerPyeong) ?? 0;
  const previewMin = parsePriceInt(minimumTotalAmount) ?? 0;
  const preview30 = useMemo(
    () => computeEstimateTotalFromPyeong(30, previewPpp, previewMin),
    [previewPpp, previewMin],
  );
  const preview10 = useMemo(
    () => computeEstimateTotalFromPyeong(10, previewPpp, previewMin),
    [previewPpp, previewMin],
  );

  return (
    <div className="space-y-4">
      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-800">{msg}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">{error}</p>
      ) : null}

      <SettingsCard title="기본 단가 · 최소 금액 · 예약금">
        <p className="text-fluid-sm text-gray-500">
          발주서 견적 설정과 동일한 값입니다. 텔레CRM 가격 패널·스크립트 {'{예상가}'} 치환에 사용됩니다.
          최소 금액을 0보다 크게 두면, 평수×평당 계산이 그보다 작을 때 최소 금액이 적용됩니다.
        </p>
        {loading ? (
          <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : (
          <div className="grid max-w-md gap-4">
            <label className="block space-y-1">
              <span className="text-fluid-xs font-medium text-gray-700">평당 단가 (원)</span>
              <input
                type="text"
                value={pricePerPyeong}
                onChange={(e) => setPricePerPyeong(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-fluid-xs font-medium text-gray-700">최소 금액 (원)</span>
              <input
                type="text"
                value={minimumTotalAmount}
                onChange={(e) => setMinimumTotalAmount(e.target.value)}
                placeholder="0 — 미적용"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
              />
              <span className="text-[10px] text-gray-500">0이면 평수×평당만 사용합니다.</span>
            </label>
            <label className="block space-y-1">
              <span className="text-fluid-xs font-medium text-gray-700">예약금 (원)</span>
              <input
                type="text"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
              />
            </label>
            <p className="text-fluid-xs text-gray-500">
              예: 평당 {formatWon(previewPpp)} · 30평 ≈ {formatWon(preview30)}
              {previewMin > 0 ? ` · 10평 ≈ ${formatWon(preview10)} (최소 ${formatWon(previewMin)} 적용 가능)` : ''}
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
