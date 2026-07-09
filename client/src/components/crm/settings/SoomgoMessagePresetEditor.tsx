import type { SoomgoMessageImageMode, SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import { SettingsCard } from './DeletePasswordModal';
import { crmFieldClass } from '../crmUi';

export type SoomgoPresetDraft = {
  id: string | null;
  label: string;
  steps: SoomgoMessageStep[];
  isActive: boolean;
  sortOrder: number;
};

export function emptySoomgoPresetDraft(): SoomgoPresetDraft {
  return { id: null, label: '', steps: [], isActive: true, sortOrder: 0 };
}

function stepSummary(step: SoomgoMessageStep): string {
  if (step.type === 'text') {
    const preview = step.text.length > 40 ? `${step.text.slice(0, 40)}…` : step.text;
    return `텍스트: ${preview}`;
  }
  return `이미지 ${step.urls.length}장 (${step.mode === 'bundle' ? '묶음' : '개별'})`;
}

export function normalizeSoomgoPresetSteps(steps: SoomgoMessageStep[]): SoomgoMessageStep[] {
  return steps
    .map((s) => {
      if (s.type === 'text') return { ...s, text: s.text.trim() };
      return { ...s, urls: s.urls.filter(Boolean) };
    })
    .filter((s) => (s.type === 'text' ? s.text.length > 0 : s.urls.length > 0));
}

export function SoomgoMessagePresetEditor({
  draft,
  index,
  busy,
  onChange,
  onSave,
  onDelete,
  onImagePick,
  hideLabel,
  fixedTitle,
  activeCheckboxLabel = '사용',
  textPlaceholder = '채팅 메시지',
  hint,
  compact = false,
}: {
  draft: SoomgoPresetDraft;
  index: number;
  busy: boolean;
  onChange: (patch: Partial<SoomgoPresetDraft>) => void;
  onSave: () => void;
  onDelete?: () => void;
  onImagePick: (stepIndex: number, file: File) => void;
  hideLabel?: boolean;
  fixedTitle?: string;
  activeCheckboxLabel?: string;
  textPlaceholder?: string;
  hint?: string;
  compact?: boolean;
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

  const title =
    fixedTitle ??
    (draft.id ? draft.label || `프리셋 ${index + 1}` : `새 프리셋 ${index + 1}`);

  const body = (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {hint && !compact ? <p className="text-fluid-xs text-gray-600">{hint}</p> : null}
      {!hideLabel ? (
        <input
          type="text"
          value={draft.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="프리셋 이름 (예: 견적 안내)"
          className={crmFieldClass}
        />
      ) : null}
      {!compact ? (
        <label className="flex items-center gap-2 text-fluid-xs text-gray-700">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            className="rounded border-gray-300"
          />
          {activeCheckboxLabel}
        </label>
      ) : null}
      <div className="space-y-2">
        {draft.steps.map((step, stepIndex) => (
          <div
            key={`${draft.id ?? 'new'}-${stepIndex}`}
            className={
              compact
                ? 'rounded border border-gray-200 bg-white p-2'
                : 'rounded-lg border border-gray-200 bg-gray-50 p-3'
            }
          >
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
                  placeholder={textPlaceholder}
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
  );

  if (compact) {
    return body;
  }

  return (
    <SettingsCard
      title={title}
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
      {body}
    </SettingsCard>
  );
}
