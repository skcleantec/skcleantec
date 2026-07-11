import { useCallback, useEffect, useState } from 'react';
import type { SoomgoIntakeAutoTriggerKind } from '@shared/soomgoMessagePresets';
import {
  SOOMGO_AUTO_TRIGGER_KINDS,
  SOOMGO_AUTO_TRIGGER_LABELS,
} from '@shared/soomgoMessagePresets';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmSoomgoAutoMessages,
  updateTelecrmSoomgoAutoMessage,
  uploadTelecrmSoomgoPresetImage,
} from '../../../api/telecrmSoomgoMessagePresets';
import {
  normalizeSoomgoPresetSteps,
  SoomgoMessagePresetEditor,
  type SoomgoPresetDraft,
} from './SoomgoMessagePresetEditor';
import { invalidateSoomgoFollowupAutoConfigCache } from '../../../utils/soomgoFollowupAutoSend';
import { TelecrmBrandSelect } from './TelecrmBrandSelect';
import { TelecrmSoomgoQuoteAutoMessageSection } from './TelecrmSoomgoQuoteAutoMessageSection';

type AutoDraft = SoomgoPresetDraft & { triggerKind: SoomgoIntakeAutoTriggerKind };

const INTAKE_HINT: Record<SoomgoIntakeAutoTriggerKind, string> = {
  auto_requested: '「요청」 저장 시',
  auto_absent: '「부재」 저장 시',
  auto_hold: '「보류·고민」 저장 시',
  auto_deposit: '「예약금 대기」 저장 시',
  auto_reserved: '「입금 완료」 저장 시',
  auto_received: '「예약완료」 저장 시',
};

/** 숨고 프리셋 — 처리 구분별 자동 전송 (브랜드별, 업체 기본 폴백) */
export function TelecrmSoomgoAutoMessagesSection() {
  const token = getToken();
  const [brandId, setBrandId] = useState('default');
  const [fallbackFromDefault, setFallbackFromDefault] = useState(false);
  const [drafts, setDrafts] = useState<AutoDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<SoomgoIntakeAutoTriggerKind | null>(null);
  const [expanded, setExpanded] = useState<SoomgoIntakeAutoTriggerKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const operatingCompanyId = brandId === 'default' ? null : brandId;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmSoomgoAutoMessages(token, operatingCompanyId);
      setFallbackFromDefault(res.fallbackFromDefault === true);
      const byKind = new Map(res.items.map((item) => [item.triggerKind, item]));
      setDrafts(
        SOOMGO_AUTO_TRIGGER_KINDS.map((triggerKind) => {
          const item = byKind.get(triggerKind);
          return {
            triggerKind,
            id: item?.id ?? null,
            label: item?.label ?? SOOMGO_AUTO_TRIGGER_LABELS[triggerKind],
            steps: item?.steps ?? [],
            isActive: item?.isActive ?? false,
            sortOrder: 0,
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, operatingCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchDraft = (triggerKind: SoomgoIntakeAutoTriggerKind, patch: Partial<AutoDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.triggerKind === triggerKind ? { ...d, ...patch } : d)),
    );
  };

  const onImagePick = async (triggerKind: SoomgoIntakeAutoTriggerKind, stepIndex: number, file: File) => {
    if (!token) return;
    setBusyKind(triggerKind);
    try {
      const url = await uploadTelecrmSoomgoPresetImage(token, file);
      setDrafts((prev) =>
        prev.map((d) => {
          if (d.triggerKind !== triggerKind) return d;
          const step = d.steps[stepIndex];
          if (step?.type !== 'images') return d;
          const steps = [...d.steps];
          steps[stepIndex] = { ...step, urls: [...step.urls, url] };
          return { ...d, steps };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setBusyKind(null);
    }
  };

  const saveDraft = async (draft: AutoDraft) => {
    if (!token) return;
    const steps = normalizeSoomgoPresetSteps(draft.steps);
    if (draft.isActive && !steps.length) {
      setError('자동 전송을 켜려면 텍스트 또는 이미지 스텝을 1개 이상 추가해 주세요.');
      return;
    }
    setBusyKind(draft.triggerKind);
    setError(null);
    setMsg(null);
    try {
      const updated = await updateTelecrmSoomgoAutoMessage(token, draft.triggerKind, {
        steps,
        isActive: draft.isActive,
        operatingCompanyId,
      });
      invalidateSoomgoFollowupAutoConfigCache();
      setFallbackFromDefault(false);
      patchDraft(draft.triggerKind, {
        id: updated.id,
        steps: updated.steps,
        isActive: updated.isActive,
      });
      setMsg(`${SOOMGO_AUTO_TRIGGER_LABELS[draft.triggerKind]} 자동 메시지를 저장했습니다.`);
      window.setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusyKind(null);
    }
  };

  if (loading) {
    return <p className="text-fluid-sm text-gray-500">불러오는 중…</p>;
  }

  return (
    <div className="space-y-3">
      <TelecrmBrandSelect token={token} value={brandId} onChange={setBrandId} />
      {fallbackFromDefault ? (
        <p className="text-[11px] text-amber-700">
          이 브랜드 전용 설정이 없습니다 — 아래 내용은 업체 기본입니다. 저장하면 브랜드별로 생성됩니다.
        </p>
      ) : null}
      <p className="text-[11px] leading-snug text-gray-600">
        접수란 처리 구분별로 숨고 채팅 자동 전송 ON/OFF·메시지를 설정합니다. 브랜드별로 다르게 설정할 수
        있으며, 미설정 시 <strong>업체 기본</strong>이 사용됩니다.{' '}
        <span className="text-gray-500">{'{고객명}'}, {'{닉네임}'} 치환 가능.</span>
      </p>
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
        {drafts.map((draft) => {
          const open = expanded === draft.triggerKind;
          const stepCount = draft.steps.length;
          const busy = busyKind === draft.triggerKind;
          return (
            <div key={draft.triggerKind} className="border-b border-gray-100 last:border-b-0">
              <div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
                <label className="flex shrink-0 items-center gap-1.5" title="자동 전송">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => patchDraft(draft.triggerKind, { isActive: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-fluid-xs font-medium text-gray-900">
                    {SOOMGO_AUTO_TRIGGER_LABELS[draft.triggerKind]}
                  </span>
                </label>
                <span className="min-w-0 flex-1 truncate text-[10px] text-gray-500">
                  {INTAKE_HINT[draft.triggerKind]}
                  {stepCount > 0 ? ` · ${stepCount}스텝` : ' · 미설정'}
                </span>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : draft.triggerKind)}
                  className="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                >
                  {open ? '접기' : '편집'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveDraft(draft)}
                  className="shrink-0 rounded bg-slate-900 px-2 py-0.5 text-[10px] text-white disabled:opacity-50"
                >
                  저장
                </button>
              </div>
              {open ? (
                <div className="border-t border-gray-100 bg-gray-50/80 px-2 pb-2 pt-1">
                  <SoomgoMessagePresetEditor
                    draft={draft}
                    index={0}
                    busy={busy}
                    hideLabel
                    fixedTitle={SOOMGO_AUTO_TRIGGER_LABELS[draft.triggerKind]}
                    activeCheckboxLabel="자동 전송 사용"
                    textPlaceholder="예: {닉네임}님, 안내드립니다."
                    hint={INTAKE_HINT[draft.triggerKind]}
                    compact
                    onChange={(patch) => patchDraft(draft.triggerKind, patch)}
                    onSave={() => void saveDraft(draft)}
                    onImagePick={(stepIndex, file) =>
                      void onImagePick(draft.triggerKind, stepIndex, file)
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <TelecrmSoomgoQuoteAutoMessageSection
        brandId={brandId}
        onBrandIdChange={setBrandId}
        hideBrandSelector
      />
    </div>
  );
}
