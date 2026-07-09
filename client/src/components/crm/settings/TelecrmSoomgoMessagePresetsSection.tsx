import { useCallback, useEffect, useState } from 'react';
import type { SoomgoMessageImageMode, SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import { SOOMGO_MESSAGE_PRESET_MAX } from '@shared/soomgoMessagePresets';
import type { TelecrmCatalogOwnerScope } from '../../../api/telecrm';
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
import {
  persistPresetSortOrder,
  PresetDragReorderList,
  reorderPresetToSlot,
  SoomgoPresetDragHandle,
} from '../soomgo/soomgoPresetReorder';

type PresetDraft = {
  id: string | null;
  label: string;
  steps: SoomgoMessageStep[];
  isActive: boolean;
  sortOrder: number;
};

function emptyDraft(): PresetDraft {
  return { id: null, label: '', steps: [], isActive: true, sortOrder: 0 };
}

function stepSummary(step: SoomgoMessageStep): string {
  if (step.type === 'text') {
    const preview = step.text.length > 40 ? `${step.text.slice(0, 40)}…` : step.text;
    return `텍스트: ${preview}`;
  }
  return `이미지 ${step.urls.length}장 (${step.mode === 'bundle' ? '묶음' : '개별'})`;
}

function normalizeSteps(steps: SoomgoMessageStep[]): SoomgoMessageStep[] {
  return steps
    .map((s) => {
      if (s.type === 'text') return { ...s, text: s.text.trim() };
      return { ...s, urls: s.urls.filter(Boolean) };
    })
    .filter((s) => (s.type === 'text' ? s.text.length > 0 : s.urls.length > 0));
}

function PresetEditor({
  draft,
  index,
  busy,
  onChange,
  onSave,
  onDelete,
  onImagePick,
}: {
  draft: PresetDraft;
  index: number;
  busy: boolean;
  onChange: (patch: Partial<PresetDraft>) => void;
  onSave: () => void;
  onDelete?: () => void;
  onImagePick: (stepIndex: number, file: File) => void;
}) {
  const patchStep = (stepIndex: number, step: SoomgoMessageStep) => {
    const steps = [...draft.steps];
    steps[stepIndex] = step;
    onChange({ steps });
  };

  const removeStep = (stepIndex: number) => {
    onChange({ steps: draft.steps.filter((_, i) => i !== stepIndex) });
  };

  const moveStep = (stepIndex: number, dir: -1 | 1) => {
    const steps = [...draft.steps];
    const target = stepIndex + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[stepIndex], steps[target]] = [steps[target], steps[stepIndex]];
    onChange({ steps });
  };

  return (
    <SettingsCard
      title={draft.id ? draft.label || `프리셋 ${index + 1}` : `새 프리셋 ${index + 1}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {draft.id && onDelete ? (
            <button type="button" className="text-fluid-xs text-rose-600" onClick={onDelete}>
              삭제
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
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
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="프리셋 이름 (예: 견적 안내)"
          className={crmFieldClass}
        />
        <label className="flex items-center gap-2 text-fluid-xs text-gray-700">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            className="rounded border-gray-300"
          />
          사용
        </label>
        <div className="space-y-2">
          {draft.steps.map((step, stepIndex) => (
            <div key={`${draft.id ?? 'new'}-${stepIndex}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-fluid-xs font-medium text-gray-700">{stepSummary(step)}</span>
                <div className="flex gap-1">
                  <button type="button" className="text-fluid-xs text-gray-500" onClick={() => moveStep(stepIndex, -1)}>
                    ↑
                  </button>
                  <button type="button" className="text-fluid-xs text-gray-500" onClick={() => moveStep(stepIndex, 1)}>
                    ↓
                  </button>
                  <button type="button" className="text-fluid-xs text-rose-600" onClick={() => removeStep(stepIndex)}>
                    삭제
                  </button>
                </div>
              </div>
              {step.type === 'text' ? (
                <textarea
                  value={step.text}
                  onChange={(e) => patchStep(stepIndex, { type: 'text', text: e.target.value })}
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
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onImagePick(stepIndex, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <select
                      value={step.mode}
                      onChange={(e) =>
                        patchStep(stepIndex, {
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
                            patchStep(stepIndex, {
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
            onClick={() => onChange({ steps: [...draft.steps, { type: 'text', text: '' }] })}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-fluid-xs hover:bg-gray-50"
          >
            + 텍스트
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onChange({
                steps: [...draft.steps, { type: 'images', urls: [], mode: 'bundle' }],
              })
            }
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-fluid-xs hover:bg-gray-50"
          >
            + 이미지
          </button>
        </div>
      </div>
    </SettingsCard>
  );
}

function PresetOrderPanel({
  drafts,
  busy,
  onReorder,
}: {
  drafts: PresetDraft[];
  busy: boolean;
  onReorder: (dragId: string, slotIndex: number) => void;
}) {
  const saved = drafts.filter((d): d is PresetDraft & { id: string } => d.id != null);

  if (saved.length < 2) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-fluid-xs font-semibold text-slate-800">표시 순서</p>
        <p className="text-[10px] text-slate-500">⋮⋮ 드래그 후 항목 사이에 놓기</p>
      </div>
      <PresetDragReorderList
        items={saved}
        disabled={busy}
        onReorder={onReorder}
        renderItem={(draft, index, { dragHandleProps }) => (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition">
            <SoomgoPresetDragHandle
              presetId={draft.id}
              label={draft.label || `프리셋 ${index + 1}`}
              disabled={busy}
              onDragStart={dragHandleProps.onDragStart}
              onDragEnd={dragHandleProps.onDragEnd}
            />
            <span className="min-w-0 flex-1 truncate text-fluid-xs font-medium text-slate-800">
              {draft.label.trim() || `프리셋 ${index + 1}`}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{index + 1}</span>
          </div>
        )}
      />
    </div>
  );
}

export function TelecrmSoomgoMessagePresetsSection({
  catalogScope = 'personal',
}: {
  catalogScope?: TelecrmCatalogOwnerScope;
}) {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<PresetDraft[]>([]);
  const [newDraft, setNewDraft] = useState<PresetDraft | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [draggingOrder, setDraggingOrder] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmSoomgoMessagePresets(token, { scope: catalogScope, includeInactive: true });
      setDrafts(
        res.presets
          .map((preset) => ({
            id: preset.id,
            label: preset.label,
            steps: preset.steps,
            isActive: preset.isActive,
            sortOrder: preset.sortOrder,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'ko')),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, catalogScope]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (id: string | null, patch: Partial<PresetDraft>) => {
    if (id == null && newDraft) {
      setNewDraft({ ...newDraft, ...patch });
      return;
    }
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const onImagePick = async (draftId: string | null, stepIndex: number, file: File) => {
    if (!token) return;
    setBusy(true);
    try {
      const url = await uploadTelecrmSoomgoPresetImage(token, file);
      const source = draftId == null ? newDraft : drafts.find((d) => d.id === draftId);
      if (!source) return;
      const step = source.steps[stepIndex];
      if (step?.type !== 'images') return;
      const steps = [...source.steps];
      steps[stepIndex] = { ...step, urls: [...step.urls, url] };
      updateDraft(draftId, { steps });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleReorderPresets = async (dragId: string, slotIndex: number) => {
    if (!token) return;
    const saved = drafts.filter((d): d is PresetDraft & { id: string } => d.id != null);
    const nextSaved = reorderPresetToSlot(saved, dragId, slotIndex).map((d, i) => ({ ...d, sortOrder: i }));
    const unchanged =
      nextSaved.length === saved.length && nextSaved.every((d, i) => d.id === saved[i]?.id);
    if (unchanged) return;

    const orderMap = new Map(nextSaved.map((d) => [d.id, d.sortOrder]));
    setDrafts((prev) =>
      [...prev]
        .sort((a, b) => {
          const ao = a.id ? (orderMap.get(a.id) ?? 999) : 1000;
          const bo = b.id ? (orderMap.get(b.id) ?? 999) : 1000;
          return ao - bo;
        })
        .map((d) => (d.id && orderMap.has(d.id) ? { ...d, sortOrder: orderMap.get(d.id)! } : d)),
    );
    setDraggingOrder(true);
    setError(null);
    try {
      await persistPresetSortOrder(token, nextSaved);
      setMsg('프리셋 순서를 저장했습니다.');
      window.setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '순서 저장 실패');
      await load();
    } finally {
      setDraggingOrder(false);
    }
  };

  const saveDraft = async (draft: PresetDraft) => {
    if (!token) return;
    const label = draft.label.trim();
    const steps = normalizeSteps(draft.steps);
    if (!label) {
      setError('프리셋 이름을 입력해 주세요.');
      return;
    }
    if (!steps.length) {
      setError('전송 스텝을 1개 이상 추가해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      if (draft.id) {
        await updateTelecrmSoomgoMessagePreset(token, draft.id, { label, steps, isActive: draft.isActive });
      } else {
        await createTelecrmSoomgoMessagePreset(token, { label, steps, ownerScope: catalogScope });
        setNewDraft(null);
      }
      setMsg('프리셋을 저장했습니다.');
      window.setTimeout(() => setMsg(null), 3500);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const canAddMore = drafts.length + (newDraft ? 1 : 0) < SOOMGO_MESSAGE_PRESET_MAX;

  return (
    <div className="space-y-4">
      <p className="text-fluid-xs text-gray-600">
        상담 화면 <strong>숨고 메시지</strong>에서 저장한 프리셋 버튼으로 텍스트·이미지를 순서대로 전송합니다.
        {catalogScope === 'personal'
          ? ' 본인 계정에만 저장되며, 다른 마케터와 공유되지 않습니다.'
          : ' 업체 전체 마케터가 함께 쓸 수 있는 공유 프리셋입니다.'}
      </p>
      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-800">{msg}</p>
      ) : null}
      {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-fluid-sm text-gray-500">불러오는 중…</p> : null}

      {!loading && drafts.length >= 2 ? (
        <PresetOrderPanel drafts={drafts} busy={busy || draggingOrder} onReorder={(a, b) => void handleReorderPresets(a, b)} />
      ) : null}

      {drafts.map((draft, index) => (
        <PresetEditor
          key={draft.id ?? `saved-${index}`}
          draft={draft}
          index={index}
          busy={busy}
          onChange={(patch) => updateDraft(draft.id, patch)}
          onSave={() => void saveDraft(draft)}
          onDelete={() => {
            setDeleteTargetId(draft.id);
            setDeletePassword('');
            setDeleteError(null);
          }}
          onImagePick={(stepIndex, file) => void onImagePick(draft.id, stepIndex, file)}
        />
      ))}

      {newDraft ? (
        <PresetEditor
          draft={newDraft}
          index={drafts.length}
          busy={busy}
          onChange={(patch) => setNewDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
          onSave={() => void saveDraft(newDraft)}
          onImagePick={(stepIndex, file) => void onImagePick(null, stepIndex, file)}
        />
      ) : null}

      {canAddMore ? (
        <button
          type="button"
          disabled={busy || newDraft != null}
          onClick={() => setNewDraft(emptyDraft())}
          className="w-full rounded-xl border border-dashed border-gray-300 px-4 py-3 text-fluid-sm text-gray-600 hover:border-slate-400 hover:bg-gray-50 disabled:opacity-50"
        >
          + 프리셋 추가
        </button>
      ) : (
        <p className="text-fluid-xs text-gray-500">프리셋은 최대 {SOOMGO_MESSAGE_PRESET_MAX}개까지 등록할 수 있습니다.</p>
      )}

      <DeletePasswordModal
        open={deleteTargetId != null}
        title="숨고 메시지 프리셋 삭제"
        password={deletePassword}
        error={deleteError}
        onPasswordChange={setDeletePassword}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          if (!token || !deleteTargetId) return;
          try {
            await deleteTelecrmSoomgoMessagePreset(token, deleteTargetId, deletePassword);
            setDeleteTargetId(null);
            await load();
          } catch (e) {
            setDeleteError(e instanceof Error ? e.message : '삭제 실패');
          }
        }}
      />
    </div>
  );
}
