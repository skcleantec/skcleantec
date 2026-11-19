import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SoomgoMessagePresetDto, SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import {
  createTelecrmSoomgoMessagePreset,
  setTelecrmSoomgoPresetFavorite,
  updateTelecrmSoomgoMessagePreset,
  uploadTelecrmSoomgoPresetImage,
  deleteTelecrmSoomgoMessagePreset,
} from '../../api/telecrmSoomgoMessagePresets';
import { getToken } from '../../stores/auth';
import { confirmDialog } from '../ui/Toast';
import { Button } from '../ui/Button';
import { QuoteChip } from './quoteChrome';

type Draft = {
  id: string | null;
  label: string;
  ownerScope: 'shared' | 'personal';
  favorite: boolean;
  steps: SoomgoMessageStep[];
};

const fieldClass =
  'w-full rounded-lg border border-[#e6ebf2] bg-white px-2 py-1.5 text-fluid-sm text-slate-900 outline-none focus:border-[#1f4fb8]';

function emptyStep(): SoomgoMessageStep {
  return { type: 'text', text: '' };
}

function draftFromPreset(preset: SoomgoMessagePresetDto | null, favorite: boolean, canShare: boolean): Draft {
  if (!preset) {
    return { id: null, label: '', ownerScope: 'personal', favorite: false, steps: [emptyStep()] };
  }
  return {
    id: preset.id,
    label: preset.label,
    ownerScope: preset.ownerScope === 'shared' && canShare ? 'shared' : preset.ownerScope,
    favorite,
    steps: preset.steps.length > 0 ? preset.steps.map((step) => ({ ...step })) : [emptyStep()],
  };
}

function cleanSteps(steps: SoomgoMessageStep[]): SoomgoMessageStep[] {
  const next: SoomgoMessageStep[] = [];
  for (const step of steps) {
    if (step.type === 'text') {
      const text = step.text.trim();
      if (text) next.push({ type: 'text', text });
    } else if (step.urls.length > 0) {
      next.push({ type: 'images', urls: step.urls, mode: step.mode });
    }
  }
  return next;
}

export function QuoteMyPhraseSheet({
  preset,
  favorite,
  canEditShared,
  onClose,
  onSaved,
}: {
  preset: SoomgoMessagePresetDto | null;
  favorite: boolean;
  canEditShared: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromPreset(preset, favorite, canEditShared));
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageStep = useRef(0);

  const patchStep = (index: number, step: SoomgoMessageStep) => {
    setDraft((prev) => ({ ...prev, steps: prev.steps.map((item, i) => (i === index ? step : item)) }));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev.steps];
      const target = index + dir;
      const current = next[index];
      const other = next[target];
      if (!current || !other) return prev;
      next[index] = other;
      next[target] = current;
      return { ...prev, steps: next };
    });
  };

  const save = async () => {
    const token = getToken();
    if (!token) return;
    const label = draft.label.trim();
    const steps = cleanSteps(draft.steps);
    if (!label) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (steps.length === 0) {
      setError('문구를 한 줄 이상 넣어 주세요.');
      return;
    }
    const ownerScope = draft.ownerScope === 'shared' && canEditShared ? 'shared' : 'personal';
    setBusy(true);
    setError(null);
    try {
      const saved = draft.id
        ? await updateTelecrmSoomgoMessagePreset(token, draft.id, { label, steps, ownerScope })
        : await createTelecrmSoomgoMessagePreset(token, { label, steps, ownerScope });
      await setTelecrmSoomgoPresetFavorite(token, saved.id, draft.favorite);
      onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : '저장하지 못했어요.';
      setError(message.replaceAll('프리셋', '문구'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const token = getToken();
    if (!token || !draft.id) return;
    if (!password.trim()) {
      setError('삭제하려면 비밀번호를 입력해 주세요.');
      return;
    }
    const ok = await confirmDialog({
      title: '이 문구를 삭제할까요?',
      confirmLabel: '삭제',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTelecrmSoomgoMessagePreset(token, draft.id, password);
      onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : '삭제하지 못했어요.';
      setError(message.replaceAll('프리셋', '문구'));
      setBusy(false);
    }
  };

  const pickImage = async (file: File | undefined) => {
    const token = getToken();
    if (!token || !file) return;
    const index = imageStep.current;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadTelecrmSoomgoPresetImage(token, file);
      setDraft((prev) => ({
        ...prev,
        steps: prev.steps.map((step, i) => {
          if (i !== index || step.type !== 'images') return step;
          return { ...step, urls: [...step.urls, url].slice(0, 10) };
        }),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 올리지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-2xl bg-white shadow-bar"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-modal="true"
        aria-label={draft.id ? '문구 수정' : '새 문구'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <p className="text-fluid-sm font-semibold text-slate-900">{draft.id ? '문구 수정' : '새 문구'}</p>
          <Button variant="quiet" size="sm" className="ml-auto" onClick={onClose}>
            닫기
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
          <input
            value={draft.label}
            maxLength={120}
            placeholder="이름"
            className={fieldClass}
            onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
          />
          <div className="flex gap-1">
            <QuoteChip
              label="나만"
              on={draft.ownerScope === 'personal'}
              onClick={() => setDraft((prev) => ({ ...prev, ownerScope: 'personal' }))}
            />
            <QuoteChip
              label="공용"
              on={draft.ownerScope === 'shared'}
              onClick={() => {
                if (!canEditShared) return;
                setDraft((prev) => ({ ...prev, ownerScope: 'shared' }));
              }}
            />
            <QuoteChip
              label={draft.favorite ? '⭐ 즐겨찾기' : '☆ 즐겨찾기'}
              on={draft.favorite}
              onClick={() => setDraft((prev) => ({ ...prev, favorite: !prev.favorite }))}
            />
          </div>
          {draft.steps.map((step, index) => (
            <div key={index} className="rounded-xl border border-[#e6ebf2] p-2">
              {step.type === 'text' ? (
                <textarea
                  value={step.text}
                  rows={3}
                  className={`${fieldClass} resize-none`}
                  placeholder="문구"
                  onChange={(e) => patchStep(index, { type: 'text', text: e.target.value })}
                />
              ) : (
                <div className="space-y-1">
                  <p className="text-fluid-xs text-slate-600">사진 {step.urls.length}장</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      imageStep.current = index;
                      fileRef.current?.click();
                    }}
                  >
                    사진 넣기
                  </Button>
                </div>
              )}
              <div className="mt-1 flex gap-1">
                <Button variant="quiet" size="sm" disabled={index === 0} onClick={() => moveStep(index, -1)}>
                  위로
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={index === draft.steps.length - 1}
                  onClick={() => moveStep(index, 1)}
                >
                  아래로
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  className="!text-[#b42318]"
                  onClick={() => setDraft((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }))}
                >
                  빼기
                </Button>
              </div>
            </div>
          ))}
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDraft((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }))}
            >
              문구 추가
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  steps: [...prev.steps, { type: 'images', urls: [], mode: 'bundle' }],
                }))
              }
            >
              사진 추가
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void pickImage(file);
            }}
          />
          {draft.id ? (
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="삭제할 때만 비밀번호"
              className={fieldClass}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
          {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
        </div>
        <div className="flex gap-2 px-3 pt-1">
          {draft.id ? (
            <Button variant="danger" size="sm" disabled={busy} onClick={() => void remove()}>
              삭제
            </Button>
          ) : null}
          <Button variant="primary" size="sm" className="ml-auto" disabled={busy} onClick={() => void save()}>
            저장
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
