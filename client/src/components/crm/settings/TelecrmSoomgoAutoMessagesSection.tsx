import { useCallback, useEffect, useState } from 'react';
import type { SoomgoAutoTriggerKind } from '@shared/soomgoMessagePresets';
import { SOOMGO_AUTO_TRIGGER_KINDS, SOOMGO_AUTO_TRIGGER_LABELS } from '@shared/soomgoMessagePresets';
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

type AutoDraft = SoomgoPresetDraft & { triggerKind: SoomgoAutoTriggerKind };

const PLACEHOLDER_HINT =
  '텍스트에 {고객명}, {닉네임} 을 넣으면 저장 시 자동 치환됩니다.';

/** 숨고 프리셋 — 부재·보류 자동 전송 (업체 공통, 스텝 시퀀스) */
export function TelecrmSoomgoAutoMessagesSection() {
  const token = getToken();
  const [drafts, setDrafts] = useState<AutoDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<SoomgoAutoTriggerKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmSoomgoAutoMessages(token);
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
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onImagePick = async (triggerKind: SoomgoAutoTriggerKind, stepIndex: number, file: File) => {
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
      });
      invalidateSoomgoFollowupAutoConfigCache();
      setDrafts((prev) =>
        prev.map((d) =>
          d.triggerKind === draft.triggerKind
            ? {
                ...d,
                id: updated.id,
                steps: updated.steps,
                isActive: updated.isActive,
              }
            : d,
        ),
      );
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
    <div className="space-y-4">
      <p className="text-fluid-sm text-gray-600">
        접수란에서 <strong>부재</strong> 또는 <strong>보류·고민</strong>으로 저장할 때, 열려 있는 숨고
        채팅방으로 아래 스텝을 순서대로 전송합니다. 매크로 프리셋과 동일하게 텍스트·이미지를 조합할 수
        있습니다.
      </p>
      <p className="text-[11px] text-gray-500">{PLACEHOLDER_HINT}</p>
      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-800">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">
          {error}
        </p>
      ) : null}
      {drafts.map((draft, index) => (
        <SoomgoMessagePresetEditor
          key={draft.triggerKind}
          draft={draft}
          index={index}
          busy={busyKind === draft.triggerKind}
          hideLabel
          fixedTitle={SOOMGO_AUTO_TRIGGER_LABELS[draft.triggerKind]}
          activeCheckboxLabel="저장 시 숨고 채팅 자동 전송"
          textPlaceholder="예: {닉네임}님, 연락 드렸으나 부재중이라 메시지 남깁니다."
          hint={
            draft.triggerKind === 'auto_absent'
              ? '처리 구분 「부재」 저장 시 전송됩니다.'
              : '처리 구분 「보류·고민」 저장 시 전송됩니다.'
          }
          onChange={(patch) =>
            setDrafts((prev) =>
              prev.map((d) => (d.triggerKind === draft.triggerKind ? { ...d, ...patch } : d)),
            )
          }
          onSave={() => {
            const current = drafts.find((d) => d.triggerKind === draft.triggerKind);
            if (current) void saveDraft(current);
          }}
          onImagePick={(stepIndex, file) => void onImagePick(draft.triggerKind, stepIndex, file)}
        />
      ))}
    </div>
  );
}
