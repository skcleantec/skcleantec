import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmSoomgoQuoteAutoMessage,
  updateTelecrmSoomgoQuoteAutoMessage,
} from '../../../api/telecrmSoomgoMessagePresets';
import { useOperatingCompanies } from '../../../hooks/useOperatingCompanies';
import { SettingsCard } from './DeletePasswordModal';
import { formatWon, parsePriceInt } from './telecrmSettingsUi';

/** 설정 → 기본 단가 — 숨고 견적보내기 페이백 금액 (브랜드별, 업체 공통) */
export function TelecrmSoomgoQuotePaybackSection() {
  const token = getToken();
  const brands = useOperatingCompanies(token);
  const [brandId, setBrandId] = useState<string>('default');
  const [paybackDraft, setPaybackDraft] = useState('');
  const [loadedMeta, setLoadedMeta] = useState<{
    steps: unknown[];
    isActive: boolean;
    id: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmSoomgoQuoteAutoMessage(
        token,
        brandId === 'default' ? null : brandId,
      );
      const payback =
        res.item.paybackWon ??
        (res.fallbackFromDefault ? res.defaultItem?.paybackWon : null) ??
        20000;
      setPaybackDraft(String(payback));
      setLoadedMeta({
        steps: res.item.steps,
        isActive: res.item.isActive,
        id: res.item.id,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token || !loadedMeta) return;
    const payback = parsePriceInt(paybackDraft);
    if (payback == null || payback < 0) {
      setError('페이백 금액을 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await updateTelecrmSoomgoQuoteAutoMessage(token, {
        steps: loadedMeta.steps as import('@shared/soomgoMessagePresets').SoomgoMessageStep[],
        isActive: loadedMeta.isActive,
        paybackWon: payback,
        operatingCompanyId: brandId === 'default' ? null : brandId,
      });
      setMsg('페이백 금액을 저장했습니다. 견적보내기 메시지의 {페이백금액}·{이벤트가}에 반영됩니다.');
      window.setTimeout(() => setMsg(null), 4000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="숨고 견적보내기 — 페이백 금액">
      <p className="mb-3 text-fluid-xs text-gray-600">
        CRM 「견적보내기」 숨고 메시지에서 {'{페이백금액}'}, {'{이벤트가}'}(견적가−페이백) 치환에
        쓰입니다. 서식 본문은 설정 → 숨고 프리셋 → 자동메시지에서 편집합니다.
      </p>
      {msg ? (
        <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-xs text-green-800">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-700">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : (
        <div className="space-y-3">
          <label className="flex flex-wrap items-center gap-2 text-fluid-sm text-gray-700">
            <span className="font-medium">브랜드</span>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="min-w-[10rem] rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-sm"
            >
              <option value="default">업체 기본</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-fluid-sm text-gray-700">
            <span className="font-medium">페이백 금액</span>
            <input
              type="text"
              inputMode="numeric"
              value={paybackDraft}
              onChange={(e) => setPaybackDraft(e.target.value)}
              placeholder="20000"
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 tabular-nums"
            />
            <span>원</span>
            {parsePriceInt(paybackDraft) != null ? (
              <span className="text-fluid-xs text-gray-500">
                표시 예: {formatWon(parsePriceInt(paybackDraft)!)}
              </span>
            ) : null}
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
          >
            {saving ? '저장 중…' : '페이백 저장'}
          </button>
        </div>
      )}
    </SettingsCard>
  );
}
