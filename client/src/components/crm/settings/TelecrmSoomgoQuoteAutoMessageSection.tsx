import { useCallback, useEffect, useState } from 'react';
import { SOOMGO_QUOTE_AUTO_TRIGGER_LABEL } from '@shared/soomgoMessagePresets';
import { SOOMGO_QUOTE_PLACEHOLDER_HINTS } from '@shared/telecrmSoomgoQuotePlaceholders';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmSoomgoQuoteAutoMessage,
  updateTelecrmSoomgoQuoteAutoMessage,
  uploadTelecrmSoomgoPresetImage,
} from '../../../api/telecrmSoomgoMessagePresets';
import { useOperatingCompanies } from '../../../hooks/useOperatingCompanies';
import {
  normalizeSoomgoPresetSteps,
  SoomgoMessagePresetEditor,
  type SoomgoPresetDraft,
} from './SoomgoMessagePresetEditor';

type QuoteDraft = SoomgoPresetDraft & { paybackWon: string };

/** 숨고 프리셋 — 견적보내기 서식 (브랜드별, 업체 기본 폴백) */
export function TelecrmSoomgoQuoteAutoMessageSection({
  brandId: brandIdProp,
  onBrandIdChange,
  hideBrandSelector = false,
}: {
  brandId?: string;
  onBrandIdChange?: (id: string) => void;
  hideBrandSelector?: boolean;
} = {}) {
  const token = getToken();
  const brands = useOperatingCompanies(token);
  const [internalBrandId, setInternalBrandId] = useState<string>('default');
  const brandId = brandIdProp ?? internalBrandId;
  const setBrandId = onBrandIdChange ?? setInternalBrandId;
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [fallbackFromDefault, setFallbackFromDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmSoomgoQuoteAutoMessage(
        token,
        brandId === 'default' ? null : brandId,
      );
      setFallbackFromDefault(res.fallbackFromDefault === true);
      setDraft({
        id: res.item.id,
        label: res.item.label,
        steps: res.item.steps,
        isActive: res.item.isActive,
        sortOrder: 0,
        paybackWon:
          res.item.paybackWon != null
            ? String(res.item.paybackWon)
            : res.defaultItem?.paybackWon != null
              ? String(res.defaultItem.paybackWon)
              : '20000',
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

  const onImagePick = async (stepIndex: number, file: File) => {
    if (!token || !draft) return;
    setBusy(true);
    try {
      const url = await uploadTelecrmSoomgoPresetImage(token, file);
      setDraft((prev) => {
        if (!prev) return prev;
        const step = prev.steps[stepIndex];
        if (step?.type !== 'images') return prev;
        const steps = [...prev.steps];
        steps[stepIndex] = { ...step, urls: [...step.urls, url] };
        return { ...prev, steps };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!token || !draft) return;
    const steps = normalizeSoomgoPresetSteps(draft.steps);
    if (draft.isActive && !steps.length) {
      setError('자동 전송을 켜려면 텍스트 또는 이미지 스텝을 1개 이상 추가해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const updated = await updateTelecrmSoomgoQuoteAutoMessage(token, {
        steps,
        isActive: draft.isActive,
        operatingCompanyId: brandId === 'default' ? null : brandId,
      });
      setFallbackFromDefault(false);
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              id: updated.id,
              steps: updated.steps,
              isActive: updated.isActive,
              paybackWon: updated.paybackWon != null ? String(updated.paybackWon) : prev.paybackWon,
            }
          : prev,
      );
      setMsg(`${SOOMGO_QUOTE_AUTO_TRIGGER_LABEL} 서식을 저장했습니다.`);
      window.setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-fluid-sm text-gray-500">불러오는 중…</p>;
  }

  if (!draft) {
    return <p className="text-fluid-sm text-red-600">견적보내기 설정을 불러오지 못했습니다.</p>;
  }

  const stepCount = draft.steps.length;
  const placeholderHint = SOOMGO_QUOTE_PLACEHOLDER_HINTS.join(', ');

  return (
    <div className="space-y-3 border-t border-gray-200 pt-4">
      <div>
        <p className="text-fluid-sm font-semibold text-gray-900">{SOOMGO_QUOTE_AUTO_TRIGGER_LABEL}</p>
        <p className="mt-1 text-[11px] leading-snug text-gray-600">
          CRM 견적 패널의 「견적보내기」 버튼으로 숨고 채팅에 보낼 메시지입니다. 브랜드별로 다르게
          설정할 수 있으며, 페이백 금액은 설정 → <strong>기본 단가</strong> 탭에서 입력합니다.
        </p>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-[11px] text-gray-700">
        {!hideBrandSelector ? (
          <>
            <span className="font-medium">브랜드</span>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="min-w-[8rem] rounded border border-gray-300 bg-white px-2 py-1 text-[11px]"
            >
              <option value="default">업체 기본</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {fallbackFromDefault ? (
          <span className="text-amber-700">이 브랜드 전용 서식 없음 — 저장 시 브랜드별로 생성됩니다.</span>
        ) : null}
      </label>

      {msg ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-[11px] text-green-800">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
          <label className="flex shrink-0 items-center gap-1.5" title="서식 사용">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => (d ? { ...d, isActive: e.target.checked } : d))}
              className="rounded border-gray-300"
            />
            <span className="text-fluid-xs font-medium text-gray-900">사용</span>
          </label>
          <span className="min-w-0 flex-1 truncate text-[10px] text-gray-500">
            CRM 「견적보내기」 클릭 시
            {stepCount > 0 ? ` · ${stepCount}스텝` : ' · 미설정'}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
          >
            {expanded ? '접기' : '편집'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="shrink-0 rounded bg-slate-900 px-2 py-0.5 text-[10px] text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
        {expanded ? (
          <div className="border-t border-gray-100 bg-gray-50/80 px-2 pb-2 pt-1">
            <p className="mb-2 text-[10px] text-gray-500">치환: {placeholderHint}</p>
            <SoomgoMessagePresetEditor
              draft={draft}
              index={0}
              busy={busy}
              hideLabel
              fixedTitle={SOOMGO_QUOTE_AUTO_TRIGGER_LABEL}
              activeCheckboxLabel="서식 사용"
              textPlaceholder="예: {닉네임}님, 견적 {견적가} / 이벤트가 {이벤트가} 입니다."
              hint="CRM 견적보내기 버튼으로 전송"
              compact
              onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
              onSave={() => void save()}
              onImagePick={(stepIndex, file) => void onImagePick(stepIndex, file)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
