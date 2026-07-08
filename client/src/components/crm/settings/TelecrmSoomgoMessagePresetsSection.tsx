import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SoomgoMessageImageMode, SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import { SOOMGO_MESSAGE_PRESET_SLOTS } from '@shared/soomgoMessagePresets';
import { getToken } from '../../../stores/auth';
import {
  createTelecrmSoomgoMessagePreset,
  deleteTelecrmSoomgoMessagePreset,
  fetchTelecrmSoomgoMessagePresets,
  updateTelecrmSoomgoMessagePreset,
  uploadTelecrmSoomgoPresetImage,
} from '../../../api/telecrmSoomgoMessagePresets';
import { DeletePasswordModal, SettingsCard } from './DeletePasswordModal';
import { crmFieldClass } from '../crmUi';

type SlotDraft = {
  id: string | null;
  label: string;
  steps: SoomgoMessageStep[];
  isActive: boolean;
};

function emptyDraft(): SlotDraft {
  return { id: null, label: '', steps: [], isActive: true };
}

function stepSummary(step: SoomgoMessageStep): string {
  if (step.type === 'text') {
    const preview = step.text.length > 40 ? `${step.text.slice(0, 40)}…` : step.text;
    return `텍스트: ${preview}`;
  }
  return `이미지 ${step.urls.length}장 (${step.mode === 'bundle' ? '묶음' : '개별'})`;
}

export function TelecrmSoomgoMessagePresetsSection() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, SlotDraft>>({
    1: emptyDraft(),
    2: emptyDraft(),
    3: emptyDraft(),
  });
  const [deleteSlot, setDeleteSlot] = useState<number | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmSoomgoMessagePresets(token, { scope: 'shared', includeInactive: true });
      const next: Record<number, SlotDraft> = { 1: emptyDraft(), 2: emptyDraft(), 3: emptyDraft() };
      for (const preset of res.presets) {
        if (preset.slotNumber < 1 || preset.slotNumber > 3) continue;
        next[preset.slotNumber] = {
          id: preset.id,
          label: preset.label,
          steps: preset.steps,
          isActive: preset.isActive,
        };
      }
      setDrafts(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateSlot = (slot: number, patch: Partial<SlotDraft>) => {
    setDrafts((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  };

  const addTextStep = (slot: number) => {
    const steps = [...drafts[slot].steps, { type: 'text' as const, text: '' }];
    updateSlot(slot, { steps });
  };

  const addImageStep = (slot: number) => {
    const steps = [...drafts[slot].steps, { type: 'images' as const, urls: [], mode: 'bundle' as SoomgoMessageImageMode }];
    updateSlot(slot, { steps });
  };

  const patchStep = (slot: number, index: number, step: SoomgoMessageStep) => {
    const steps = [...drafts[slot].steps];
    steps[index] = step;
    updateSlot(slot, { steps });
  };

  const removeStep = (slot: number, index: number) => {
    updateSlot(slot, { steps: drafts[slot].steps.filter((_, i) => i !== index) });
  };

  const moveStep = (slot: number, index: number, dir: -1 | 1) => {
    const steps = [...drafts[slot].steps];
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    updateSlot(slot, { steps });
  };

  const onImagePick = async (slot: number, stepIndex: number, file: File | null) => {
    if (!file || !token) return;
    setBusy(true);
    try {
      const url = await uploadTelecrmSoomgoPresetImage(token, file);
      const step = drafts[slot].steps[stepIndex];
      if (step?.type !== 'images') return;
      patchStep(slot, stepIndex, { ...step, urls: [...step.urls, url] });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setBusy(false);
    }
  };

  const saveSlot = async (slot: number) => {
    if (!token) return;
    const draft = drafts[slot];
    const label = draft.label.trim();
    const steps = draft.steps
      .map((s) => {
        if (s.type === 'text') return { ...s, text: s.text.trim() };
        return { ...s, urls: s.urls.filter(Boolean) };
      })
      .filter((s) => (s.type === 'text' ? s.text.length > 0 : s.urls.length > 0));
    if (!label) {
      setError(`프리셋 ${slot}번 이름을 입력해 주세요.`);
      return;
    }
    if (!steps.length) {
      setError(`프리셋 ${slot}번에 전송 스텝을 추가해 주세요.`);
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      if (draft.id) {
        await updateTelecrmSoomgoMessagePreset(token, draft.id, { label, steps, isActive: draft.isActive });
      } else {
        await createTelecrmSoomgoMessagePreset(token, { label, steps, slotNumber: slot, ownerScope: 'shared' });
      }
      setMsg(`프리셋 ${slot}번을 저장했습니다.`);
      window.setTimeout(() => setMsg(null), 3500);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const deleteTargetId = useMemo(() => {
    if (deleteSlot == null) return null;
    return drafts[deleteSlot]?.id;
  }, [deleteSlot, drafts]);

  return (
    <div className="space-y-4">
      <p className="text-fluid-xs text-gray-600">
        상담 화면 「숨고 메시지」에서 <strong>1·2·3번</strong> 버튼으로 순차 전송합니다. 텍스트와 이미지(묶음/개별) 순서를
        설정하세요.
      </p>
      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-800">{msg}</p>
      ) : null}
      {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-fluid-sm text-gray-500">불러오는 중…</p> : null}

      {SOOMGO_MESSAGE_PRESET_SLOTS.map((slot) => {
        const draft = drafts[slot];
        return (
          <SettingsCard
            key={slot}
            title={`프리셋 ${slot}번${draft.id ? '' : ' (미설정)'}`}
            actions={
              <div className="flex flex-wrap gap-2">
                {draft.id ? (
                  <button
                    type="button"
                    className="text-fluid-xs text-rose-600"
                    onClick={() => {
                      setDeleteSlot(slot);
                      setDeletePassword('');
                      setDeleteError(null);
                    }}
                  >
                    삭제
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveSlot(slot)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs text-white disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            }
          >
            <div className="space-y-3">
              <input
                type="text"
                value={draft.label}
                onChange={(e) => updateSlot(slot, { label: e.target.value })}
                placeholder="프리셋 이름 (예: 견적 안내)"
                className={crmFieldClass}
              />
              <label className="flex items-center gap-2 text-fluid-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => updateSlot(slot, { isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                사용
              </label>
              <div className="space-y-2">
                {draft.steps.map((step, index) => (
                  <div key={`${slot}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-fluid-xs font-medium text-gray-700">{stepSummary(step)}</span>
                      <div className="flex gap-1">
                        <button type="button" className="text-fluid-xs text-gray-500" onClick={() => moveStep(slot, index, -1)}>
                          ↑
                        </button>
                        <button type="button" className="text-fluid-xs text-gray-500" onClick={() => moveStep(slot, index, 1)}>
                          ↓
                        </button>
                        <button type="button" className="text-fluid-xs text-rose-600" onClick={() => removeStep(slot, index)}>
                          삭제
                        </button>
                      </div>
                    </div>
                    {step.type === 'text' ? (
                      <textarea
                        value={step.text}
                        onChange={(e) => patchStep(slot, index, { type: 'text', text: e.target.value })}
                        rows={3}
                        placeholder="채팅 메시지"
                        className={crmFieldClass}
                      />
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-fluid-xs">
                            이미지 추가
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => void onImagePick(slot, index, e.target.files?.[0] ?? null)}
                            />
                          </label>
                          <select
                            value={step.mode}
                            onChange={(e) =>
                              patchStep(slot, index, {
                                ...step,
                                mode: e.target.value as SoomgoMessageImageMode,
                              })
                            }
                            className="rounded-lg border border-gray-200 px-2 py-1 text-fluid-xs"
                          >
                            <option value="bundle">묶음 전송</option>
                            <option value="single">개별 전송</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {step.urls.map((url, urlIndex) => (
                            <div key={url} className="relative">
                              <img src={url} alt="" className="h-14 w-14 rounded border object-cover" />
                              <button
                                type="button"
                                className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1 text-[10px] text-white"
                                onClick={() =>
                                  patchStep(slot, index, {
                                    ...step,
                                    urls: step.urls.filter((_, i) => i !== urlIndex),
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addTextStep(slot)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-fluid-xs hover:bg-gray-50"
                >
                  + 텍스트
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addImageStep(slot)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-fluid-xs hover:bg-gray-50"
                >
                  + 이미지
                </button>
              </div>
            </div>
          </SettingsCard>
        );
      })}

      <DeletePasswordModal
        open={deleteSlot != null && Boolean(deleteTargetId)}
        title="숨고 메시지 프리셋 삭제"
        password={deletePassword}
        error={deleteError}
        onPasswordChange={setDeletePassword}
        onClose={() => setDeleteSlot(null)}
        onConfirm={async () => {
          if (!token || !deleteTargetId) return;
          try {
            await deleteTelecrmSoomgoMessagePreset(token, deleteTargetId, deletePassword);
            setDeleteSlot(null);
            await load();
          } catch (e) {
            setDeleteError(e instanceof Error ? e.message : '삭제 실패');
          }
        }}
      />
    </div>
  );
}
